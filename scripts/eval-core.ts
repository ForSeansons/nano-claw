import fs from 'fs';
import path from 'path';

export interface PrincipleConfig {
  id: string;
  name: string;
  description: string;
  weight: number;
  hardGate?: {
    minScore: number;
    severity: 'warn' | 'fail';
  };
}

export interface ObjectiveMetrics {
  buildPassed: boolean;
  testsPassed: boolean;
  retrievalTestsPassed: boolean;
  skillTestsPassed: boolean;
  totalTests: number;
  passedTests: number;
  memoryFilesChanged: number;
  skillFilesChanged: number;
  runnerFilesChanged: number;
  docsFilesChanged: number;
  netAdditions: number;
  netDeletions: number;
  harnessImpactScore: number;
  securityFlags: {
    dangerousPermissionBypass: boolean;
    newShellExecSurface: boolean;
    newNetworkCallSurface: boolean;
  };
}

export interface PrincipleScore {
  principleId: string;
  score: number; // 0-10
  reasons: string[];
  evidence: string[];
}

export interface LlmJudgeEvaluation {
  judgeId: string;
  model: string;
  provider: string;
  cotSummary: string;
  finalJustification: string;
  principleScores: PrincipleScore[];
  overallScore: number; // 0-10
  risks: string[];
  recommendations: string[];
}

export interface AggregatedPrincipleResult {
  principleId: string;
  name: string;
  weight: number;
  meanScore: number;
  stdevScore: number;
  weightedScore: number;
  reasons: string[];
  evidence: string[];
}

export interface EvalAggregateResult {
  timestamp: string;
  scenario: string;
  objectiveMetrics: ObjectiveMetrics;
  judges: LlmJudgeEvaluation[];
  principles: AggregatedPrincipleResult[];
  objectiveAdjustment: number;
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  pass: boolean;
  cotSummary: string;
  finalJustification: string;
  criticalFindings: string[];
}

export interface BaselineComparisonInput {
  before?: EvalAggregateResult;
  after: EvalAggregateResult;
}

export interface BaselineComparisonResult {
  totalDelta: number;
  principleDeltas: Array<{
    principleId: string;
    name: string;
    delta: number;
    beforeScore: number;
    afterScore: number;
  }>;
  objectiveDelta: number;
  summary: string;
}

export const DEFAULT_PRINCIPLES: PrincipleConfig[] = [
  {
    id: 'logic-correctness',
    name: '逻辑正确性',
    description:
      'memory/skill 路径是否符合现有架构，是否能正确处理边界输入并避免明显错误。',
    weight: 0.28,
    hardGate: { minScore: 6.5, severity: 'fail' },
  },
  {
    id: 'runtime-compatibility',
    name: '可运行与兼容性',
    description:
      '是否保持 NanoClaw 现有 harness、测试、构建和容器执行链路不被破坏。',
    weight: 0.24,
    hardGate: { minScore: 6.0, severity: 'fail' },
  },
  {
    id: 'lightweight-impact',
    name: '轻量化影响',
    description:
      '新增复杂度和体量是否受控，是否避免过度设计和过多依赖。',
    weight: 0.18,
    hardGate: { minScore: 5.5, severity: 'warn' },
  },
  {
    id: 'security-safety',
    name: '安全性',
    description:
      '是否引入新的权限放大、危险执行面、未受控外部调用等安全风险。',
    weight: 0.18,
    hardGate: { minScore: 6.5, severity: 'fail' },
  },
  {
    id: 'maintainability-observability',
    name: '可维护与可观测性',
    description:
      '是否具备测试、诊断输出、文档与后续迭代可维护性。',
    weight: 0.12,
    hardGate: { minScore: 5.0, severity: 'warn' },
  },
];

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 10) return 10;
  return Number(score.toFixed(2));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function uniq(strings: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of strings) {
    const trimmed = s.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function computeObjectiveAdjustment(metrics: ObjectiveMetrics): number {
  let adjustment = 0;

  if (metrics.buildPassed) adjustment += 0.25;
  else adjustment -= 0.8;

  if (metrics.testsPassed) adjustment += 0.35;
  else adjustment -= 0.9;

  if (metrics.totalTests > 0) {
    const passRate = metrics.passedTests / metrics.totalTests;
    adjustment += (passRate - 0.7) * 0.8;
  }

  adjustment -= Math.min(1.2, metrics.harnessImpactScore * 0.3);

  if (metrics.securityFlags.newShellExecSurface) adjustment -= 0.5;
  if (metrics.securityFlags.newNetworkCallSurface) adjustment -= 0.5;
  if (metrics.securityFlags.dangerousPermissionBypass) adjustment -= 0.9;

  const scaleDelta = Math.max(0, metrics.netAdditions - 1200);
  adjustment -= Math.min(0.8, scaleDelta / 4000);

  return Number(adjustment.toFixed(2));
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 8.8) return 'A';
  if (score >= 7.6) return 'B';
  if (score >= 6.4) return 'C';
  if (score >= 5.2) return 'D';
  return 'F';
}

export function aggregateEvaluations(input: {
  scenario: string;
  principles?: PrincipleConfig[];
  objectiveMetrics: ObjectiveMetrics;
  judges: LlmJudgeEvaluation[];
}): EvalAggregateResult {
  const principles = input.principles || DEFAULT_PRINCIPLES;

  const principleResults: AggregatedPrincipleResult[] = principles.map((p) => {
    const scores: number[] = [];
    const reasons: string[] = [];
    const evidence: string[] = [];

    for (const judge of input.judges) {
      const ps = judge.principleScores.find((s) => s.principleId === p.id);
      if (!ps) continue;
      scores.push(clampScore(ps.score));
      reasons.push(...ps.reasons);
      evidence.push(...ps.evidence);
    }

    const meanScore = clampScore(mean(scores));
    return {
      principleId: p.id,
      name: p.name,
      weight: p.weight,
      meanScore,
      stdevScore: Number(stdev(scores).toFixed(3)),
      weightedScore: Number((meanScore * p.weight).toFixed(3)),
      reasons: uniq(reasons).slice(0, 6),
      evidence: uniq(evidence).slice(0, 8),
    };
  });

  const weightedBase = principleResults.reduce(
    (acc, p) => acc + p.weightedScore,
    0,
  );

  const objectiveAdjustment = computeObjectiveAdjustment(input.objectiveMetrics);
  const totalScore = clampScore(weightedBase + objectiveAdjustment);

  const criticalFindings: string[] = [];
  for (const p of principles) {
    const result = principleResults.find((r) => r.principleId === p.id);
    if (!result || !p.hardGate) continue;
    if (result.meanScore < p.hardGate.minScore) {
      criticalFindings.push(
        `[${p.name}] ${result.meanScore.toFixed(2)} < gate ${p.hardGate.minScore.toFixed(2)} (${p.hardGate.severity})`,
      );
    }
  }

  if (!input.objectiveMetrics.buildPassed) {
    criticalFindings.push('构建未通过');
  }
  if (!input.objectiveMetrics.testsPassed) {
    criticalFindings.push('测试未全部通过');
  }

  const hardGatePass = criticalFindings.every((f) => !f.includes('(fail)'));
  const pass =
    hardGatePass &&
    input.objectiveMetrics.buildPassed &&
    input.objectiveMetrics.testsPassed;

  const cotSummaryParts: string[] = [];
  cotSummaryParts.push(
    `评估场景: ${input.scenario}; 评委数: ${input.judges.length}; 加权基础分: ${weightedBase.toFixed(2)}; 客观调整: ${objectiveAdjustment.toFixed(2)}。`,
  );
  if (criticalFindings.length > 0) {
    cotSummaryParts.push(`关键门槛发现: ${criticalFindings.join('；')}。`);
  } else {
    cotSummaryParts.push('所有硬门槛均通过。');
  }

  const topWeak = [...principleResults]
    .sort((a, b) => a.meanScore - b.meanScore)
    .slice(0, 2)
    .map((p) => `${p.name}:${p.meanScore.toFixed(2)}`)
    .join(', ');
  cotSummaryParts.push(`相对薄弱项: ${topWeak || '无'}`);

  const finalJustification = pass
    ? `综合评分 ${totalScore.toFixed(2)}/10（${gradeFromScore(totalScore)}），满足可运行与安全底线，建议继续小步迭代。`
    : `综合评分 ${totalScore.toFixed(2)}/10（${gradeFromScore(totalScore)}），存在 fail 级门槛问题，需先修复再推广。`;

  return {
    timestamp: new Date().toISOString(),
    scenario: input.scenario,
    objectiveMetrics: input.objectiveMetrics,
    judges: input.judges,
    principles: principleResults,
    objectiveAdjustment,
    totalScore,
    grade: gradeFromScore(totalScore),
    pass,
    cotSummary: cotSummaryParts.join(' '),
    finalJustification,
    criticalFindings,
  };
}

export function compareBeforeAfter(
  input: BaselineComparisonInput,
): BaselineComparisonResult {
  if (!input.before) {
    return {
      totalDelta: 0,
      principleDeltas: input.after.principles.map((p) => ({
        principleId: p.principleId,
        name: p.name,
        delta: 0,
        beforeScore: p.meanScore,
        afterScore: p.meanScore,
      })),
      objectiveDelta: 0,
      summary: '未提供 before 基线，无法计算增量。',
    };
  }

  const principleDeltas = input.after.principles.map((afterP) => {
    const beforeP = input.before!.principles.find(
      (p) => p.principleId === afterP.principleId,
    );
    const beforeScore = beforeP?.meanScore ?? 0;
    const delta = Number((afterP.meanScore - beforeScore).toFixed(2));
    return {
      principleId: afterP.principleId,
      name: afterP.name,
      delta,
      beforeScore,
      afterScore: afterP.meanScore,
    };
  });

  const totalDelta = Number((input.after.totalScore - input.before.totalScore).toFixed(2));
  const objectiveDelta = Number(
    (
      input.after.objectiveAdjustment -
      input.before.objectiveAdjustment
    ).toFixed(2),
  );

  const improved = principleDeltas.filter((p) => p.delta > 0).length;
  const regressed = principleDeltas.filter((p) => p.delta < 0).length;

  const summary =
    totalDelta >= 0
      ? `相对基线总分提升 ${totalDelta.toFixed(2)}，改善项 ${improved}，退化项 ${regressed}。`
      : `相对基线总分下降 ${Math.abs(totalDelta).toFixed(2)}，改善项 ${improved}，退化项 ${regressed}。`;

  return {
    totalDelta,
    principleDeltas,
    objectiveDelta,
    summary,
  };
}

export function writeEvalReport(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

export function writeTextReport(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf-8');
}

export function loadEvalReport(filePath: string): EvalAggregateResult | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    if (!data || typeof data !== 'object') return null;

    // Accept both plain aggregate report and wrapped payload { aggregate, ... }.
    const maybe = data as Record<string, unknown>;
    const candidate =
      maybe.aggregate && typeof maybe.aggregate === 'object'
        ? (maybe.aggregate as Record<string, unknown>)
        : maybe;

    if (
      !candidate ||
      typeof candidate.totalScore !== 'number' ||
      !Array.isArray(candidate.principles)
    ) {
      return null;
    }
    return candidate as unknown as EvalAggregateResult;
  } catch {
    return null;
  }
}

export function formatHumanSummary(result: EvalAggregateResult): string {
  const lines: string[] = [];
  lines.push('=== NanoClaw Memory/Skill Eval Summary ===');
  lines.push(`场景: ${result.scenario}`);
  lines.push(`总分: ${result.totalScore.toFixed(2)}/10 (${result.grade})`);
  lines.push(`是否通过: ${result.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`客观调整: ${result.objectiveAdjustment.toFixed(2)}`);
  lines.push('原则得分:');
  for (const p of result.principles) {
    lines.push(
      `- ${p.name}: ${p.meanScore.toFixed(2)} (w=${p.weight.toFixed(2)}, stdev=${p.stdevScore.toFixed(2)})`,
    );
  }
  if (result.criticalFindings.length > 0) {
    lines.push('关键发现:');
    for (const item of result.criticalFindings) {
      lines.push(`- ${item}`);
    }
  }
  lines.push(`CoT 摘要: ${result.cotSummary}`);
  lines.push(`Final Justification: ${result.finalJustification}`);
  return lines.join('\n');
}
