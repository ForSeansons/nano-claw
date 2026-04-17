import fs from 'fs';
import path from 'path';

type MemoryMode = 'none' | 'full' | 'retrieved';

interface SemanticSection {
  heading: string;
  content: string;
  index: number;
}

interface EpisodicEntry {
  id: string;
  content: string;
  date?: Date;
}

interface RetrievedItem<T> {
  item: T;
  score: number;
}

interface MemoryOptions {
  fullGlobalThresholdChars: number;
  semanticTopK: number;
  episodicTopK: number;
  maxSectionChars: number;
  maxEpisodicChars: number;
  maxEpisodicFiles: number;
}

export interface MemoryContext {
  append: string;
  diagnostics: {
    mode: MemoryMode;
    semanticCount: number;
    episodicCount: number;
    globalChars: number;
  };
}

interface BuildMemoryContextInput {
  prompt: string;
  globalClaudeMd?: string;
  episodicEntries?: EpisodicEntry[];
  options?: Partial<MemoryOptions>;
  now?: Date;
}

interface FileMemoryContextInput {
  prompt: string;
  isMain: boolean;
  globalClaudeMdPath: string;
  episodicDir: string;
  env?: Record<string, string | undefined>;
  now?: Date;
}

const DEFAULT_OPTIONS: MemoryOptions = {
  fullGlobalThresholdChars: 8000,
  semanticTopK: 3,
  episodicTopK: 2,
  maxSectionChars: 1200,
  maxEpisodicChars: 400,
  maxEpisodicFiles: 40,
};

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'with',
  'you',
  'your',
  '我',
  '你',
  '的',
  '了',
  '在',
  '和',
  '是',
  '就',
  '都',
  '而',
  '及',
  '与',
]);

function toPositiveInt(input: string | undefined, fallback: number): number {
  const value = Number.parseInt(input || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function mergeOptions(
  options?: Partial<MemoryOptions>,
  env?: Record<string, string | undefined>,
): MemoryOptions {
  const merged: MemoryOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  if (!env) return merged;

  merged.fullGlobalThresholdChars = toPositiveInt(
    env.NANOCLAW_MEMORY_FULL_THRESHOLD_CHARS,
    merged.fullGlobalThresholdChars,
  );
  merged.semanticTopK = toPositiveInt(
    env.NANOCLAW_MEMORY_SEMANTIC_TOP_K,
    merged.semanticTopK,
  );
  merged.episodicTopK = toPositiveInt(
    env.NANOCLAW_MEMORY_EPISODIC_TOP_K,
    merged.episodicTopK,
  );
  merged.maxSectionChars = toPositiveInt(
    env.NANOCLAW_MEMORY_MAX_SECTION_CHARS,
    merged.maxSectionChars,
  );
  merged.maxEpisodicChars = toPositiveInt(
    env.NANOCLAW_MEMORY_MAX_EPISODIC_CHARS,
    merged.maxEpisodicChars,
  );
  merged.maxEpisodicFiles = toPositiveInt(
    env.NANOCLAW_MEMORY_MAX_EPISODIC_FILES,
    merged.maxEpisodicFiles,
  );
  return merged;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function overlapScore(queryTokens: string[], candidateText: string): number {
  if (queryTokens.length === 0 || !candidateText.trim()) return 0;
  const candidateTokens = new Set(tokenize(candidateText));
  if (candidateTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) overlap++;
  }
  if (overlap === 0) return 0;
  return overlap / Math.sqrt(queryTokens.length * candidateTokens.size);
}

function parseMarkdownSections(markdown: string): SemanticSection[] {
  const lines = markdown.split('\n');
  const sections: SemanticSection[] = [];

  let currentHeading = 'General';
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (!content && sections.length > 0) return;
    sections.push({ heading: currentHeading, content, index });
    index++;
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      if (buffer.length > 0 || sections.length === 0) {
        flush();
      }
      currentHeading = heading[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections.filter((s, i) => i === 0 || s.content.length > 0);
}

function clip(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function pickSemanticSections(
  globalClaudeMd: string,
  prompt: string,
  options: MemoryOptions,
): { mode: MemoryMode; text: string; count: number } {
  if (!globalClaudeMd.trim()) {
    return { mode: 'none', text: '', count: 0 };
  }

  if (globalClaudeMd.length <= options.fullGlobalThresholdChars) {
    return { mode: 'full', text: globalClaudeMd.trim(), count: 1 };
  }

  const promptTail = prompt.slice(-4000);
  const queryTokens = tokenize(promptTail);
  const sections = parseMarkdownSections(globalClaudeMd);
  if (sections.length === 0) {
    return {
      mode: 'retrieved',
      text: clip(globalClaudeMd.trim(), options.maxSectionChars),
      count: 1,
    };
  }

  const scored: RetrievedItem<SemanticSection>[] = sections.map((section) => ({
    item: section,
    score: overlapScore(
      queryTokens,
      `${section.heading}\n${clip(section.content, options.maxSectionChars)}`,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);
  const selected: SemanticSection[] = [];
  const used = new Set<number>();

  // Keep the first section as baseline for stable behavior.
  selected.push(sections[0]);
  used.add(sections[0].index);

  for (const entry of scored) {
    if (selected.length >= Math.max(1, options.semanticTopK)) break;
    if (entry.score <= 0) continue;
    if (used.has(entry.item.index)) continue;
    selected.push(entry.item);
    used.add(entry.item.index);
  }

  const lines: string[] = [];
  lines.push('## Global Memory (Retrieved)');
  for (const section of selected) {
    lines.push(`### ${section.heading}`);
    lines.push(clip(section.content.trim(), options.maxSectionChars) || '(empty)');
  }

  return {
    mode: 'retrieved',
    text: lines.join('\n\n').trim(),
    count: selected.length,
  };
}

function parseDateFromId(id: string): Date | undefined {
  const m = id.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const day = Number.parseInt(m[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return undefined;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return undefined;
  }
  return dt;
}

function recencyBoost(date: Date | undefined, now: Date): number {
  if (!date) return 0;
  const days = Math.max(
    0,
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  return 1 / (1 + days / 30);
}

function pickEpisodicEntries(
  entries: EpisodicEntry[] | undefined,
  prompt: string,
  options: MemoryOptions,
  now: Date,
): { text: string; count: number } {
  if (!entries || entries.length === 0) return { text: '', count: 0 };

  const queryTokens = tokenize(prompt.slice(-4000));
  const scored: RetrievedItem<EpisodicEntry>[] = entries.map((entry) => {
    const base = overlapScore(queryTokens, entry.content);
    const time = recencyBoost(entry.date, now);
    return {
      item: entry,
      score: base + time * 0.15,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored
    .filter((s) => s.score > 0)
    .slice(0, Math.max(1, options.episodicTopK))
    .map((s) => s.item);

  if (selected.length === 0) return { text: '', count: 0 };

  const lines: string[] = [];
  lines.push('## Episodic Recall');
  for (const entry of selected) {
    lines.push(`### ${entry.id}`);
    lines.push(clip(entry.content.trim(), options.maxEpisodicChars));
  }

  return { text: lines.join('\n\n').trim(), count: selected.length };
}

function readEpisodicEntries(
  episodicDir: string,
  options: MemoryOptions,
): EpisodicEntry[] {
  if (!fs.existsSync(episodicDir)) return [];
  const files = fs
    .readdirSync(episodicDir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, options.maxEpisodicFiles);

  const entries: EpisodicEntry[] = [];
  for (const file of files) {
    const fullPath = path.join(episodicDir, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      entries.push({
        id: file,
        content,
        date: parseDateFromId(file),
      });
    } catch {
      // Ignore unreadable files.
    }
  }
  return entries;
}

export function buildMemoryContext(
  input: BuildMemoryContextInput,
): MemoryContext | null {
  const options = mergeOptions(input.options);
  const now = input.now || new Date();
  const globalClaudeMd = input.globalClaudeMd || '';

  const semantic = pickSemanticSections(globalClaudeMd, input.prompt, options);
  const episodic = pickEpisodicEntries(
    input.episodicEntries,
    input.prompt,
    options,
    now,
  );

  const parts = [semantic.text, episodic.text].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return {
    append: parts.join('\n\n'),
    diagnostics: {
      mode: semantic.mode,
      semanticCount: semantic.count,
      episodicCount: episodic.count,
      globalChars: globalClaudeMd.length,
    },
  };
}

export function loadMemoryContextFromFs(
  input: FileMemoryContextInput,
): MemoryContext | null {
  const env = input.env || process.env;
  if (env.NANOCLAW_MEMORY_RETRIEVAL_ENABLED === '0') {
    return null;
  }

  const options = mergeOptions(undefined, env);
  let globalClaudeMd = '';
  if (!input.isMain && fs.existsSync(input.globalClaudeMdPath)) {
    try {
      globalClaudeMd = fs.readFileSync(input.globalClaudeMdPath, 'utf-8');
    } catch {
      globalClaudeMd = '';
    }
  }

  const episodicEntries = readEpisodicEntries(input.episodicDir, options);
  return buildMemoryContext({
    prompt: input.prompt,
    globalClaudeMd,
    episodicEntries,
    options,
    now: input.now,
  });
}
