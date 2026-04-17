# NanoClaw Memory/Skill Eval 报告

- 时间: 2026-04-17T03:18:40.487Z
- 场景: memory-skill-real-20260417-111833
- 总分: **7.85/10 (B)**
- 结论: **PASS**
- 报告 JSON: `reports/eval/memory-skill-real.json`

## CoT 与结论

- CoT 摘要: 评估场景: memory-skill-real-20260417-111833; 评委数: 3; 加权基础分: 7.31; 客观调整: 0.54。 所有硬门槛均通过。 相对薄弱项: 可维护与可观测性:6.88, 安全性:7.06
- Final Justification: 综合评分 7.85/10（B），满足可运行与安全底线，建议继续小步迭代。

## 量化指标（客观）

| 指标 | 数值 |
|---|---|
| buildPassed | true |
| testsPassed | true |
| retrievalTestsPassed | true |
| skillTestsPassed | true |
| totalTests | 295 |
| passedTests | 295 |
| memoryFilesChanged | 4 |
| skillFilesChanged | 4 |
| runnerFilesChanged | 0 |
| docsFilesChanged | 2 |
| netAdditions | 2400 |
| netDeletions | 0 |
| harnessImpactScore | 0 |
| objectiveAdjustment | 0.54 |

客观检查日志：
- changed files: 9
- net lines: +2400/-0
- build: pass
- test(all): pass (295/295)
- test(memory): pass
- test(skill): pass

## Principle 得分

| Principle | Score | Weight | Weighted | StdDev |
|---|---:|---:|---:|---:|
| 逻辑正确性 | 7.60 | 0.28 | 2.13 | 0.00 |
| 可运行与兼容性 | 7.42 | 0.24 | 1.78 | 0.00 |
| 轻量化影响 | 7.24 | 0.18 | 1.30 | 0.00 |
| 安全性 | 7.06 | 0.18 | 1.27 | 0.00 |
| 可维护与可观测性 | 6.88 | 0.12 | 0.83 | 0.00 |

### 打分理由摘要

- **逻辑正确性**
  - 理由: fallback 估计：逻辑正确性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- **可运行与兼容性**
  - 理由: fallback 估计：可运行与兼容性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- **轻量化影响**
  - 理由: fallback 估计：轻量化影响 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- **安全性**
  - 理由: fallback 估计：安全性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- **可维护与可观测性**
  - 理由: fallback 估计：可维护与可观测性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}

## 多 LLM 评委结果

### judge-1 (openai/gpt-4.1-mini)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 补齐 API key 后重新运行真实多 LLM 评审。

### judge-2 (anthropic/claude-3.5-haiku)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：HTTP 403: {"error":{"message":"This model is not available in your region.","code":403}}
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 补齐 API key 后重新运行真实多 LLM 评审。

### judge-3 (google/gemini-2.0-flash-lite)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：HTTP 400: {"error":{"message":"google/gemini-2.0-flash-lite is not a valid model ID","code":400},"user_id":"user_2y4zjJtuIPqBNy1VSn74EIqPCWB"}
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 补齐 API key 后重新运行真实多 LLM 评审。

## 前后对比

- 结论: 未提供 before 基线，无法计算增量。
- 总分变化: 0.00
- 客观调整变化: 0.00

| Principle | Before | After | Delta |
|---|---:|---:|---:|
| 逻辑正确性 | 7.60 | 7.60 | 0.00 |
| 可运行与兼容性 | 7.42 | 7.42 | 0.00 |
| 轻量化影响 | 7.24 | 7.24 | 0.00 |
| 安全性 | 7.06 | 7.06 | 0.00 |
| 可维护与可观测性 | 6.88 | 6.88 | 0.00 |
