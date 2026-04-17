# NanoClaw Memory/Skill Eval 报告

- 时间: 2026-04-17T03:53:47.169Z
- 场景: memory-skill-no-key-check2
- 总分: **3.01/10 (F)**
- 结论: **FAIL**
- 报告 JSON: `reports/eval/memory-skill-no-key-check2.json`

## CoT 与结论

- CoT 摘要: 评估场景: memory-skill-no-key-check2; 评委数: 3; 加权基础分: 5.71; 客观调整: -2.70。 关键门槛发现: [逻辑正确性] 6.00 < gate 6.50 (fail)；[可运行与兼容性] 5.82 < gate 6.00 (fail)；[安全性] 5.46 < gate 6.50 (fail)；构建未通过；测试未全部通过。 相对薄弱项: 可维护与可观测性:5.28, 安全性:5.46
- Final Justification: 综合评分 3.01/10（F），存在 fail 级门槛问题，需先修复再推广。

## 量化指标（客观）

| 指标 | 数值 |
|---|---|
| buildPassed | false |
| testsPassed | false |
| retrievalTestsPassed | false |
| skillTestsPassed | false |
| totalTests | 0 |
| passedTests | 0 |
| memoryFilesChanged | 1 |
| skillFilesChanged | 0 |
| runnerFilesChanged | 0 |
| docsFilesChanged | 1 |
| netAdditions | 1974 |
| netDeletions | 0 |
| harnessImpactScore | 2.7 |
| objectiveAdjustment | -2.7 |

客观检查日志：
- changed files: 5
- net lines: +1974/-0
- filtered paths: exclude reports/, dist/, node_modules/, coverage/, .git/, .swarm/
- memory files changed: 1
- skill files changed: 0
- 跳过客观检查（--skip-checks）

## Principle 得分

| Principle | Score | Weight | Weighted | StdDev |
|---|---:|---:|---:|---:|
| 逻辑正确性 | 6.00 | 0.28 | 1.68 | 0.00 |
| 可运行与兼容性 | 5.82 | 0.24 | 1.40 | 0.00 |
| 轻量化影响 | 5.64 | 0.18 | 1.01 | 0.00 |
| 安全性 | 5.46 | 0.18 | 0.98 | 0.00 |
| 可维护与可观测性 | 5.28 | 0.12 | 0.63 | 0.00 |

### 打分理由摘要

- **逻辑正确性**
  - 理由: fallback 估计：逻辑正确性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=false, testsPassed=false
  - 证据: fallback reason=OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- **可运行与兼容性**
  - 理由: fallback 估计：可运行与兼容性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=false, testsPassed=false
  - 证据: fallback reason=OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- **轻量化影响**
  - 理由: fallback 估计：轻量化影响 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=false, testsPassed=false
  - 证据: fallback reason=OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- **安全性**
  - 理由: fallback 估计：安全性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=false, testsPassed=false
  - 证据: fallback reason=OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- **可维护与可观测性**
  - 理由: fallback 估计：可维护与可观测性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=false, testsPassed=false
  - 证据: fallback reason=OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge

## 多 LLM 评委结果

### judge-1 (openai/gpt-4.1-mini)
- overall: 6.00
- cot: 外部模型不可用，使用 fallback 评分。原因：OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 设置可用 API Key（OPENAI_API_KEY/OPENROUTER_API_KEY 或 ANTHROPIC_API_KEY）后重跑真实评审。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

### judge-2 (anthropic/claude-3.5-haiku)
- overall: 6.00
- cot: 外部模型不可用，使用 fallback 评分。原因：HTTP 404: <!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1"/><link rel="stylesheet" href="/_next/static/css/cda3af16020f96ba.css" data-precedence="next"/><link rel="stylesheet" href="/_next/static/css/23565049b3597e
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - API 基地址可能错误，请检查 OPENAI_BASE_URL/OPENROUTER_BASE_URL/ANTHROPIC_BASE_URL 是否指向正确的 API 根路径。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

### judge-3 (google/gemini-2.0-flash-lite)
- overall: 6.00
- cot: 外部模型不可用，使用 fallback 评分。原因：OPENAI_API_KEY/OPENROUTER_API_KEY missing for non-anthropic judge
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 设置可用 API Key（OPENAI_API_KEY/OPENROUTER_API_KEY 或 ANTHROPIC_API_KEY）后重跑真实评审。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

## 前后对比

- 结论: 未提供 before 基线，无法计算增量。
- 总分变化: 0.00
- 客观调整变化: 0.00

| Principle | Before | After | Delta |
|---|---:|---:|---:|
| 逻辑正确性 | 6.00 | 6.00 | 0.00 |
| 可运行与兼容性 | 5.82 | 5.82 | 0.00 |
| 轻量化影响 | 5.64 | 5.64 | 0.00 |
| 安全性 | 5.46 | 5.46 | 0.00 |
| 可维护与可观测性 | 5.28 | 5.28 | 0.00 |

## 关键风险

- [逻辑正确性] 6.00 < gate 6.50 (fail)
- [可运行与兼容性] 5.82 < gate 6.00 (fail)
- [安全性] 5.46 < gate 6.50 (fail)
- 构建未通过
- 测试未全部通过
