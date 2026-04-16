import fs from 'fs';
import path from 'path';

import type { SkillDraftCandidate } from './skill-draft-validator.js';

export interface ExistingSkillMatch {
  skillName: string;
  score: number;
  skillPath: string;
  sourceType: 'active' | 'incremental';
}

export interface IncrementalMergeOptions {
  activeSkillsDir: string;
  incrementalSkillsDir: string;
  proposalsDir: string;
  minMatchScore: number;
}

export interface IncrementalMergeResult {
  matched: number;
  proposed: number;
  merged: number;
}

interface ExistingSkill {
  name: string;
  path: string;
  description: string;
  tokens: Set<string>;
  sourceType: 'active' | 'incremental';
}

function tokenize(text: string): Set<string> {
  const normalized = text.replace(/[-_]/g, ' ');
  return new Set(
    normalized
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fa5_-]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  );
}

function parseFrontmatter(content: string): Record<string, string> {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---\n')) return {};
  const endIdx = trimmed.indexOf('\n---\n', 4);
  if (endIdx === -1) return {};
  const body = trimmed.slice(4, endIdx);
  const result: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter++;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function loadSkillsFromDir(
  skillsDir: string,
  sourceType: 'active' | 'incremental',
): ExistingSkill[] {
  if (!fs.existsSync(skillsDir)) return [];
  const list: ExistingSkill[] = [];
  for (const entry of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, entry, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    let content = '';
    try {
      content = fs.readFileSync(skillPath, 'utf-8');
    } catch {
      continue;
    }

    const frontmatter = parseFrontmatter(content);
    const name = frontmatter.name || entry;
    const description = frontmatter.description || '';

    const combined = `${name} ${description}`;
    list.push({
      name,
      path: skillPath,
      description,
      tokens: tokenize(combined),
      sourceType,
    });
  }

  return list;
}

export function matchExistingSkill(
  candidate: SkillDraftCandidate,
  activeSkillsDir: string,
  incrementalSkillsDir: string,
  minScore: number,
): ExistingSkillMatch | null {
  const existing = [
    ...loadSkillsFromDir(activeSkillsDir, 'active'),
    ...loadSkillsFromDir(incrementalSkillsDir, 'incremental'),
  ];
  if (existing.length === 0) return null;

  const candidateTokens = tokenize(
    `${candidate.name} ${candidate.description} ${candidate.intentKey}`,
  );

  let best: ExistingSkillMatch | null = null;
  for (const skill of existing) {
    const score = jaccard(candidateTokens, skill.tokens);
    if (score < minScore) continue;
    if (!best || score > best.score) {
      best = {
        skillName: skill.name,
        score,
        skillPath: skill.path,
        sourceType: skill.sourceType,
      };
    }
  }

  return best;
}

function writeProposal(
  proposalsDir: string,
  matchedSkillName: string,
  matchSourceType: 'active' | 'incremental',
  candidate: SkillDraftCandidate,
  score: number,
): void {
  fs.mkdirSync(proposalsDir, { recursive: true });
  const safeName = matchedSkillName.replace(/[^a-zA-Z0-9_-]+/g, '-');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const proposalPath = path.join(
    proposalsDir,
    `${safeName}-${ts}.increment.md`,
  );

  const lines = [
    `# Increment Proposal for ${matchedSkillName}`,
    '',
    `- matchSourceType: ${matchSourceType}`,
    `- matchScore: ${score.toFixed(3)}`,
    `- candidateName: ${candidate.name}`,
    `- sourceCount: ${candidate.sourceCount}`,
    `- successRate: ${candidate.successRate}`,
    `- intentKey: ${candidate.intentKey}`,
    '',
    '## Proposed Insight',
    '',
    `- From recurring trajectory: ${candidate.intentKey}`,
    '',
    '## Candidate Snippet',
    '',
    '```md',
    candidate.content,
    '```',
    '',
  ];

  fs.writeFileSync(proposalPath, lines.join('\n'));
}

export function mergeCandidatesIntoExistingSkills(
  candidates: SkillDraftCandidate[],
  options: IncrementalMergeOptions,
): IncrementalMergeResult {
  let matched = 0;
  let proposed = 0;
  const merged = 0;

  for (const candidate of candidates) {
    const match = matchExistingSkill(
      candidate,
      options.activeSkillsDir,
      options.incrementalSkillsDir,
      options.minMatchScore,
    );
    if (!match) continue;

    matched += 1;
    writeProposal(
      options.proposalsDir,
      match.skillName,
      match.sourceType,
      candidate,
      match.score,
    );
    proposed += 1;
  }

  return { matched, proposed, merged };
}
