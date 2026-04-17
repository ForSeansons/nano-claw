# NanoClaw Memory/Skill Eval 报告

- 时间: 2026-04-17T03:47:29.363Z
- 场景: memory-skill-after-fix
- 总分: **7.96/10 (B)**
- 结论: **PASS**
- 报告 JSON: `reports/eval/memory-skill-after-fix.json`

## CoT 与结论

- CoT 摘要: 评估场景: memory-skill-after-fix; 评委数: 3; 加权基础分: 7.31; 客观调整: 0.65。 所有硬门槛均通过。 相对薄弱项: 可维护与可观测性:6.88, 安全性:7.06
- Final Justification: 综合评分 7.96/10（B），满足可运行与安全底线，建议继续小步迭代。

## 量化指标（客观）

| 指标 | 数值 |
|---|---|
| buildPassed | true |
| testsPassed | true |
| retrievalTestsPassed | true |
| skillTestsPassed | true |
| totalTests | 297 |
| passedTests | 297 |
| memoryFilesChanged | 1 |
| skillFilesChanged | 0 |
| runnerFilesChanged | 0 |
| docsFilesChanged | 1 |
| netAdditions | 1952 |
| netDeletions | 0 |
| harnessImpactScore | 0 |
| objectiveAdjustment | 0.65 |

客观检查日志：
- changed files: 5
- net lines: +1952/-0
- filtered paths: exclude reports/, dist/, node_modules/, coverage/, .git/, .swarm/
- memory files changed: 1
- skill files changed: 0
- build: pass
- test(all): pass (297/297)
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
  - 证据: fallback reason=mock-llm enabled
- **可运行与兼容性**
  - 理由: fallback 估计：可运行与兼容性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=mock-llm enabled
- **轻量化影响**
  - 理由: fallback 估计：轻量化影响 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=mock-llm enabled
- **安全性**
  - 理由: fallback 估计：安全性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=mock-llm enabled
- **可维护与可观测性**
  - 理由: fallback 估计：可维护与可观测性 受客观指标影响。
  - 理由: 未成功调用外部 LLM，采用启发式评分。
  - 证据: buildPassed=true, testsPassed=true
  - 证据: fallback reason=mock-llm enabled

## 多 LLM 评委结果

### judge-1 (openai/gpt-4.1-mini)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：mock-llm enabled
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 建议查看失败日志，确认模型可用性与 API 参数后重跑真实评审。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

### judge-2 (anthropic/claude-3.5-haiku)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：mock-llm enabled
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 建议查看失败日志，确认模型可用性与 API 参数后重跑真实评审。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

### judge-3 (google/gemini-2.0-flash-lite)
- overall: 7.60
- cot: 外部模型不可用，使用 fallback 评分。原因：mock-llm enabled
- final: 该评审为降级模式，仅用于保证流程可运行，不应作为最终发布决策唯一依据。
- risks:
  - LLM 评审不可用导致主观判断可信度下降。
- recommendations:
  - 建议查看失败日志，确认模型可用性与 API 参数后重跑真实评审。
  - 必要时加 --mock-llm 先验证脚本流程，再切回真实评审。

## 前后对比

- 结论: 相对基线总分提升 0.49，改善项 0，退化项 0。
- 总分变化: 0.49
- 客观调整变化: 0.49

| Principle | Before | After | Delta |
|---|---:|---:|---:|
| 逻辑正确性 | 7.60 | 7.60 | 0.00 |
| 可运行与兼容性 | 7.42 | 7.42 | 0.00 |
| 轻量化影响 | 7.24 | 7.24 | 0.00 |
| 安全性 | 7.06 | 7.06 | 0.00 |
| 可维护与可观测性 | 6.88 | 6.88 | 0.00 |
