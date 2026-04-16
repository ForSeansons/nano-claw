import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildMemoryContext,
  loadMemoryContextFromFs,
} from '../container/agent-runner/src/memory-retrieval.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('memory-retrieval (non-vector)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses full global memory when content is below threshold', () => {
    const global = '# Preferences\nI like concise answers.';
    const ctx = buildMemoryContext({
      prompt: 'please answer concisely',
      globalClaudeMd: global,
      episodicEntries: [],
      options: {
        fullGlobalThresholdChars: 5000,
      },
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.diagnostics.mode).toBe('full');
    expect(ctx!.append).toContain('I like concise answers');
  });

  it('retrieves relevant semantic sections when global memory is large', () => {
    const sections = [
      '# Preferences\nAlways reply in Chinese.\n',
      '# Taxes\n2024 tax filing detail and deduction notes.\n',
      '# Food\nDinner plan: noodles and soup.\n',
      '# Fitness\nMorning run target is 5km.\n',
    ];
    const global = sections.join('\n');

    const ctx = buildMemoryContext({
      prompt: '今晚晚餐吃什么？',
      globalClaudeMd: global.repeat(200), // force above threshold
      episodicEntries: [],
      options: {
        fullGlobalThresholdChars: 1500,
        semanticTopK: 2,
      },
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.diagnostics.mode).toBe('retrieved');
    expect(ctx!.append).toContain('Global Memory (Retrieved)');
  });

  it('includes episodic recall snippets based on overlap + recency', () => {
    const ctx = buildMemoryContext({
      prompt: '回顾一下上次关于销售复盘的讨论',
      globalClaudeMd: '',
      episodicEntries: [
        {
          id: '2026-04-01-sales-retro.md',
          content: 'We discussed sales retro and conversion funnel changes.',
          date: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          id: '2025-09-01-garden.md',
          content: 'Random unrelated gardening notes.',
          date: new Date('2025-09-01T00:00:00.000Z'),
        },
      ],
      options: {
        episodicTopK: 1,
      },
      now: new Date('2026-04-16T00:00:00.000Z'),
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.append).toContain('Episodic Recall');
    expect(ctx!.append).toContain('sales-retro');
  });

  it('can disable retrieval via env flag', () => {
    const tmp = makeTempDir('nanoclaw-memory-');
    dirs.push(tmp);
    const globalPath = path.join(tmp, 'CLAUDE.md');
    const episodicDir = path.join(tmp, 'conversations');
    fs.mkdirSync(episodicDir, { recursive: true });

    fs.writeFileSync(globalPath, '# Global\nRemember timezone is Asia/Shanghai\n');
    fs.writeFileSync(
      path.join(episodicDir, '2026-04-10-briefing.md'),
      'Weekly briefing about AI trends and product updates.\n',
    );

    const enabled = loadMemoryContextFromFs({
      prompt: 'timezone是什么',
      isMain: false,
      globalClaudeMdPath: globalPath,
      episodicDir,
      env: {
        NANOCLAW_MEMORY_RETRIEVAL_ENABLED: '1',
      },
    });
    expect(enabled).not.toBeNull();

    const disabled = loadMemoryContextFromFs({
      prompt: 'timezone是什么',
      isMain: false,
      globalClaudeMdPath: globalPath,
      episodicDir,
      env: {
        NANOCLAW_MEMORY_RETRIEVAL_ENABLED: '0',
      },
    });
    expect(disabled).toBeNull();
  });
});
