import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  sanitizeSkillName,
  validateSkillDraft,
  type SkillDraftCandidate,
} from '../container/agent-runner/src/skill-draft-validator.js';
import {
  isDuplicateName,
  saveSkillDraft,
} from '../container/agent-runner/src/skill-draft-store.js';
import { extractSkillDraftsFromTrajectories } from '../container/agent-runner/src/skill-extraction.js';
import { matchExistingSkill } from '../container/agent-runner/src/skill-incremental-merge.js';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function buildDraftContent(name: string, description: string): string {
  return `---
name: ${name}
description: ${description}
---

# /${name} - Test Skill

## When to Use
- use for recurring requests

## When NOT to Use
- not for unrelated tasks

## Input Signals
- signal A

## Procedure
1. do step

## Verification
- verify output

## Anti-patterns
- avoid overreach
`;
}

describe('skill extraction pipeline', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('validates required sections and frontmatter', () => {
    const valid: SkillDraftCandidate = {
      name: 'auto-test-skill',
      description: 'test description',
      content: buildDraftContent('auto-test-skill', 'test description'),
      sourceCount: 3,
      successRate: 0.9,
      intentKey: 'test-intent',
    };

    const ok = validateSkillDraft(valid);
    expect(ok.valid).toBe(true);

    const bad = {
      ...valid,
      content: '---\nname: auto-test-skill\n---\n# missing sections\n',
    };
    const fail = validateSkillDraft(bad);
    expect(fail.valid).toBe(false);
    expect(fail.errors.some((e) => e.includes('missing required section'))).toBe(
      true,
    );
  });

  it('deduplicates draft names against existing skills', () => {
    const active = tempDir('nanoclaw-active-');
    const drafts = tempDir('nanoclaw-drafts-');
    dirs.push(active, drafts);

    fs.mkdirSync(path.join(active, 'status'), { recursive: true });
    fs.writeFileSync(
      path.join(active, 'status', 'SKILL.md'),
      buildDraftContent('status', 'existing'),
    );

    expect(isDuplicateName('status', ['status'])).toBe(true);
    expect(isDuplicateName('status-check', ['status'], 0.2)).toBe(true);

    const saved = saveSkillDraft(
      {
        name: 'status',
        description: 'duplicate of existing',
        content: buildDraftContent('status', 'duplicate'),
        sourceCount: 5,
        successRate: 0.8,
        intentKey: 'status-health',
      },
      {
        draftsDir: drafts,
        activeSkillsDir: active,
      },
    );

    expect(saved).toBeNull();
  });

  it('extracts recurring trajectory patterns into skill drafts', () => {
    const base = tempDir('nanoclaw-extract-');
    const conversationsDir = path.join(base, 'conversations');
    const draftsDir = path.join(base, 'skills-drafts');
    const activeSkillsDir = path.join(base, 'skills');
    dirs.push(base);

    fs.mkdirSync(conversationsDir, { recursive: true });
    fs.mkdirSync(activeSkillsDir, { recursive: true });

    const conv1 = `# Conversation\n\n**User**: 请帮我检查系统状态和任务\n\n**Assistant**: Done. I checked /status and everything completed successfully.`;
    const conv2 = `# Conversation\n\n**User**: 帮我看一下当前系统状态\n\n**Assistant**: 已完成。status 检查成功，任务正常。`;
    const conv3 = `# Conversation\n\n**User**: 现在运行健康吗，给我状态\n\n**Assistant**: completed status check successfully.`;

    fs.writeFileSync(path.join(conversationsDir, '2026-04-14-a.md'), conv1);
    fs.writeFileSync(path.join(conversationsDir, '2026-04-15-b.md'), conv2);
    fs.writeFileSync(path.join(conversationsDir, '2026-04-16-c.md'), conv3);

    const result = extractSkillDraftsFromTrajectories({
      conversationsDir,
      draftsDir,
      activeSkillsDir,
      minOccurrences: 2,
      minSuccessRate: 0.5,
      maxDraftsPerRun: 2,
    });

    expect(result.scannedFiles).toBe(3);
    expect(result.intentBuckets).toBeGreaterThan(0);
    expect(result.candidates).toBeGreaterThan(0);
    expect(result.saved.length).toBeGreaterThan(0);

    const saved = result.saved[0];
    expect(fs.existsSync(saved.skillPath)).toBe(true);
    expect(fs.existsSync(saved.metaPath)).toBe(true);

    const content = fs.readFileSync(saved.skillPath, 'utf-8');
    expect(content).toContain('## When to Use');
    expect(content).toContain('## Procedure');
    expect(content).toContain('## Verification');
    expect(content).toContain('# /');
  });

  it('sanitizes generated skill names', () => {
    expect(sanitizeSkillName('Auto Skill: Status Health!!')).toBe(
      'auto-skill-status-health',
    );
  });

  it('considers active and incremental skills for matching and never mutates source skills', () => {
    const base = tempDir('nanoclaw-extract-match-');
    const activeSkillsDir = path.join(base, 'skills');
    const incrementalSkillsDir = path.join(base, 'skills-incremental');
    dirs.push(base);

    fs.mkdirSync(path.join(activeSkillsDir, 'status'), { recursive: true });
    fs.mkdirSync(path.join(incrementalSkillsDir, 'health-status'), {
      recursive: true,
    });

    const activeSkillPath = path.join(activeSkillsDir, 'status', 'SKILL.md');
    const incrementalSkillPath = path.join(
      incrementalSkillsDir,
      'health-status',
      'SKILL.md',
    );

    fs.writeFileSync(activeSkillPath, buildDraftContent('status', 'runtime status'));
    fs.writeFileSync(
      incrementalSkillPath,
      buildDraftContent('health-status', 'runtime health status and checks'),
    );

    const beforeActive = fs.readFileSync(activeSkillPath, 'utf-8');
    const beforeIncremental = fs.readFileSync(incrementalSkillPath, 'utf-8');

    const match = matchExistingSkill(
      {
        name: 'auto-health-status',
        description:
          'Auto-extracted recurring workflow for intent tool-status. Use when user requests match this recurring pattern.',
        content: buildDraftContent(
          'auto-health-status',
          'Auto-extracted recurring workflow for intent tool-status. Use when user requests match this recurring pattern.',
        ),
        sourceCount: 2,
        successRate: 1,
        intentKey: 'tool-status',
      },
      activeSkillsDir,
      incrementalSkillsDir,
      0.1,
    );
    expect(match).not.toBeNull();
    expect(match!.sourceType).toBe('incremental');

    const afterActive = fs.readFileSync(activeSkillPath, 'utf-8');
    const afterIncremental = fs.readFileSync(incrementalSkillPath, 'utf-8');
    expect(afterActive).toBe(beforeActive);
    expect(afterIncremental).toBe(beforeIncremental);
  });
});
