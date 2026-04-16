# 轨迹提取 Skill 草稿（中文说明）

## 功能概述

新增了一个可选的“轨迹 -> Skill 草稿”能力，用于从历史会话归档中提取可复用流程，并生成待审核的 Skill 草稿。

该功能默认关闭，不影响现有运行链路。

## 运行位置与架构

- 运行位置：`container/agent-runner`（容器内）。
- 输入来源：`/workspace/group/conversations/*.md`。
- 输出位置：`/home/node/.claude/skills-drafts/<skill-name>/`。
- 发布方式：人工审核后再移动到 `/home/node/.claude/skills/`。

## 新增模块

- `container/agent-runner/src/skill-extraction.ts`
  - 解析轨迹、聚合意图、筛选候选、生成草稿。
- `container/agent-runner/src/skill-draft-validator.ts`
  - 校验草稿结构、frontmatter、必需章节。
- `container/agent-runner/src/skill-draft-store.ts`
  - 去重检查并保存草稿与元数据。

## 主流程接入

`container/agent-runner/src/index.ts` 新增 `maybeExtractSkillDrafts()`：

- 通过环境变量开关控制。
- 启动时尝试提取（失败不阻断主流程）。
- 输出简要统计日志：扫描文件数、意图桶数、候选数、保存数。

## 环境变量

- `NANOCLAW_SKILL_EXTRACTION_ENABLED=1`：开启功能。
- `NANOCLAW_SKILL_EXTRACTION_CONVERSATIONS_DIR`：轨迹目录（默认 `/workspace/group/conversations`）。
- `NANOCLAW_SKILL_EXTRACTION_DRAFTS_DIR`：草稿目录（默认 `/home/node/.claude/skills-drafts`）。
- `NANOCLAW_SKILL_EXTRACTION_ACTIVE_SKILLS_DIR`：现有技能目录（默认 `/home/node/.claude/skills`）。
- `NANOCLAW_SKILL_EXTRACTION_MIN_OCCURRENCES`：最小复现次数（默认 `3`）。
- `NANOCLAW_SKILL_EXTRACTION_MIN_SUCCESS_RATE`：最小成功率（默认 `0.7`）。
- `NANOCLAW_SKILL_EXTRACTION_MAX_DRAFTS`：单次最多草稿（默认 `3`）。

## 当前策略

1. 从对话中提取 user/assistant 语句与 skill 关键词。
2. 按意图词聚类（词法方式，轻量实现）。
3. 仅保留“出现次数 >= 阈值 且 成功率 >= 阈值”的候选。
4. 自动生成标准结构草稿：
   - When to Use
   - When NOT to Use
   - Input Signals
   - Procedure
   - Verification
   - Anti-patterns
5. 与现有 skills 做名称去重，避免冲突草稿。

## 好处与价值

1. **沉淀经验**：把重复成功流程自动沉淀为可复用 Skill 草稿。
2. **减少手工整理成本**：先自动产出初稿，人工只做审核与精修。
3. **降低误加风险**：默认草稿态，不直接进入 active skills。
4. **可控上线**：全程由开关控制，异常不影响主链路。
5. **可迭代优化**：后续可逐步增强成功判定、去重与质量评分。

## 建议审核流程

1. 查看 `skills-drafts` 中 `SKILL.md` 与 `meta.json`。
2. 检查适用边界和 `When NOT to Use` 是否明确。
3. 补充真实命令与验证步骤。
4. 通过后再移动到 `/home/node/.claude/skills/` 并纳入评估集。
