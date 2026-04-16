# Swarm 策略与 Scratch 约定（简版）

## 目标

在不改代码的前提下，通过 `CLAUDE.md` 规则减少 swarm 误开、减少 teammate 互相覆盖文件、降低临时产物丢失风险。

## 本次调整（轻量）

已在 `groups/discord_main/CLAUDE.md` 增加：

1. `Skill Policy`
- Allowed: `status`, `capabilities`, `agent-browser`, `skill-index`
- Denied: `slack-formatting`（Discord 群组）
- Preferred: 能力问答场景优先 `capabilities > status`

2. `Swarm Policy`
- 默认单 agent
- 仅在以下场景开 swarm：
  - 3 个以上相对独立子问题
  - 需要并行拉取多个数据源
  - 需要交叉验证
- 默认 3 个 teammate，上限 5 个
- `researcher/analyst` 创建时优先使用 haiku

3. Scratch 区执行约定
- `researcher` 仅写：`/workspace/group/.swarm/researcher/`
- `analyst` 仅写：`/workspace/group/.swarm/analyst/`
- `judge` 仅写：`/workspace/group/.swarm/judge/`
- `integrator` 负责合并到正式位置
- teammate 不直接改 `/workspace/group/` 根目录正式文件

4. 产物命名（简化后）
- 统一格式：`.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`
- 示例：`.swarm/researcher/20260417_143022_sources.md`

5. 清理规则（带条件）
- 合并验证通过：清理 `.swarm/*`
- 合并失败或跳过：保留 `.swarm/*`，并在 `.swarm/_merge_notes.md` 记录原因

6. Integrator 角色卡（精简）
- 先读 `.swarm/*` 产物，再决定合并
- 检查命名是否符合 `.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`
- 仅把已验证内容写入正式路径
- 依据验证结果执行“清理或保留+记录原因”

## 如何理解这套规则

- `CLAUDE.md` 策略块是“声明层”：告诉模型什么时候该开 swarm、该用哪些 skill。
- `.swarm` 约定是“执行层”：约束每个角色怎么落地写文件和交付产物。
- 两者配合后，能在当前架构下以最低成本提升稳定性。

## 边界说明

- 这套是 prompt/policy 约束，不是硬权限隔离。
- 但在现有 NanoClaw 架构中，这是最轻量、可快速迭代的治理方式。
