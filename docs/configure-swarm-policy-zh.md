# /configure-swarm-policy 说明（中文）

## 目的

把 `Skill Policy` 与 `Swarm Policy` 做成一个可复用的 operational skill，避免直接提交个人 `groups/*/CLAUDE.md` 配置。

## 能做什么

- 按用户选择，将策略块写入目标 `CLAUDE.md`（如 `groups/main/CLAUDE.md` 或某个指定 group）。
- 若已有策略块则更新，不重复堆叠。
- 可选增加 `Integrator Role Card (Compact)`。

## 为什么这样做

- 个人群组配置通常是本地/私有，不适合直接进仓库。
- operational skill 方式可复用、可审计、可按需应用。
- 与当前 NanoClaw 架构兼容（prompt 约束，不改运行时代码）。

## 当前策略要点

- 默认单 agent，仅在并行/交叉验证等场景开 swarm
- 默认 3 个 teammate，上限 5 个
- `.swarm/{role}/` 角色专属写入
- 统一命名：`.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`
- 清理规则：仅在合并验证通过后清理；否则保留并记录原因

## 边界

- 这是策略约束（prompt-level），不是硬权限隔离。
- 若要硬隔离，需要额外代码级权限控制（当前未启用）。

