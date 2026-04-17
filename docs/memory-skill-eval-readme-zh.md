# NanoClaw Memory/Skill Eval 中文 README

本 README 对应 `scripts/eval-memory-skill.ts` 与 `scripts/eval-core.ts`，用于评估 memory/skill 相关改动在以下维度的效果：

- 逻辑正确性
- 可运行与兼容性（含 harness）
- 轻量化影响
- 安全性
- 可维护与可观测性

## 1. 这次做了什么

- 新增统一聚合核心：`scripts/eval-core.ts`
  - 多评委原则打分聚合
  - hard gate + 客观指标联合判定
  - `PASS` 需同时满足 hard gate 与 `build/tests` 通过
- 新增评估入口：`scripts/eval-memory-skill.ts`
  - 支持多 LLM 评委（含 fallback）
  - 支持 before/after 对比
  - 支持 Markdown 与 JSON 报告输出
- 新增 50 个独立参考案例测试：`tests/eval-memory-skill-cases.test.ts`
  - 覆盖 path 归一化、diff 过滤、memory/skill 路径识别、fallback 原因分类与建议
- 新增/补充测试：`tests/eval-core.test.ts`
  - 回归验证 build/test 失败时必须 `pass=false`

## 2. 运行方式

### 2.1 快速运行（mock）

```bash
npm run -s eval:memory-skill -- \
  --scenario memory-skill-after-fix-50-cases \
  --baseline reports/eval/memory-skill-before-fix.json \
  --output reports/eval/memory-skill-after-fix-50-cases.json \
  --report-md reports/eval/memory-skill-after-fix-50-cases.md \
  --mock-llm
```

说明：开启 `--mock-llm` 后，产物会被自动写入 `reports/eval/mock/`，并加 `-mock` 后缀，避免与真实评估结果混淆。

### 2.2 真实评估（有 API key）

```bash
OPENAI_API_KEY=... \
OPENAI_BASE_URL=... \
npm run -s eval:memory-skill -- \
  --scenario memory-skill-real \
  --output reports/eval/memory-skill-real.json \
  --report-md reports/eval/memory-skill-real.md \
  --request-timeout-ms 45000
```

### 2.3 跑 50 案例测试

```bash
npm run -s test tests/eval-memory-skill-cases.test.ts
```

## 3. 本次基线与改后结果

基线报告：

- `reports/eval/memory-skill-before-fix.json`

改后报告（50 案例版本）：

- `reports/eval/mock/memory-skill-after-fix-50-cases-mock.json`
- `reports/eval/mock/memory-skill-after-fix-50-cases-mock.md`

关键指标对比：

| 指标 | Before | After | Delta |
|---|---:|---:|---:|
| totalScore | 7.47 | 7.89 | +0.42 |
| grade | C | B | +1档 |
| pass | true | true | 0 |
| objectiveAdjustment | 0.16 | 0.58 | +0.42 |
| totalTests | 295 | 298 | +3 |
| passedTests | 295 | 298 | +3 |
| netAdditions | 3936 | 2256 | -1680 |
| memoryFilesChanged | 10 | 1 | -9 |
| skillFilesChanged | 10 | 1 | -9 |

## 4. 50 案例测试结果

- 独立案例总数：50
- 执行结果：`50/50 PASS`
- 全量测试结果：`23 files, 298 tests PASS`

## 5. 设计上的关键改进点

- 避免评估报告自污染：过滤 `reports/`、`dist/`、`node_modules/` 等路径，减少 diff 噪声。
- 修复 `PASS` 假阳性：即使原则分高，`build/test` 失败也不会通过。
- 提升 fallback 可操作性：按失败原因给出差异化建议（key、timeout、base-url、rate-limit、auth、region、schema）。
- 保持轻量：无新增第三方重依赖，维持 NanoClaw 小体量。
