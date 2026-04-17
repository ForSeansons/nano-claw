#!/usr/bin/env tsx
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  DEFAULT_PRINCIPLES,
  aggregateEvaluations,
  compareBeforeAfter,
  formatHumanSummary,
  loadEvalReport,
  writeTextReport,
  type EvalAggregateResult,
  type LlmJudgeEvaluation,
  type ObjectiveMetrics,
  type PrincipleConfig,
  type PrincipleScore,
  writeEvalReport,
} from './eval-core.js';

interface CliArgs {
  scenario: string;
  baseline?: string;
  output: string;
  reportMd?: string;
  runChecks: boolean;
  mockLlm: boolean;
  judgeModels: string[];
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
}

interface GitDiffStats {
  changedFiles: string[];
  untrackedFiles: string[];
  netAdditions: number;
  netDeletions: number;
}

interface OpenAiLikeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiLikeResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface AnthropicMessagesResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

const DIFF_EXCLUDE_PREFIXES = [
  'reports/',
  'dist/',
  'node_modules/',
  'coverage/',
  '.git/',
  '.swarm/',
];

const DIFF_EXCLUDE_EXACT = new Set(['.DS_Store']);

type FallbackReasonCode =
  | 'missing-key'
  | 'timeout'
  | 'rate-limit'
  | 'model-not-found'
  | 'base-url'
  | 'auth'
  | 'region'
  | 'network'
  | 'schema'
  | 'unknown';

export function normalizePath(filePath: string): string {
  return filePath.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

export function shouldIgnoreDiffPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (!normalized) return true;
  if (DIFF_EXCLUDE_EXACT.has(normalized)) return true;
  if (normalized.endsWith('/.DS_Store')) return true;
  return DIFF_EXCLUDE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    scenario: 'memory-skill-after',
    output: path.join('reports', 'eval', 'memory-skill-eval.json'),
    runChecks: true,
    mockLlm: false,
    judgeModels: [
      'openai/gpt-4.1-mini',
      'anthropic/claude-3.5-haiku',
      'google/gemini-2.0-flash-lite',
    ],
    maxTokens: 1800,
    temperature: 0.2,
    requestTimeoutMs: 25_000,
  };

  const args = [...argv];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scenario' && args[i + 1]) {
      defaults.scenario = args[++i];
      continue;
    }
    if (arg === '--baseline' && args[i + 1]) {
      defaults.baseline = args[++i];
      continue;
    }
    if (arg === '--output' && args[i + 1]) {
      defaults.output = args[++i];
      continue;
    }
    if (arg === '--report-md' && args[i + 1]) {
      defaults.reportMd = args[++i];
      continue;
    }
    if (arg === '--skip-checks') {
      defaults.runChecks = false;
      continue;
    }
    if (arg === '--mock-llm') {
      defaults.mockLlm = true;
      continue;
    }
    if (arg === '--judge-models' && args[i + 1]) {
      defaults.judgeModels = args[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === '--max-tokens' && args[i + 1]) {
      const parsed = Number.parseInt(args[++i], 10);
      if (Number.isFinite(parsed) && parsed > 100) {
        defaults.maxTokens = parsed;
      }
      continue;
    }
    if (arg === '--temperature' && args[i + 1]) {
      const parsed = Number.parseFloat(args[++i]);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1.5) {
        defaults.temperature = parsed;
      }
      continue;
    }
    if (arg === '--request-timeout-ms' && args[i + 1]) {
      const parsed = Number.parseInt(args[++i], 10);
      if (Number.isFinite(parsed) && parsed >= 3_000) {
        defaults.requestTimeoutMs = parsed;
      }
      continue;
    }
  }

  return defaults;
}

function runCmd(cmd: string, fallback = ''): string {
  try {
    return execSync(cmd, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    }).trim();
  } catch {
    return fallback;
  }
}

function collectGitDiffStats(): GitDiffStats {
  const filesRaw = runCmd('git diff --name-only HEAD', '');
  const trackedChangedFiles = filesRaw
    .split('\n')
    .map((s) => normalizePath(s))
    .filter(Boolean);
  const untrackedRaw = runCmd('git ls-files --others --exclude-standard', '');
  const untrackedFiles = untrackedRaw
    .split('\n')
    .map((s) => normalizePath(s))
    .filter(Boolean);

  const changedFiles = Array.from(
    new Set([...trackedChangedFiles, ...untrackedFiles]),
  ).filter((file) => !shouldIgnoreDiffPath(file));

  const scopedUntrackedFiles = untrackedFiles.filter((file) => !shouldIgnoreDiffPath(file));

  const numstatRaw = runCmd('git diff --numstat HEAD', '');
  let netAdditions = 0;
  let netDeletions = 0;
  for (const line of numstatRaw.split('\n')) {
    if (!line.trim()) continue;
    const [adds, dels, rawPath] = line.split('\t');
    const filePath = normalizePath(rawPath || '');
    if (shouldIgnoreDiffPath(filePath)) continue;
    const a = Number.parseInt(adds || '0', 10);
    const d = Number.parseInt(dels || '0', 10);
    if (Number.isFinite(a)) netAdditions += a;
    if (Number.isFinite(d)) netDeletions += d;
  }

  for (const file of scopedUntrackedFiles) {
    try {
      const fullPath = path.resolve(file);
      if (!fs.existsSync(fullPath)) continue;
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lineCount = content.length === 0 ? 0 : content.split('\n').length;
      netAdditions += lineCount;
    } catch {
      // Ignore unreadable/unicode/binary files.
    }
  }

  return {
    changedFiles,
    untrackedFiles: scopedUntrackedFiles,
    netAdditions,
    netDeletions,
  };
}

function countByPrefix(files: string[], prefix: string): number {
  return files.filter((f) => f.startsWith(prefix)).length;
}

export function isMemoryPath(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  if (!normalized) return false;
  if (normalized === 'memory.md') return true;
  if (normalized === 'dreams.md') return true;
  if (normalized.startsWith('memory/')) return true;
  if (normalized.includes('/memory/')) return true;
  if (normalized.includes('memory-retrieval')) return true;
  if (normalized.startsWith('docs/memory')) return true;
  return false;
}

export function isSkillPath(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('container/skills/')) return true;
  if (normalized.includes('/skills/')) return true;
  if (normalized.includes('skill-extraction')) return true;
  if (normalized.includes('skill-incremental-merge')) return true;
  if (normalized.includes('skill-draft')) return true;
  if (normalized.startsWith('docs/skill')) return true;
  if (normalized.includes('skill-routing')) return true;
  if (normalized === 'vitest.skills.config.ts') return true;
  return false;
}

function detectSecurityFlags(diff: GitDiffStats): ObjectiveMetrics['securityFlags'] {
  const patch = runCmd('git diff --no-color HEAD', '');
  const dangerousPermissionBypass =
    /^\+.*permissionMode:\s*['"]bypassPermissions['"]/m.test(patch) ||
    /^\+.*allowDangerouslySkipPermissions:\s*true/m.test(patch);

  const runtimeUntracked = diff.untrackedFiles
    .filter((f) => f.startsWith('src/') || f.startsWith('container/'))
    .map((file) => {
      try {
        return fs.readFileSync(path.resolve(file), 'utf-8');
      } catch {
        return '';
      }
    })
    .join('\n');

  const shellPattern =
    /(^\+.*\b(execSync|execFile|spawn|spawnSync)\()|(^\+.*from ['"]child_process['"])/m;
  const networkPattern =
    /(^\+.*\bfetch\()|(^\+.*from ['"]node:https['"])|(^\+.*from ['"]node:http['"])/m;

  const newShellExecSurface =
    shellPattern.test(patch) ||
    /\b(execSync|execFile|spawn|spawnSync)\(/.test(runtimeUntracked);
  const newNetworkCallSurface =
    networkPattern.test(patch) || /\bfetch\(/.test(runtimeUntracked);

  return {
    dangerousPermissionBypass,
    newShellExecSurface,
    newNetworkCallSurface,
  };
}

function parseVitestSummary(output: string): {
  total: number;
  passed: number;
  ok: boolean;
} {
  const totalMatch = output.match(/Tests\s+\d+\s+passed\s*\((\d+)\)/i);
  const passedMatch = output.match(/Tests\s+(\d+)\s+passed/i);
  const ok = /\bpassed\b/i.test(output) && !/\bfailed\b/i.test(output);

  const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
  const passed = passedMatch ? Number.parseInt(passedMatch[1], 10) : total;

  return {
    total: Number.isFinite(total) ? total : 0,
    passed: Number.isFinite(passed) ? passed : 0,
    ok,
  };
}

function runObjectiveChecks(runChecks: boolean): {
  buildPassed: boolean;
  testsPassed: boolean;
  retrievalTestsPassed: boolean;
  skillTestsPassed: boolean;
  totalTests: number;
  passedTests: number;
  checkLogs: string[];
} {
  if (!runChecks) {
    return {
      buildPassed: false,
      testsPassed: false,
      retrievalTestsPassed: false,
      skillTestsPassed: false,
      totalTests: 0,
      passedTests: 0,
      checkLogs: ['跳过客观检查（--skip-checks）'],
    };
  }

  const checkLogs: string[] = [];
  let buildPassed = false;
  let testsPassed = false;
  let retrievalTestsPassed = false;
  let skillTestsPassed = false;
  let totalTests = 0;
  let passedTests = 0;

  try {
    execSync('npm run -s build', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    });
    buildPassed = true;
    checkLogs.push('build: pass');
  } catch (err) {
    const stderr =
      err && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr?: string }).stderr || '')
        : '';
    checkLogs.push(`build: fail ${stderr.slice(0, 300)}`.trim());
  }

  try {
    const allOutput = execSync('npm run -s test', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    });
    const summary = parseVitestSummary(allOutput);
    testsPassed = summary.ok;
    totalTests = summary.total;
    passedTests = summary.passed;
    checkLogs.push(`test(all): ${summary.ok ? 'pass' : 'fail'} (${summary.passed}/${summary.total})`);
  } catch (err) {
    const stdout =
      err && typeof err === 'object' && 'stdout' in err
        ? String((err as { stdout?: string }).stdout || '')
        : '';
    const summary = parseVitestSummary(stdout);
    testsPassed = false;
    totalTests = summary.total;
    passedTests = summary.passed;
    checkLogs.push(`test(all): fail (${summary.passed}/${summary.total})`);
  }

  try {
    execSync('npx vitest run tests/memory-retrieval.test.ts', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    });
    retrievalTestsPassed = true;
    checkLogs.push('test(memory): pass');
  } catch {
    checkLogs.push('test(memory): fail');
  }

  try {
    execSync('npx vitest run tests/skill-extraction.test.ts', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 20,
    });
    skillTestsPassed = true;
    checkLogs.push('test(skill): pass');
  } catch {
    checkLogs.push('test(skill): fail');
  }

  return {
    buildPassed,
    testsPassed,
    retrievalTestsPassed,
    skillTestsPassed,
    totalTests,
    passedTests,
    checkLogs,
  };
}

function buildObjectiveMetrics(args: CliArgs): {
  metrics: ObjectiveMetrics;
  logs: string[];
} {
  const diff = collectGitDiffStats();
  const checks = runObjectiveChecks(args.runChecks);
  const memoryFilesChanged = diff.changedFiles.filter(isMemoryPath).length;

  const skillFilesChanged = diff.changedFiles.filter(isSkillPath).length;

  const runnerFilesChanged = countByPrefix(diff.changedFiles, 'container/agent-runner/');
  const docsFilesChanged = countByPrefix(diff.changedFiles, 'docs/');

  const harnessImpactScore = Number(
    (
      runnerFilesChanged * 0.35 +
      (checks.buildPassed ? 0 : 1.2) +
      (checks.testsPassed ? 0 : 1.5)
    ).toFixed(2),
  );

  const metrics: ObjectiveMetrics = {
    buildPassed: checks.buildPassed,
    testsPassed: checks.testsPassed,
    retrievalTestsPassed: checks.retrievalTestsPassed,
    skillTestsPassed: checks.skillTestsPassed,
    totalTests: checks.totalTests,
    passedTests: checks.passedTests,
    memoryFilesChanged,
    skillFilesChanged,
    runnerFilesChanged,
    docsFilesChanged,
    netAdditions: diff.netAdditions,
    netDeletions: diff.netDeletions,
    harnessImpactScore,
    securityFlags: detectSecurityFlags(diff),
  };

  const logs: string[] = [
    `changed files: ${diff.changedFiles.length}`,
    `net lines: +${diff.netAdditions}/-${diff.netDeletions}`,
    `filtered paths: exclude ${DIFF_EXCLUDE_PREFIXES.join(', ')}`,
    `memory files changed: ${memoryFilesChanged}`,
    `skill files changed: ${skillFilesChanged}`,
    ...checks.checkLogs,
  ];

  return { metrics, logs };
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function pickEnv(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value) out[key] = value;
  }
  return out;
}

function loadDotEnvIfPresent(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (process.env[key]) continue;

    let value = trimmed.slice(idx + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function toProviderModel(raw: string): { provider: string; model: string } {
  const idx = raw.indexOf('/');
  if (idx === -1) {
    return { provider: 'openai', model: raw };
  }
  return {
    provider: raw.slice(0, idx),
    model: raw.slice(idx + 1),
  };
}

async function openAiLikeChatCompletion(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: OpenAiLikeMessage[];
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<string | null> {
  const url = `${input.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('request timeout'), input.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      String((err as { name?: string }).name) === 'AbortError'
    ) {
      throw new Error(`request timeout after ${input.timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`HTTP ${response.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await response.json()) as OpenAiLikeResponse;
  const content = json.choices?.[0]?.message?.content;
  return content || null;
}

async function anthropicMessagesCompletion(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<string | null> {
  const url = `${input.baseUrl.replace(/\/$/, '')}/v1/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('request timeout'), input.timeoutMs);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        system: input.system,
        messages: [
          {
            role: 'user',
            content: input.user,
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      String((err as { name?: string }).name) === 'AbortError'
    ) {
      throw new Error(`request timeout after ${input.timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`HTTP ${response.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await response.json()) as AnthropicMessagesResponse;
  const text =
    json.content
      ?.filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text || '')
      .join('\n')
      .trim() || null;
  return text;
}

function buildJudgePrompt(input: {
  judgeId: string;
  principles: PrincipleConfig[];
  objective: ObjectiveMetrics;
  scenario: string;
}): { system: string; user: string } {
  const principleLines = input.principles
    .map(
      (p) =>
        `- ${p.id} (${p.name}, weight=${p.weight}): ${p.description}`,
    )
    .join('\n');

  const system = [
    '你是 NanoClaw 代码变更评审员。',
    '只输出 JSON，不要输出多余文本。',
    '你必须给出 0-10 分的量化评分，并给出具体理由和证据。',
    'cot_summary 仅写精炼推理摘要，不要泄露冗长内部思考链条。',
  ].join('\n');

  const user = [
    `场景: ${input.scenario}`,
    '评估维度如下：',
    principleLines,
    '以下是客观指标：',
    JSON.stringify(input.objective, null, 2),
    '请输出 JSON，结构必须为：',
    '{',
    '  "cot_summary": "string",',
    '  "final_justification": "string",',
    '  "overall_score": number,',
    '  "risks": ["..."],',
    '  "recommendations": ["..."],',
    '  "principle_scores": [',
    '    {"principle_id":"...","score":number,"reasons":["..."],"evidence":["..."]}',
    '  ]',
    '}',
    '要求：',
    '1) 每个 principle_id 都必须出现一次。',
    '2) reasons 至少 2 条，evidence 至少 1 条。',
    '3) 分数要和客观指标一致，不能空泛。',
  ].join('\n');

  return { system, user };
}

function fallbackJudgeEvaluation(input: {
  judgeId: string;
  provider: string;
  model: string;
  principles: PrincipleConfig[];
  objective: ObjectiveMetrics;
  reason: string;
}): LlmJudgeEvaluation {
  const base = input.objective.testsPassed && input.objective.buildPassed ? 7.6 : 6.0;
  const reasonCode = classifyFallbackReason(input.reason);
  const rec = fallbackRecommendation(reasonCode);

  const principleScores: PrincipleScore[] = input.principles.map((p, index) => ({
    principleId: p.id,
    score: Number((base - index * 0.18).toFixed(2)),
    reasons: [
      `fallback 估计：${p.name} 受客观指标影响。`,
      `未成功调用外部 LLM，采用启发式评分。`,
    ],
    evidence: [
      `buildPassed=${input.objective.buildPassed}, testsPassed=${input.objective.testsPassed}`,
      `fallback reason=${input.reason}`,
    ],
  }));

  return {
    judgeId: input.judgeId,
    provider: input.provider,
    model: input.model,
    cotSummary: `外部模型不可用，使用 fallback 评分。原因：${input.reason}`,
    finalJustification:
      '该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。',
    overallScore: base,
    risks: ['LLM 评审不可用导致主观判断可信度下降。'],
    recommendations: [rec, '必要时加 --mock-llm 先验证脚本流程，再切回真实评审。'],
    principleScores,
  };
}

export function classifyFallbackReason(reason: string): FallbackReasonCode {
  const text = reason.toLowerCase();
  if (
    text.includes('missing') ||
    text.includes('no key') ||
    text.includes('api_key') ||
    text.includes('auth token')
  ) {
    return 'missing-key';
  }
  if (text.includes('timeout') || text.includes('abort')) return 'timeout';
  if (text.includes('429') || text.includes('rate limit') || text.includes('quota')) {
    return 'rate-limit';
  }
  if (
    text.includes('<!doctype html') ||
    text.includes('<html') ||
    text.includes('/_next/static') ||
    text.includes('unexpected token <')
  ) {
    return 'base-url';
  }
  if (
    text.includes('404') ||
    text.includes('not found') ||
    text.includes('unknown model') ||
    text.includes('model does not exist')
  ) {
    return 'model-not-found';
  }
  if (text.includes('401') || text.includes('403') || text.includes('unauthorized') || text.includes('forbidden')) {
    return 'auth';
  }
  if (
    text.includes('region') ||
    text.includes('country') ||
    text.includes('not supported in your location')
  ) {
    return 'region';
  }
  if (
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('network') ||
    text.includes('fetch failed')
  ) {
    return 'network';
  }
  if (text.includes('invalid json schema') || text.includes('schema')) return 'schema';
  return 'unknown';
}

export function fallbackRecommendation(code: FallbackReasonCode): string {
  switch (code) {
    case 'missing-key':
      return '设置可用 API Key（OPENAI_API_KEY/OPENROUTER_API_KEY 或 ANTHROPIC_API_KEY）后重跑真实评审。';
    case 'timeout':
      return '提高 --request-timeout-ms（如 45000）或更换低延迟模型/网关后重试。';
    case 'rate-limit':
      return '触发限流，建议降低并发、等待重置窗口或切换备用模型。';
    case 'model-not-found':
      return '模型名可能不可用，检查 --judge-models 与网关支持列表是否匹配。';
    case 'base-url':
      return 'API 基地址可能错误，请检查 OPENAI_BASE_URL/OPENROUTER_BASE_URL/ANTHROPIC_BASE_URL 是否指向正确的 API 根路径。';
    case 'auth':
      return '鉴权失败，检查 key 权限范围、base URL、组织配额和请求头配置。';
    case 'region':
      return '区域受限，建议改用可用区域网关或切换到可访问的模型提供方。';
    case 'network':
      return '网络链路异常，检查代理/DNS/TLS 后重试；必要时切换 API 基地址。';
    case 'schema':
      return '评委输出 JSON 结构不稳定，建议降低 temperature 或加强响应格式约束。';
    default:
      return '建议查看失败日志，确认模型可用性与 API 参数后重跑真实评审。';
  }
}

function normalizeJudgeJson(raw: unknown): {
  cot_summary: string;
  final_justification: string;
  overall_score: number;
  risks: string[];
  recommendations: string[];
  principle_scores: Array<{
    principle_id: string;
    score: number;
    reasons: string[];
    evidence: string[];
  }>;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const cot = typeof obj.cot_summary === 'string' ? obj.cot_summary : '';
  const final =
    typeof obj.final_justification === 'string' ? obj.final_justification : '';
  const overall =
    typeof obj.overall_score === 'number'
      ? obj.overall_score
      : Number(obj.overall_score || 0);

  const risks = Array.isArray(obj.risks)
    ? obj.risks.map((v) => String(v))
    : [];
  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations.map((v) => String(v))
    : [];

  const principleScoresRaw = Array.isArray(obj.principle_scores)
    ? obj.principle_scores
    : [];
  const principleScores = principleScoresRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const x = entry as Record<string, unknown>;
      return {
        principle_id:
          typeof x.principle_id === 'string' ? x.principle_id : String(x.principle_id || ''),
        score:
          typeof x.score === 'number' ? x.score : Number.parseFloat(String(x.score || 0)),
        reasons: Array.isArray(x.reasons) ? x.reasons.map((v) => String(v)) : [],
        evidence: Array.isArray(x.evidence) ? x.evidence.map((v) => String(v)) : [],
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  return {
    cot_summary: cot,
    final_justification: final,
    overall_score: Number.isFinite(overall) ? overall : 0,
    risks,
    recommendations,
    principle_scores: principleScores,
  };
}

async function runSingleJudge(input: {
  judgeId: string;
  providerModel: string;
  principles: PrincipleConfig[];
  objective: ObjectiveMetrics;
  scenario: string;
  args: CliArgs;
}): Promise<LlmJudgeEvaluation> {
  const { provider, model } = toProviderModel(input.providerModel);

  if (input.args.mockLlm) {
    return fallbackJudgeEvaluation({
      judgeId: input.judgeId,
      provider,
      model,
      principles: input.principles,
      objective: input.objective,
      reason: 'mock-llm enabled',
    });
  }

  loadDotEnvIfPresent();

  const prompt = buildJudgePrompt({
    judgeId: input.judgeId,
    principles: input.principles,
    objective: input.objective,
    scenario: input.scenario,
  });

  try {
    let content: string | null = null;
    if (provider === 'anthropic') {
      const anthropicApiKey =
        process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
      const anthropicBaseUrl =
        process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
      const openAiApiKey =
        process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '';
      const openAiBaseUrl =
        process.env.OPENAI_BASE_URL ||
        process.env.OPENROUTER_BASE_URL ||
        'https://openrouter.ai/api/v1';

      if (anthropicApiKey) {
        try {
          content = await anthropicMessagesCompletion({
            baseUrl: anthropicBaseUrl,
            apiKey: anthropicApiKey,
            model,
            system: prompt.system,
            user: prompt.user,
            maxTokens: input.args.maxTokens,
            temperature: input.args.temperature,
            timeoutMs: input.args.requestTimeoutMs,
          });
        } catch (err) {
          if (!openAiApiKey) {
            throw err;
          }
          content = await openAiLikeChatCompletion({
            baseUrl: openAiBaseUrl,
            apiKey: openAiApiKey,
            model: `${provider}/${model}`,
            maxTokens: input.args.maxTokens,
            temperature: input.args.temperature,
            timeoutMs: input.args.requestTimeoutMs,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
          });
        }
      } else if (openAiApiKey) {
        content = await openAiLikeChatCompletion({
          baseUrl: openAiBaseUrl,
          apiKey: openAiApiKey,
          model: `${provider}/${model}`,
          maxTokens: input.args.maxTokens,
          temperature: input.args.temperature,
          timeoutMs: input.args.requestTimeoutMs,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        });
      } else {
        throw new Error(
          'no key for anthropic judge (need ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN or OPENAI_API_KEY/OPENROUTER_API_KEY)',
        );
      }
    } else {
      const openAiApiKey =
        process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '';
      const openAiBaseUrl =
        process.env.OPENAI_BASE_URL ||
        process.env.OPENROUTER_BASE_URL ||
        'https://openrouter.ai/api/v1';
      if (!openAiApiKey) {
        throw new Error('OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge');
      }
      content = await openAiLikeChatCompletion({
        baseUrl: openAiBaseUrl,
        apiKey: openAiApiKey,
        model: `${provider}/${model}`,
        maxTokens: input.args.maxTokens,
        temperature: input.args.temperature,
        timeoutMs: input.args.requestTimeoutMs,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      });
    }

    const parsed = safeJsonParse<unknown>(content || '');
    const normalized = normalizeJudgeJson(parsed);
    if (!normalized) {
      throw new Error('invalid JSON schema from judge');
    }

    const principleScores: PrincipleScore[] = input.principles.map((p) => {
      const found = normalized.principle_scores.find((x) => x.principle_id === p.id);
      return {
        principleId: p.id,
        score: found?.score ?? 0,
        reasons:
          found?.reasons.length && found.reasons.length >= 2
            ? found.reasons
            : ['模型输出理由不足，已降级补齐。', '请复跑以获得更稳定理由。'],
        evidence:
          found?.evidence.length && found.evidence.length >= 1
            ? found.evidence
            : ['模型输出证据不足，已降级补齐。'],
      };
    });

    return {
      judgeId: input.judgeId,
      provider,
      model,
      cotSummary: normalized.cot_summary,
      finalJustification: normalized.final_justification,
      overallScore: normalized.overall_score,
      risks: normalized.risks,
      recommendations: normalized.recommendations,
      principleScores,
    };
  } catch (err) {
    return fallbackJudgeEvaluation({
      judgeId: input.judgeId,
      provider,
      model,
      principles: input.principles,
      objective: input.objective,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

function renderMarkdownReport(input: {
  aggregate: EvalAggregateResult;
  comparison: ReturnType<typeof compareBeforeAfter>;
  objectiveLogs: string[];
  outputJsonPath: string;
}): string {
  const { aggregate, comparison, objectiveLogs, outputJsonPath } = input;

  const lines: string[] = [];
  lines.push('# NanoClaw Memory/Skill Eval 报告');
  lines.push('');
  lines.push(`- 时间: ${aggregate.timestamp}`);
  lines.push(`- 场景: ${aggregate.scenario}`);
  lines.push(`- 总分: **${aggregate.totalScore.toFixed(2)}/10 (${aggregate.grade})**`);
  lines.push(`- 结论: **${aggregate.pass ? 'PASS' : 'FAIL'}**`);
  lines.push(`- 报告 JSON: \`${outputJsonPath}\``);
  lines.push('');

  lines.push('## CoT 与结论');
  lines.push('');
  lines.push(`- CoT 摘要: ${aggregate.cotSummary}`);
  lines.push(`- Final Justification: ${aggregate.finalJustification}`);
  lines.push('');

  lines.push('## 量化指标（客观）');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|---|---|');
  lines.push(`| buildPassed | ${aggregate.objectiveMetrics.buildPassed} |`);
  lines.push(`| testsPassed | ${aggregate.objectiveMetrics.testsPassed} |`);
  lines.push(`| retrievalTestsPassed | ${aggregate.objectiveMetrics.retrievalTestsPassed} |`);
  lines.push(`| skillTestsPassed | ${aggregate.objectiveMetrics.skillTestsPassed} |`);
  lines.push(`| totalTests | ${aggregate.objectiveMetrics.totalTests} |`);
  lines.push(`| passedTests | ${aggregate.objectiveMetrics.passedTests} |`);
  lines.push(`| memoryFilesChanged | ${aggregate.objectiveMetrics.memoryFilesChanged} |`);
  lines.push(`| skillFilesChanged | ${aggregate.objectiveMetrics.skillFilesChanged} |`);
  lines.push(`| runnerFilesChanged | ${aggregate.objectiveMetrics.runnerFilesChanged} |`);
  lines.push(`| docsFilesChanged | ${aggregate.objectiveMetrics.docsFilesChanged} |`);
  lines.push(`| netAdditions | ${aggregate.objectiveMetrics.netAdditions} |`);
  lines.push(`| netDeletions | ${aggregate.objectiveMetrics.netDeletions} |`);
  lines.push(`| harnessImpactScore | ${aggregate.objectiveMetrics.harnessImpactScore} |`);
  lines.push(`| objectiveAdjustment | ${aggregate.objectiveAdjustment} |`);
  lines.push('');

  lines.push('客观检查日志：');
  for (const log of objectiveLogs) {
    lines.push(`- ${log}`);
  }
  lines.push('');

  lines.push('## Principle 得分');
  lines.push('');
  lines.push('| Principle | Score | Weight | Weighted | StdDev |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const p of aggregate.principles) {
    lines.push(
      `| ${p.name} | ${p.meanScore.toFixed(2)} | ${p.weight.toFixed(2)} | ${p.weightedScore.toFixed(2)} | ${p.stdevScore.toFixed(2)} |`,
    );
  }
  lines.push('');

  lines.push('### 打分理由摘要');
  lines.push('');
  for (const p of aggregate.principles) {
    lines.push(`- **${p.name}**`);
    for (const reason of p.reasons.slice(0, 3)) {
      lines.push(`  - 理由: ${reason}`);
    }
    for (const ev of p.evidence.slice(0, 2)) {
      lines.push(`  - 证据: ${ev}`);
    }
  }
  lines.push('');

  lines.push('## 多 LLM 评委结果');
  lines.push('');
  for (const judge of aggregate.judges) {
    lines.push(`### ${judge.judgeId} (${judge.provider}/${judge.model})`);
    lines.push(`- overall: ${judge.overallScore.toFixed(2)}`);
    lines.push(`- cot: ${judge.cotSummary}`);
    lines.push(`- final: ${judge.finalJustification}`);
    if (judge.risks.length > 0) {
      lines.push('- risks:');
      for (const risk of judge.risks.slice(0, 3)) {
        lines.push(`  - ${risk}`);
      }
    }
    if (judge.recommendations.length > 0) {
      lines.push('- recommendations:');
      for (const rec of judge.recommendations.slice(0, 3)) {
        lines.push(`  - ${rec}`);
      }
    }
    lines.push('');
  }

  lines.push('## 前后对比');
  lines.push('');
  lines.push(`- 结论: ${comparison.summary}`);
  lines.push(`- 总分变化: ${comparison.totalDelta.toFixed(2)}`);
  lines.push(`- 客观调整变化: ${comparison.objectiveDelta.toFixed(2)}`);
  lines.push('');
  lines.push('| Principle | Before | After | Delta |');
  lines.push('|---|---:|---:|---:|');
  for (const p of comparison.principleDeltas) {
    lines.push(
      `| ${p.name} | ${p.beforeScore.toFixed(2)} | ${p.afterScore.toFixed(2)} | ${p.delta.toFixed(2)} |`,
    );
  }
  lines.push('');

  if (aggregate.criticalFindings.length > 0) {
    lines.push('## 关键风险');
    lines.push('');
    for (const finding of aggregate.criticalFindings) {
      lines.push(`- ${finding}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { metrics, logs } = buildObjectiveMetrics(args);

  const principles = DEFAULT_PRINCIPLES;

  const judges: LlmJudgeEvaluation[] = [];
  for (let i = 0; i < args.judgeModels.length; i++) {
    const providerModel = args.judgeModels[i];
    const judge = await runSingleJudge({
      judgeId: `judge-${i + 1}`,
      providerModel,
      principles,
      objective: metrics,
      scenario: args.scenario,
      args,
    });
    judges.push(judge);
  }

  const aggregate = aggregateEvaluations({
    scenario: args.scenario,
    principles,
    objectiveMetrics: metrics,
    judges,
  });

  const baseline = args.baseline ? loadEvalReport(args.baseline) : null;
  const comparison = compareBeforeAfter({
    before: baseline || undefined,
    after: aggregate,
  });

  const payload = {
    aggregate,
    comparison,
    meta: {
      scenario: args.scenario,
      judgeModels: args.judgeModels,
      runChecks: args.runChecks,
      mockLlm: args.mockLlm,
      requestTimeoutMs: args.requestTimeoutMs,
      envPresent: Object.keys(
        pickEnv([
          'OPENAI_API_KEY',
          'OPENROUTER_API_KEY',
          'OPENAI_BASE_URL',
          'OPENROUTER_BASE_URL',
          'ANTHROPIC_API_KEY',
          'ANTHROPIC_BASE_URL',
          'ANTHROPIC_AUTH_TOKEN',
        ]),
      ),
      objectiveLogs: logs,
    },
  };

  writeEvalReport(args.output, payload);

  const reportMdPath =
    args.reportMd || args.output.replace(/\.json$/i, '.md');
  const reportMd = renderMarkdownReport({
    aggregate,
    comparison,
    objectiveLogs: logs,
    outputJsonPath: args.output,
  });
  writeTextReport(reportMdPath, reportMd);

  console.log(formatHumanSummary(aggregate));
  console.log(`\nReport JSON: ${args.output}`);
  console.log(`Report MD: ${reportMdPath}`);
}

const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryFile === thisFile) {
  main().catch((err) => {
    const message = err instanceof Error ? err.stack || err.message : String(err);
    console.error(`[eval-memory-skill] fatal: ${message}`);
    process.exit(1);
  });
}
