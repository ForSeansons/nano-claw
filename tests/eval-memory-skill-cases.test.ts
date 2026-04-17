import { describe, expect, it } from 'vitest';

import {
  classifyFallbackReason,
  fallbackRecommendation,
  isMemoryPath,
  isSkillPath,
  normalizePath,
  shouldIgnoreDiffPath,
} from '../scripts/eval-memory-skill.js';

type CaseInput = string;

interface NamedCase<T> {
  name: string;
  input: CaseInput;
  expected: T;
}

const normalizeCases: Array<NamedCase<string>> = [
  { name: 'n01 windows-slash', input: 'a\\b\\c.ts', expected: 'a/b/c.ts' },
  { name: 'n02 leading-dot', input: './abc/def.ts', expected: 'abc/def.ts' },
  { name: 'n03 trim-space', input: '  docs/a.md  ', expected: 'docs/a.md' },
  { name: 'n04 mixed', input: ' ./a\\b/c.ts ', expected: 'a/b/c.ts' },
  { name: 'n05 keep-inner', input: 'a /b.ts', expected: 'a /b.ts' },
];

const ignoreCases: Array<NamedCase<boolean>> = [
  { name: 'i01 reports', input: 'reports/eval/a.json', expected: true },
  { name: 'i02 dist', input: 'dist/index.js', expected: true },
  { name: 'i03 node_modules', input: 'node_modules/x/y.js', expected: true },
  { name: 'i04 coverage', input: 'coverage/lcov.info', expected: true },
  { name: 'i05 git', input: '.git/config', expected: true },
  { name: 'i06 swarm', input: '.swarm/researcher/a.md', expected: true },
  { name: 'i07 ds-store-root', input: '.DS_Store', expected: true },
  { name: 'i08 ds-store-sub', input: 'abc/.DS_Store', expected: true },
  { name: 'i09 normal-src', input: 'src/index.ts', expected: false },
  { name: 'i10 normal-doc', input: 'docs/readme.md', expected: false },
];

const memoryCases: Array<NamedCase<boolean>> = [
  { name: 'm01 root-memory-md', input: 'MEMORY.md', expected: true },
  { name: 'm02 root-dreams-md', input: 'DREAMS.md', expected: true },
  { name: 'm03 memory-dir', input: 'memory/2026-01-01.md', expected: true },
  { name: 'm04 nested-memory-dir', input: 'group/a/memory/log.md', expected: true },
  { name: 'm05 memory-retrieval-file', input: 'container/agent-runner/src/memory-retrieval.ts', expected: true },
  { name: 'm06 docs-memory', input: 'docs/MEMORY_LAYERED_RETRIEVAL.md', expected: true },
  { name: 'm07 docs-memory-lower', input: 'docs/memory-notes.md', expected: true },
  { name: 'm08 non-memory-doc', input: 'docs/skill-routing.md', expected: false },
  { name: 'm09 random-src', input: 'src/index.ts', expected: false },
  { name: 'm10 memory-word-only', input: 'src/memory-helper.ts', expected: false },
];

const skillCases: Array<NamedCase<boolean>> = [
  { name: 's01 container-skills', input: 'container/skills/status/SKILL.md', expected: true },
  { name: 's02 nested-skills', input: 'group/a/skills/new/SKILL.md', expected: true },
  { name: 's03 skill-extraction', input: 'container/agent-runner/src/skill-extraction.ts', expected: true },
  { name: 's04 skill-incremental', input: 'container/agent-runner/src/skill-incremental-merge.ts', expected: true },
  { name: 's05 skill-draft-validator', input: 'container/agent-runner/src/skill-draft-validator.ts', expected: true },
  { name: 's06 docs-skill', input: 'docs/skill-routing-readme-zh.md', expected: true },
  { name: 's07 docs-skill-routing', input: 'docs/my-skill-routing-note.md', expected: true },
  { name: 's08 vitest-skills-config', input: 'vitest.skills.config.ts', expected: true },
  { name: 's09 unrelated-doc', input: 'docs/README.md', expected: false },
  { name: 's10 skill-word-only-src', input: 'src/skill-helper.ts', expected: false },
];

const reasonCases: Array<NamedCase<string>> = [
  { name: 'r01 missing-key', input: 'OPENAI_API_KEY missing', expected: 'missing-key' },
  { name: 'r02 missing-key-no-key', input: 'no key for anthropic judge', expected: 'missing-key' },
  { name: 'r03 timeout', input: 'request timeout after 25000ms', expected: 'timeout' },
  { name: 'r04 abort', input: 'AbortError happened', expected: 'timeout' },
  { name: 'r05 rate-limit-429', input: 'HTTP 429 too many requests', expected: 'rate-limit' },
  { name: 'r06 rate-limit-quota', input: 'quota exceeded', expected: 'rate-limit' },
  { name: 'r07 base-url-html', input: 'HTTP 404: <!DOCTYPE html><html>', expected: 'base-url' },
  { name: 'r08 base-url-next', input: '/_next/static/css/abc', expected: 'base-url' },
  { name: 'r09 model-not-found', input: 'model does not exist', expected: 'model-not-found' },
  { name: 'r10 auth-401', input: 'HTTP 401 unauthorized', expected: 'auth' },
  { name: 'r11 auth-403', input: 'HTTP 403 forbidden', expected: 'auth' },
  { name: 'r12 region', input: 'not supported in your location', expected: 'region' },
  { name: 'r13 network', input: 'fetch failed: ENOTFOUND', expected: 'network' },
  { name: 'r14 schema', input: 'invalid json schema from judge', expected: 'schema' },
  { name: 'r15 unknown', input: 'something weird happened', expected: 'unknown' },
];

describe('eval-memory-skill helper cases', () => {
  it('runs 50 deterministic reference cases', () => {
    for (const c of normalizeCases) {
      expect(normalizePath(c.input), c.name).toBe(c.expected);
    }
    for (const c of ignoreCases) {
      expect(shouldIgnoreDiffPath(c.input), c.name).toBe(c.expected);
    }
    for (const c of memoryCases) {
      expect(isMemoryPath(c.input), c.name).toBe(c.expected);
    }
    for (const c of skillCases) {
      expect(isSkillPath(c.input), c.name).toBe(c.expected);
    }
    for (const c of reasonCases) {
      expect(classifyFallbackReason(c.input), c.name).toBe(c.expected);
      expect(
        fallbackRecommendation(classifyFallbackReason(c.input)).length,
        `${c.name}-recommendation`,
      ).toBeGreaterThan(0);
    }
  });
});
