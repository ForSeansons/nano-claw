import { describe, expect, it } from 'vitest';

import {
  aggregateEvaluations,
  compareBeforeAfter,
  DEFAULT_PRINCIPLES,
  loadEvalReport,
  writeEvalReport,
  type LlmJudgeEvaluation,
  type ObjectiveMetrics,
} from '../scripts/eval-core.js';

function buildObjective(overrides?: Partial<ObjectiveMetrics>): ObjectiveMetrics {
  return {
    buildPassed: true,
    testsPassed: true,
    retrievalTestsPassed: true,
    skillTestsPassed: true,
    totalTests: 20,
    passedTests: 20,
    memoryFilesChanged: 3,
    skillFilesChanged: 4,
    runnerFilesChanged: 2,
    docsFilesChanged: 2,
    netAdditions: 300,
    netDeletions: 120,
    harnessImpactScore: 1.2,
    securityFlags: {
      dangerousPermissionBypass: false,
      newShellExecSurface: false,
      newNetworkCallSurface: false,
    },
    ...overrides,
  };
}

function buildJudge(judgeId: string, scoreBase = 8): LlmJudgeEvaluation {
  return {
    judgeId,
    model: 'mock-model',
    provider: 'mock',
    cotSummary: 'summary',
    finalJustification: 'final',
    overallScore: scoreBase,
    risks: [],
    recommendations: [],
    principleScores: DEFAULT_PRINCIPLES.map((p, i) => ({
      principleId: p.id,
      score: scoreBase - i * 0.2,
      reasons: [`${p.name} reason-1`, `${p.name} reason-2`],
      evidence: [`${p.name} evidence`],
    })),
  };
}

describe('eval-core aggregate', () => {
  it('aggregates multi-judge scores with objective adjustment', () => {
    const result = aggregateEvaluations({
      scenario: 'test-scenario',
      objectiveMetrics: buildObjective(),
      judges: [buildJudge('judge-1', 8.4), buildJudge('judge-2', 8.0)],
    });

    expect(result.totalScore).toBeGreaterThan(7.5);
    expect(result.pass).toBe(true);
    expect(result.principles).toHaveLength(DEFAULT_PRINCIPLES.length);
    expect(result.criticalFindings.length).toBe(0);
  });

  it('fails when hard gate principle score drops below threshold', () => {
    const lowJudge = buildJudge('judge-low', 5.2);
    lowJudge.principleScores = lowJudge.principleScores.map((p) =>
      p.principleId === 'security-safety' ? { ...p, score: 4.8 } : p,
    );

    const result = aggregateEvaluations({
      scenario: 'gate-fail',
      objectiveMetrics: buildObjective(),
      judges: [lowJudge],
    });

    expect(result.pass).toBe(false);
    expect(result.criticalFindings.some((f) => f.includes('安全性'))).toBe(true);
  });

  it('fails when build check fails even if principle scores look good', () => {
    const result = aggregateEvaluations({
      scenario: 'build-fail',
      objectiveMetrics: buildObjective({
        buildPassed: false,
      }),
      judges: [buildJudge('judge-1', 8.2)],
    });

    expect(result.pass).toBe(false);
    expect(result.criticalFindings).toContain('构建未通过');
  });

  it('fails when test check fails even if principle scores look good', () => {
    const result = aggregateEvaluations({
      scenario: 'test-fail',
      objectiveMetrics: buildObjective({
        testsPassed: false,
      }),
      judges: [buildJudge('judge-1', 8.2)],
    });

    expect(result.pass).toBe(false);
    expect(result.criticalFindings).toContain('测试未全部通过');
  });

  it('compares before/after deltas correctly', () => {
    const before = aggregateEvaluations({
      scenario: 'before',
      objectiveMetrics: buildObjective({
        buildPassed: true,
        testsPassed: true,
      }),
      judges: [buildJudge('judge-before', 7.4)],
    });

    const after = aggregateEvaluations({
      scenario: 'after',
      objectiveMetrics: buildObjective({
        buildPassed: true,
        testsPassed: true,
      }),
      judges: [buildJudge('judge-after', 8.3)],
    });

    const delta = compareBeforeAfter({ before, after });
    expect(delta.totalDelta).toBeGreaterThan(0);
    expect(delta.principleDeltas).toHaveLength(DEFAULT_PRINCIPLES.length);
  });

  it('loads wrapped report payload via loadEvalReport', () => {
    const aggregate = aggregateEvaluations({
      scenario: 'wrapped-load',
      objectiveMetrics: buildObjective(),
      judges: [buildJudge('judge-1', 8.0)],
    });

    const tmp = `/tmp/nanoclaw-eval-${Date.now()}.json`;
    writeEvalReport(tmp, {
      aggregate,
      meta: { note: 'wrapped payload' },
    });

    const loaded = loadEvalReport(tmp);
    expect(loaded).not.toBeNull();
    expect(loaded!.scenario).toBe('wrapped-load');
  });
});
