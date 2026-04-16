import fs from 'fs';
import path from 'path';

import {
  SkillDraftCandidate,
  validateSkillDraft,
} from './skill-draft-validator.js';

export interface SkillDraftStoreOptions {
  draftsDir: string;
  activeSkillsDir: string;
  referenceSkillDirs?: string[];
  dedupeNameThreshold?: number;
}

export interface SavedSkillDraft {
  name: string;
  dirPath: string;
  skillPath: string;
  metaPath: string;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_\-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export function listExistingSkillNames(
  activeSkillsDir: string,
  additionalSkillDirs: string[] = [],
): string[] {
  const result = new Set<string>();
  const dirs = [activeSkillsDir, ...additionalSkillDirs];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const skillPath = path.join(dir, name, 'SKILL.md');
      if (fs.existsSync(skillPath)) result.add(name);
    }
  }

  return Array.from(result);
}

export function isDuplicateName(
  candidateName: string,
  existingNames: string[],
  threshold = 0.75,
): boolean {
  if (existingNames.includes(candidateName)) return true;

  const c = tokenize(candidateName.replace(/[-_]/g, ' '));
  for (const name of existingNames) {
    const score = jaccard(c, tokenize(name.replace(/[-_]/g, ' ')));
    if (score >= threshold) return true;
  }
  return false;
}

export function saveSkillDraft(
  draft: SkillDraftCandidate,
  options: SkillDraftStoreOptions,
): SavedSkillDraft | null {
  const validation = validateSkillDraft(draft);
  if (!validation.valid) {
    return null;
  }

  const dedupeThreshold = options.dedupeNameThreshold ?? 0.75;
  const existing = listExistingSkillNames(
    options.activeSkillsDir,
    options.referenceSkillDirs,
  );
  if (isDuplicateName(draft.name, existing, dedupeThreshold)) {
    return null;
  }

  fs.mkdirSync(options.draftsDir, { recursive: true });
  const dirPath = path.join(options.draftsDir, draft.name);
  fs.mkdirSync(dirPath, { recursive: true });

  const skillPath = path.join(dirPath, 'SKILL.md');
  const metaPath = path.join(dirPath, 'meta.json');

  fs.writeFileSync(skillPath, draft.content);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        name: draft.name,
        description: draft.description,
        sourceCount: draft.sourceCount,
        successRate: draft.successRate,
        intentKey: draft.intentKey,
        createdAt: new Date().toISOString(),
        status: 'draft',
      },
      null,
      2,
    ) + '\n',
  );

  return {
    name: draft.name,
    dirPath,
    skillPath,
    metaPath,
  };
}
