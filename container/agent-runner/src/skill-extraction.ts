import fs from 'fs';
import path from 'path';

import {
  sanitizeSkillName,
  SkillDraftCandidate,
} from './skill-draft-validator.js';
import { saveSkillDraft, SavedSkillDraft } from './skill-draft-store.js';

interface ConversationRecord {
  userMessages: string[];
  assistantMessages: string[];
  toolMentions: string[];
}

interface IntentStats {
  key: string;
  count: number;
  successCount: number;
  toolMentions: Map<string, number>;
  userSamples: string[];
  assistantSamples: string[];
}

export interface SkillExtractionOptions {
  conversationsDir: string;
  draftsDir: string;
  activeSkillsDir: string;
  minOccurrences: number;
  minSuccessRate: number;
  maxDraftsPerRun: number;
}

export interface SkillExtractionResult {
  scannedFiles: number;
  intentBuckets: number;
  candidates: number;
  saved: SavedSkillDraft[];
}

const DEFAULT_OPTIONS: SkillExtractionOptions = {
  conversationsDir: '/workspace/group/conversations',
  draftsDir: '/home/node/.claude/skills-drafts',
  activeSkillsDir: '/home/node/.claude/skills',
  minOccurrences: 3,
  minSuccessRate: 0.7,
  maxDraftsPerRun: 3,
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter(
      (t) =>
        ![
          'the',
          'and',
          'for',
          'you',
          'that',
          'with',
          'this',
          '请',
          '帮我',
          '一下',
          '可以',
        ].includes(t),
    );
}

function detectSuccess(record: ConversationRecord): boolean {
  const joined = record.assistantMessages.join('\n').toLowerCase();
  if (!joined.trim()) return false;
  const positiveSignals = [
    'done',
    'completed',
    'success',
    '已完成',
    '完成了',
    '处理好了',
    'successfully',
  ];
  return positiveSignals.some((s) => joined.includes(s));
}

function extractToolMentions(text: string): string[] {
  const mentions: string[] = [];
  const regexes = [
    /\/(status|capabilities|agent-browser|slack-formatting|skill-index)\b/gi,
    /\b(status|capabilities|agent-browser|slack-formatting|skill-index)\b/gi,
  ];

  for (const re of regexes) {
    for (const match of text.matchAll(re)) {
      const value = String(match[1] || match[0]).toLowerCase();
      if (value) mentions.push(value.replace(/^\//, ''));
    }
  }

  return mentions;
}

function parseConversationMarkdown(content: string): ConversationRecord {
  const userMessages: string[] = [];
  const assistantMessages: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('**')) continue;

    // Support both styles:
    // 1) **User**: message
    // 2) **User:** message
    const m =
      trimmed.match(/^\*\*(.+?)\*\*:\s*(.*)$/) ||
      trimmed.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;

    const role = m[1].toLowerCase().replace(/:$/, '');
    const message = (m[2] || '').trim();
    if (!message) continue;

    if (role.includes('user')) {
      userMessages.push(message);
    } else {
      assistantMessages.push(message);
    }
  }

  const toolMentions = extractToolMentions(content);
  return { userMessages, assistantMessages, toolMentions };
}

function buildIntentKey(userMessages: string[], toolMentions: string[]): string {
  if (toolMentions.length > 0) {
    const mentionFreq = new Map<string, number>();
    for (const mention of toolMentions) {
      mentionFreq.set(mention, (mentionFreq.get(mention) || 0) + 1);
    }
    const topMention = Array.from(mentionFreq.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (topMention) {
      return `tool-${topMention}`;
    }
  }

  const joined = userMessages.slice(-3).join(' ');
  const tokens = tokenize(joined);
  if (tokens.length === 0) return 'general-task';

  const top = new Map<string, number>();
  for (const t of tokens) {
    top.set(t, (top.get(t) || 0) + 1);
  }

  return Array.from(top.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k)
    .join('-');
}

function buildSkillContent(candidate: SkillDraftCandidate): string {
  const samples = (candidate.userSamples || []).slice(0, 3).map((s) => `- ${s}`);
  const procedures = [
    '1. Confirm the request matches the intent signals.',
    '2. Run the minimum necessary steps for this recurring task.',
    '3. Return concise result and key evidence.',
  ];

  return `---
name: ${candidate.name}
description: ${candidate.description}
---

# ${candidate.name}

## When to Use

${samples.length > 0 ? samples.join('\n') : '- Use for recurring requests matching this intent.'}

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: ${candidate.intentKey}
- frequent patterns from trajectory with source count: ${candidate.sourceCount}

## Procedure

${procedures.join('\n')}

## Verification

- Output directly addresses the user request.
- Evidence/check output is included when applicable.
- No unnecessary steps are executed.

## Anti-patterns

- Over-expanding scope beyond the recurring task.
- Claiming success without evidence.
- Mixing unrelated workflows into one response.
`;
}

function draftDescriptionFromIntent(intentKey: string): string {
  return `Auto-extracted recurring workflow for intent: ${intentKey}`;
}

function chooseDraftName(intent: IntentStats): string {
  const topMention = Array.from(intent.toolMentions.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (topMention) {
    return sanitizeSkillName(`auto-${topMention}-${intent.key}`);
  }
  return sanitizeSkillName(`auto-${intent.key}`);
}

function uniquifyNames(candidates: SkillDraftCandidate[]): SkillDraftCandidate[] {
  const used = new Map<string, number>();
  return candidates.map((candidate) => {
    const base = candidate.name;
    const count = used.get(base) || 0;
    used.set(base, count + 1);

    if (count === 0) return candidate;

    return {
      ...candidate,
      name: `${base}-${count + 1}`,
    };
  });
}

function collectIntents(conversationsDir: string): {
  scannedFiles: number;
  intents: Map<string, IntentStats>;
} {
  const intents = new Map<string, IntentStats>();
  if (!fs.existsSync(conversationsDir)) {
    return { scannedFiles: 0, intents };
  }

  const files = fs
    .readdirSync(conversationsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(conversationsDir, file);
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    const record = parseConversationMarkdown(content);
    if (record.userMessages.length === 0) continue;

    const key = buildIntentKey(record.userMessages, record.toolMentions);
    const existing = intents.get(key) || {
      key,
      count: 0,
      successCount: 0,
      toolMentions: new Map<string, number>(),
      userSamples: [],
      assistantSamples: [],
    };

    existing.count += 1;
    if (detectSuccess(record)) existing.successCount += 1;

    for (const tool of record.toolMentions) {
      existing.toolMentions.set(tool, (existing.toolMentions.get(tool) || 0) + 1);
    }

    if (existing.userSamples.length < 5) {
      existing.userSamples.push(record.userMessages[record.userMessages.length - 1]);
    }
    if (existing.assistantSamples.length < 5 && record.assistantMessages.length > 0) {
      existing.assistantSamples.push(
        record.assistantMessages[record.assistantMessages.length - 1],
      );
    }

    intents.set(key, existing);
  }

  return { scannedFiles: files.length, intents };
}

export function extractSkillDraftsFromTrajectories(
  options?: Partial<SkillExtractionOptions>,
): SkillExtractionResult {
  const config: SkillExtractionOptions = {
    ...DEFAULT_OPTIONS,
    ...(options || {}),
  };

  const { scannedFiles, intents } = collectIntents(config.conversationsDir);

  const candidates: SkillDraftCandidate[] = [];
  for (const intent of intents.values()) {
    const successRate = intent.count > 0 ? intent.successCount / intent.count : 0;
    if (intent.count < config.minOccurrences) continue;
    if (successRate < config.minSuccessRate) continue;

    const candidate: SkillDraftCandidate = {
      name: chooseDraftName(intent),
      description: draftDescriptionFromIntent(intent.key),
      sourceCount: intent.count,
      successRate,
      intentKey: intent.key,
      userSamples: intent.userSamples,
      assistantSamples: intent.assistantSamples,
      content: '',
    };

    candidate.content = buildSkillContent(candidate);
    candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
    return b.successRate - a.successRate;
  });

  const uniqueCandidates = uniquifyNames(
    candidates.slice(0, config.maxDraftsPerRun),
  );

  const saved: SavedSkillDraft[] = [];
  for (const candidate of uniqueCandidates) {
    const savedDraft = saveSkillDraft(candidate, {
      draftsDir: config.draftsDir,
      activeSkillsDir: config.activeSkillsDir,
    });
    if (savedDraft) saved.push(savedDraft);
  }

  return {
    scannedFiles,
    intentBuckets: intents.size,
    candidates: candidates.length,
    saved,
  };
}
