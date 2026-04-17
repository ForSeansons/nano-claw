# NanoClaw Memory/Skill 评估方案（多 LLM + 原则打分 + 聚合）

这份文档对应 `scripts/eval-memory-skill.ts`，用于评估 memory 与 skill 改动在以下方面的前后效果：

- 逻辑正确性
- 可运行与 harness 兼容性
- 轻量化影响（避免过度设计）
- 安全性
- 可维护与可观测性

输出包含：

- 多 LLM 评委打分（可配置模型）
- 每个 principle 的量化分数与理由
- 聚合总分与等级
- CoT 摘要 + Final Justification
- before/after 增量对比

## 一、设计目标

- **轻量**：不引入新依赖，使用 `tsx + fetch + vitest`。
- **可运行**：支持无 API key 的 fallback/mock 模式，流程不断。
- **可量化**：客观指标 + 主观评委打分结合。
- **兼容现有 harness**：不改主执行路径，不侵入 `src/` 运行时。

## 二、评估原则与权重

默认 5 个原则（见 `scripts/eval-core.ts`）：

1. `logic-correctness`（0.28）
2. `runtime-compatibility`（0.24）
3. `lightweight-impact`（0.18）
4. `security-safety`（0.18）
5. `maintainability-observability`（0.12）

每个原则分数范围 0-10。部分原则设有 hard gate，例如：

- `logic-correctness` < 6.5 记为 `fail`
- `security-safety` < 6.5 记为 `fail`

## 三、客观指标（自动采集）

脚本会自动统计并作为评估输入：

- `buildPassed`：`npm run build` 是否通过
- `testsPassed`：`npm run test` 是否通过
- `retrievalTestsPassed`：`tests/memory-retrieval.test.ts`
- `skillTestsPassed`：`tests/skill-extraction.test.ts`
- `totalTests` / `passedTests`
- 变更范围：`memoryFilesChanged`、`skillFilesChanged`、`runnerFilesChanged`、`docsFilesChanged`
- 体量：`netAdditions`、`netDeletions`
- `harnessImpactScore`
- 安全标记：危险权限、shell 执行面、网络调用面

这些指标会计算一个 `objectiveAdjustment`，用于修正总分。

另外，变更统计会自动过滤评估噪声目录（如 `reports/`、`dist/`、`node_modules/`），避免报告文件本身污染 `netAdditions` 与文件计数。

## 四、多 LLM 评委机制

### 1) 默认模型列表

默认 `--judge-models`：

- `openai/gpt-4.1-mini`
- `anthropic/claude-3.5-haiku`
- `google/gemini-2.0-flash-lite`

可通过 `--judge-models a,b,c` 覆盖。

### 2) API 兼容方式

脚本支持两种调用路径：

1. Anthropic 评委（`anthropic/*`）优先走 Anthropic Messages API：
   - `ANTHROPIC_API_KEY`（或 `ANTHROPIC_AUTH_TOKEN`）
   - `ANTHROPIC_BASE_URL`（默认 `https://api.anthropic.com`）

2. 非 Anthropic 评委走 OpenAI-compatible `/chat/completions`：
   - `OPENAI_API_KEY`（或 `OPENROUTER_API_KEY`）
   - `OPENAI_BASE_URL`（默认 `https://openrouter.ai/api/v1`）

如果没有可用 key，会自动降级为 fallback 评委（保留流程可运行）。

脚本支持请求超时参数：

- `--request-timeout-ms`（默认 25000）

超时或网络异常会触发更细粒度的 fallback 建议（如 key 缺失、模型不可用、限流、区域限制、schema 不匹配等）。
若返回 HTML 错页（例如 404 页面），会优先提示 `BASE_URL` 可能配置错误，而不是误判成模型不存在。

### 3) CoT 输出策略

评委输出字段为：

- `cot_summary`（精炼推理摘要，不要求长链路）
- `final_justification`
- `principle_scores[]`（含 score/reasons/evidence）

最终报告会聚合这些摘要，并给出统一结论。

## 五、运行方式

### 1) 快速运行（推荐先 mock）

```bash
npx tsx scripts/eval-memory-skill.ts \
  --scenario memory-skill-after \
  --output reports/eval/memory-skill-after.json \
  --mock-llm
```

### 2) 真实多 LLM 评估

```bash
OPENAI_API_KEY=... \
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
npx tsx scripts/eval-memory-skill.ts \
  --scenario memory-skill-after \
  --output reports/eval/memory-skill-after.json
```

### 3) 带基线对比

```bash
npx tsx scripts/eval-memory-skill.ts \
  --scenario memory-skill-after \
  --baseline reports/eval/memory-skill-before.json \
  --output reports/eval/memory-skill-after.json \
  --report-md reports/eval/memory-skill-after.md \
  --request-timeout-ms 45000
```

## 六、输出产物

默认输出两个文件：

- JSON：`reports/eval/memory-skill-eval.json`
- Markdown：`reports/eval/memory-skill-eval.md`

JSON 中包含：

- `aggregate`：聚合总结果
- `comparison`：前后差异
- `meta`：模型列表、环境、检查日志

Markdown 包含：

- 总分与 PASS/FAIL
- principle 打分表
- 每项打分理由与证据摘要
- 多评委结果
- CoT 摘要 + Final Justification
- 前后对比表

## 七、注意事项

- 该评估器是 **工程评审辅助**，不是绝对裁决。
- 如果处于 fallback/mock 模式，结论可信度会下降，建议补 key 后复跑。
- 为保持 NanoClaw 轻量，本实现没有引入向量库、外部数据库或重型评估框架。
- `PASS` 结论同时依赖 hard gate 与 `build/test` 通过，避免“原则得分看起来高但工程不可运行”的假阳性。
