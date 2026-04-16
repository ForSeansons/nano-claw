import fs from 'fs';
import path from 'path';

import {
  sanitizeSkillName,
  SkillDraftCandidate,
} from './skill-draft-validator.js';
import { saveSkillDraft, SavedSkillDraft } from './skill-draft-store.js';
import { mergeCandidatesIntoExistingSkills } from './skill-incremental-merge.js';

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
  incrementalSkillsDir: string;
  incrementProposalsDir: string;
  minOccurrences: number;
  minSuccessRate: number;
  maxDraftsPerRun: number;
  incrementalMinMatchScore: number;
}

export interface SkillExtractionResult {
  scannedFiles: number;
  intentBuckets: number;
  candidates: number;
  saved: SavedSkillDraft[];
  incremental: {
    matched: number;
    proposed: number;
    merged: number;
  };
}

const DEFAULT_OPTIONS: SkillExtractionOptions = {
  conversationsDir: '/workspace/group/conversations',
  draftsDir: '/home/node/.claude/skills-drafts',
  activeSkillsDir: '/home/node/.claude/skills',
  incrementalSkillsDir: '/home/node/.claude/skills-incremental',
  incrementProposalsDir: '/home/node/.claude/skills-drafts/increment-proposals',
  minOccurrences: 3,
  minSuccessRate: 0.7,
  maxDraftsPerRun: 3,
  incrementalMinMatchScore: 0.3,
};

const HARD_MIN_OCCURRENCES = 3;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 20)
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
          '今天',
          '现在',
          '好的',
          '一下子',
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
    '**result:** success',
    'result: success',
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

// Domain keywords for semantic intent classification.
// Maps a canonical intent label to its trigger tokens.
const INTENT_DOMAINS: Array<{ label: string; tokens: string[] }> = [
  { label: 'reminder-schedule', tokens: ['提醒', '闹钟', 'remind', 'alarm', '设置提醒', '提醒我'] },
  { label: 'todo-planning', tokens: ['待办', '计划', '任务', 'todo', 'plan', '今天要做', '安排'] },
  { label: 'travel-transport', tokens: ['高铁', '火车', '飞机', '出行', 'train', 'flight', '订票', '行程'] },
  { label: 'food-dining', tokens: ['吃', '餐', '午饭', '晚饭', '推荐', 'food', 'lunch', 'dinner', 'restaurant'] },
  { label: 'email-writing', tokens: ['邮件', '邮箱', 'email', 'mail', '回复', '起草', '撰写'] },
  { label: 'document-report', tokens: ['周报', '报告', '文档', 'report', 'document', '总结', '写作'] },
  { label: 'translation', tokens: ['翻译', 'translate', 'translation', '中文', '英文'] },
  { label: 'learning-study', tokens: ['学习', '教程', '课程', 'learn', 'study', '入门', '计划学'] },
  { label: 'health-fitness', tokens: ['健身', '跑步', '运动', '睡眠', 'fitness', 'run', 'sleep', '锻炼'] },
  { label: 'finance-expense', tokens: ['记账', '花费', '支出', '账单', 'expense', 'finance', '记录花'] },
  { label: 'entertainment', tokens: ['电影', '音乐', '游戏', 'movie', 'music', 'game', '推荐电影'] },
  { label: 'news-info', tokens: ['新闻', '资讯', 'news', '最新', '今日', '查一下'] },
  { label: 'gift-shopping', tokens: ['礼物', '购物', '推荐', 'gift', 'shop', '买', '送'] },
  { label: 'tech-dev', tokens: ['代码', '编程', 'code', 'dev', 'bug', '开发', '技术'] },
];

/**
 * Build a semantic intent key from user messages.
 * Uses domain keyword matching for semantic grouping instead of
 * raw token concatenation, so similar conversations map to the same key.
 */
function buildIntentKey(userMessages: string[], toolMentions: string[]): string {
  // Tool mentions are the strongest signal — use directly
  if (toolMentions.length > 0) {
    const mentionFreq = new Map<string, number>();
    for (const mention of toolMentions) {
      mentionFreq.set(mention, (mentionFreq.get(mention) || 0) + 1);
    }
    const topMention = Array.from(mentionFreq.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];
    if (topMention) return `tool-${topMention}`;
  }

  const joined = userMessages.join(' ').toLowerCase();

  // Score each domain by how many of its tokens appear in the conversation
  const scores = INTENT_DOMAINS.map((domain) => {
    const hits = domain.tokens.filter((t) => joined.includes(t)).length;
    return { label: domain.label, hits };
  }).filter((d) => d.hits > 0);

  if (scores.length > 0) {
    scores.sort((a, b) => b.hits - a.hits);
    // Combine top-2 domains when they both score to capture compound intents
    // e.g. "planning + travel" → "todo-planning+travel-transport"
    const top = scores.slice(0, 2).map((d) => d.label);
    return top.join('+');
  }

  // Fallback: top-3 non-trivial tokens from all messages (still better than raw concat)
  const tokens = tokenize(joined);
  if (tokens.length === 0) return 'general-task';
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const fallbackKey = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k)
    .join('-');
  if (!fallbackKey || fallbackKey.length > 48) return 'general-task';
  return sanitizeSkillName(fallbackKey);
}

function buildSkillContent(candidate: SkillDraftCandidate): string {
  const samples = (candidate.userSamples || []).slice(0, 3).map((s) => `- ${s}`);
  const slashName = `/${candidate.name}`;
  const procedures = [
    '1. Confirm the request matches the intent signals below.',
    '2. Reuse the minimal validated workflow for this recurring intent.',
    '3. Return concise results plus key evidence when available.',
  ];

  return `---
name: ${candidate.name}
description: ${candidate.description}
---

# ${slashName} - Auto Extracted Skill

## When to Use

${samples.length > 0 ? samples.join('\n') : '- Use for recurring requests matching this intent.'}

## When NOT to Use

- The request belongs to a different explicit skill category.
- The user asks for unrelated one-off exploration.
- Required context or permissions are missing.

## Input Signals

- intent key: ${candidate.intentKey}
- recurring trajectory count: ${candidate.sourceCount}
- historical success rate: ${candidate.successRate.toFixed(2)}

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

const DOMAIN_LABELS: Record<string, string> = {
  'reminder-schedule': 'reminders and scheduling',
  'todo-planning': 'daily task planning',
  'travel-transport': 'travel and transport booking',
  'food-dining': 'food and dining recommendations',
  'email-writing': 'email drafting and replies',
  'document-report': 'documents and reports',
  'translation': 'translation tasks',
  'learning-study': 'learning plans and study guidance',
  'health-fitness': 'health, fitness and sleep',
  'finance-expense': 'expense tracking and finance',
  'entertainment': 'entertainment recommendations',
  'news-info': 'news and information lookup',
  'gift-shopping': 'gift and shopping recommendations',
  'tech-dev': 'technical and development tasks',
  'general-task': 'general recurring tasks',
};

function draftDescriptionFromIntent(intentKey: string): string {
  const parts = intentKey.split('+');
  const labels = parts
    .map((p) => DOMAIN_LABELS[p] ?? p.replace(/-/g, ' '))
    .join(' + ');
  return `Auto-extracted recurring workflow for: ${labels}. Use when the user request matches this recurring pattern.`;
}

function chooseDraftName(intent: IntentStats): string {
  const topMention = Array.from(intent.toolMentions.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  if (topMention) {
    return sanitizeSkillName(`auto-${topMention}-workflow`);
  }

  // intentKey is already semantic (e.g. "reminder-schedule+todo-planning")
  // Strip "+" for name safety, keep it readable
  if (intent.key === 'general-task') {
    return 'auto-recurring-workflow';
  }
  const namePart = intent.key.replace(/\+/g, '-');
  return sanitizeSkillName(`auto-${namePart}-workflow`);
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
  const minOccurrences = Math.max(config.minOccurrences, HARD_MIN_OCCURRENCES);

  const candidates: SkillDraftCandidate[] = [];
  for (const intent of intents.values()) {
    const successRate = intent.count > 0 ? intent.successCount / intent.count : 0;
    if (intent.count < minOccurrences) continue;
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

  let incrementalResult = {
    matched: 0,
    proposed: 0,
    merged: 0,
  };

  if (uniqueCandidates.length > 0) {
    incrementalResult = mergeCandidatesIntoExistingSkills(uniqueCandidates, {
      activeSkillsDir: config.activeSkillsDir,
      incrementalSkillsDir: config.incrementalSkillsDir,
      proposalsDir: config.incrementProposalsDir,
      minMatchScore: config.incrementalMinMatchScore,
    });
  }

  const saved: SavedSkillDraft[] = [];
  for (const candidate of uniqueCandidates) {
    const savedDraft = saveSkillDraft(candidate, {
      draftsDir: config.draftsDir,
      activeSkillsDir: config.activeSkillsDir,
      referenceSkillDirs: [config.incrementalSkillsDir],
    });
    if (savedDraft) saved.push(savedDraft);
  }

  return {
    scannedFiles,
    intentBuckets: intents.size,
    candidates: candidates.length,
    saved,
    incremental: incrementalResult,
  };
}
