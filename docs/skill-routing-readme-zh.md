# NanoClaw Skill 路由改造说明（中文）

## 背景

NanoClaw 的 Skill 选择发生在容器内，由 Claude Code 基于 `SKILL.md` 内容自主判断。

因此本次改造不新增宿主机路由器，而是通过优化 Skill 文档信号来降低误选。

## 本次改造目标

1. 提升 Skill 边界清晰度，减少相似 Skill 误触发。
2. 在多 Skill 模糊场景下提供一个低成本分流入口。
3. 提供可复用的写作规范与评估清单，便于后续持续优化。

## 主要改动

### 1) 标准化现有容器 Skill

已对以下 Skill 统一补充结构：

- `When to Use`
- `When NOT to Use`
- `Input Signals`
- `Procedure`
- `Verification`
- `Anti-patterns`

涉及文件：

- `container/skills/status/SKILL.md`
- `container/skills/capabilities/SKILL.md`
- `container/skills/agent-browser/SKILL.md`
- `container/skills/slack-formatting/SKILL.md`

### 2) 新增 `skill-index` 分流 Skill

新增 `container/skills/skill-index/SKILL.md`，用于在意图不明确时先做快速选型，再只加载目标 Skill 执行。

### 3) 新增路由规范与评估清单

- `docs/skill-routing-guidelines.md`：Skill 路由设计规范（架构边界、写作规则、CLAUDE.md 轻量策略建议）。
- `docs/skill-routing-eval.md`：20 条评估样例与指标模板（命中率、过触发率、歧义率）。

## 解决的问题

1. `status` 与 `capabilities` 边界重叠导致误选。
2. 多个 Skill 都“看起来可用”时缺乏选前分流。
3. 新 Skill 编写缺少统一标准，后续容易再次重叠。
4. 缺少可复现评估集，无法量化优化效果。

## 当前策略（推荐）

- 路由核心仍由 Claude Code 完成。
- 通过更精确的 `description` + `When NOT to Use` 提高语义判别能力。
- 需要约束时，优先在 group 的 `CLAUDE.md` 中用自然语言写 Allowed/Denied/Preferred 规则。

## 已验证

- `npm run test`：通过
- `npm run build`：通过

## 后续可选增强

1. 按 `docs/skill-routing-eval.md` 持续做 A/B 对比与版本记录。
2. 当 Skill 数量显著增长后，再考虑引入更重的策略层（结构化黑白名单或轨迹统计）。
