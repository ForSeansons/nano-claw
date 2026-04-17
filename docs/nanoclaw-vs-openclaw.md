# NanoClaw vs OpenClaw 对比
---

## 简要说明

nanoclaw；一个用Node.js调度进程，然后用几个隔离的cc的docker容器来运行，文件命令都是独立的；底层是cc，前端是应用。
openclaw：单node进程但是共享内容，是造了一个agent框架，可以调用不同模型。


nano-claw特点：（1）比较轻量（2）高度依赖cc（3）严格的隔离机制



下面是具体的一些部分，也是我的思考和改动方向。借助了agent生成，没有补充很多。可以直接略过去看缺点和改进部分。
---

## Memory

| | NanoClaw | OpenClaw |
|---|---|---|
| 存储形式 | `groups/{name}/CLAUDE.md`，文件即记忆 | `AGENTS.md` + `SOUL.md` + `USER.md` + `MEMORY.md` 分角色存储 |
| 检索方式 | 全量注入 context，Claude 自行处理 | 向量检索（多 embedding 提供商）+ BM25 混合召回 |
| 记忆管理 | Claude Code 自动读写 CLAUDE.md | Active Memory 子 agent 在回复前主动召回 |
| 本地搜索 | 无 | QMD 本地搜索引擎，支持 reranking 和 query expansion |
| 复杂度 | 极简，一个文件 | 工程化，多层架构 |

**NanoClaw 优势**：简单可理解，零配置。
**OpenClaw 优势**：记忆系统工程化，大量对话后仍能精准召回。

---

## Skill

| | NanoClaw | OpenClaw |
|---|---|---|
| 安装方式 | `git merge skill/*` 分支，代码合并到 fork | npm 包 / 本地目录 / 工作区，运行时加载 |
| 加载优先级 | 单一来源（`container/skills/`），容器启动时同步 | 六级优先级（workspace > project > personal > managed > bundled > extra） |
| per-agent 控制 | 无，所有 group 共享同一套 skill | 支持 per-agent skill 列表，非空列表替换默认值 |
| 分发方式 | GitHub 分支 PR | npm 包 / 本地目录 / 外部包 |
| 自动生成 | 无 | 无 |

**NanoClaw 优势**：skill 是代码，合并后永久属于你的 fork，不依赖外部服务。
**OpenClaw 优势**：加载更灵活，优先级体系更完整，支持运行时热加载。

---

## Swarm / 多 Agent

| | NanoClaw | OpenClaw |
|---|---|---|
| 实现方式 | Claude Code 原生 Agent Teams（实验性） | 自研多 agent 路由，binding 规则确定性匹配 |
| 隔离级别 | prompt 约束（scratch 区约定） | 架构级隔离（独立 workspace、session store、auth profile） |
| 路由方式 | Claude 自主决定是否开 swarm | binding 规则：channel + account + peer + group 模式匹配，first match wins |
| sub-agent | 继承 lead 的权限和工具 | 独立 session，可配置嵌套深度，默认继承除 session 工具外的所有工具 |
| 稳定性 | 依赖模型行为，不确定性高 | 确定性路由，行为可预测 |

**NanoClaw 优势**：零额外代码，直接用 Claude Code 能力。
**OpenClaw 优势**：多 agent 是架构级设计，隔离彻底，行为可预测可 debug。

---

## 自我进化

| | NanoClaw | OpenClaw |
|---|---|---|
| 轨迹提取 | 无（原版） | 无 |
| 自动学习 | 无 | 无，明确拒绝自动进化 |
| 记忆更新 | Claude Code 自动写 CLAUDE.md | 用户手动维护 memory 文件 |
| skill 生成 | 无（原版） | 无 |

两者原版都没有自我进化能力。OpenClaw 在设计上主动拒绝了这个方向（VISION.md 明确反对 manager-of-managers 和重型编排层）。


# NanoClaw的缺点和改进

这部分主要改动的是功能性的方法。
Nanoclaw最大的缺点（可能也是优点）就是使用cc作为底层，一方面结构没那么灵活，swarm、skill调用等都要跟着cc来，另一方面也是可以吃到cc迭代的福利，（同时我也可以拿着他进行自我检查和迭代）。所以这部分就不动。

改进方面主要是 **​memory** 和 **skill** 两方面，其他的是顺便看到的。然后改进的原则是：（1）不加入过于复杂、影响轻量型的部件。（2）不在cc上做大改，比如swarm，只做一些小的筛选和增量操作（3）不影响安全性和隔离性，保留作为个人安全助手的地位。

改的方法是：把想好的思路和仓库丢入codex生成方案 -> 输入nanoclaw自带cc作为judge，评估底层逻辑以及是否违背原理，形成新方案 -> 把新方案输入codex vibe coding并自测 -> 自带cc继续评估并给出建议 ... -> 然后借助agent读一遍代码然后提交  具体想法看每个部分的第一点以及对应中文md的说明即可

## 1) Memory 改动与解决问题

### 解决的问题或者缺点

- 之前的记忆管理过于扁平化，对于个人助手以及读取记忆的时候不太友好。然后一些记忆机制也没有明显的分层，于是用了一个筛选 + 轻量匹配（不引入向量化）的机制来做
- 解决了“长期全量注入导致 context 线性膨胀”的问题
- 解决了“历史远期信息稀释当前问题信号”的问题
- 在不引入向量库的前提下，补上了可解释、可调参的检索路径

### 已做改动

- 新增分层记忆检索模块：`container/agent-runner/src/memory-retrieval.ts`
- 在 agent runner 中接入“按需注入”而非单纯全量注入（接入点在 `container/agent-runner/src/index.ts`）
- 检索方式保持轻量、非向量：
  - Global memory：按 markdown 标题切段 + 词项重叠 Top-K
  - Episodic memory：对 `conversations/*.md` 做“词项重叠 + 新近性”召回
- 增加可控参数（环境变量）：
  - `NANOCLAW_MEMORY_RETRIEVAL_ENABLED`
  - `NANOCLAW_MEMORY_FULL_THRESHOLD_CHARS`
  - `NANOCLAW_MEMORY_SEMANTIC_TOP_K`
  - `NANOCLAW_MEMORY_EPISODIC_TOP_K`
  - `NANOCLAW_MEMORY_MAX_SECTION_CHARS`
  - `NANOCLAW_MEMORY_MAX_EPISODIC_CHARS`
  - `NANOCLAW_MEMORY_MAX_EPISODIC_FILES`



### 改动后的 `.md` 文件位置

- `docs/MEMORY_LAYERED_RETRIEVAL.md`
- `groups/global/CLAUDE.md`
- `groups/main/CLAUDE.md`

### 对应中文 `.md`（docs）

- `docs/MEMORY_LAYERED_RETRIEVAL.md`

---

## 2) Skill 改动与解决问题 

### 解决的问题
- 原有的skill机制是用cc的语义选择，然后我觉得会不太稳定，需要一些不太消时间的初筛；同时作为个人助手的定位应该是可以从自己的对话中总结出经验的（参考hermes-agent），只用cc的skill效果可能没有那么好。当然自己提取skill这部分还不太完善。

- 解决了“status/capabilities 边界重叠导致误选”的问题
- 解决了“复合请求缺少 tie-breaker”的问题（通过 `skill-index`）
- 解决了“skill 提取草稿质量不稳定、命名无语义、低复现也产出”的问题
- 解决了“新提取能力污染原有 skill 主链路”的风险（改为独立增量路径）



### 已做改动（路由与可用性）

- 规范化容器内已有 skill 文档结构（`When to Use/When NOT to Use/Input Signals/Procedure/Verification/Anti-patterns`）
  - `container/skills/status/SKILL.md`
  - `container/skills/capabilities/SKILL.md`
  - `container/skills/agent-browser/SKILL.md`
  - `container/skills/slack-formatting/SKILL.md`
- 新增 `container/skills/skill-index/SKILL.md` 作为歧义场景分流 skill
- 新增路由规范文档与评估集：
  - `docs/skill-routing-guidelines.md`
  - `docs/skill-routing-eval.md`
  - `docs/skill-routing-eval-simulation.md`

### 已做改动（轨迹提取 skill，且不污染原有 skill）

- 新增轨迹提取与草稿链路（容器内）：
  - `container/agent-runner/src/skill-extraction.ts`
  - `container/agent-runner/src/skill-draft-validator.ts`
  - `container/agent-runner/src/skill-draft-store.ts`
  - `container/agent-runner/src/skill-incremental-merge.ts`
- 默认草稿输出到 `skills-drafts` / `skills-incremental`，不直接改 active skills
- 提取时同时参考原有 active skills 与增量 skills，做去重/匹配/增量提案
- 强化质量门槛：
  - 最小复现次数硬门槛 `>= 3`
  - 语义化命名（避免 `auto` / `auto-2` 低信息命名）
  - 生成 schema 对齐现有 Claude Code skill 风格（frontmatter + 固定章节）



### 改动后的 `.md` 文件位置

- `container/skills/status/SKILL.md`
- `container/skills/capabilities/SKILL.md`
- `container/skills/agent-browser/SKILL.md`
- `container/skills/slack-formatting/SKILL.md`
- `container/skills/skill-index/SKILL.md`
- `docs/skill-routing-readme-zh.md`
- `docs/skill-routing-guidelines.md`
- `docs/skill-routing-eval.md`
- `docs/skill-routing-eval-simulation.md`
- `docs/skill-extraction-readme-zh.md`

### 对应中文 `.md`（docs）

- `docs/skill-routing-readme-zh.md`
- `docs/skill-extraction-readme-zh.md`

---

## 3) Swarm 改动与解决问题

### 解决的问题

- 这部分我不太懂但是做了一个角色隔离和分层储存的小机制，写成了skill不影响主体内容。
- 解决了“swarm 误开导致复杂度上升”的问题
- 解决了“多 teammate 写文件互相覆盖”的高频协作问题
- 解决了“任务结束清理不当造成数据丢失”的问题（加入条件清理）


### 已做改动

- 将 swarm 与 skill 策略沉淀为“可复用策略文档 + operational skill”路线，避免把个人 `CLAUDE.md` 直接提交到仓库
- 增加策略说明文档：
  - `docs/swarm-policy-scratch-zh.md`
  - `docs/configure-swarm-policy-zh.md`
- 核心策略（轻量、prompt 级）：
  - 默认单 agent，只有并行收益明确时开 swarm
  - teammate 角色分工与 scratch 目录约定（`.swarm/{role}/`）
  - 产物命名规范：`.swarm/{role}/{YYYYMMDD_HHMMSS}_{desc}.md`
  - 清理策略：合并验证通过才清理，失败则保留并记录原因



### 改动后的 `.md` 文件位置

- `docs/swarm-policy-scratch-zh.md`
- `docs/configure-swarm-policy-zh.md`

### 对应中文 `.md`（docs）

- `docs/swarm-policy-scratch-zh.md`
- `docs/configure-swarm-policy-zh.md`

---

## 4) Eval 改动与解决问题


- 这部分是稍微实践了一下agent grm，不算改进。同时为提供上面的改进一些除了工程测试外实际运行的评估维度，也有一些自己做dpo数据的想法：匹配n个语义类似的数据进行rerank，来构建对齐偏好的数据，当然更好的方式还是要加入人类的回答来进行识别。用内置cc做的一些数据

### 已做改动

- 新增评估核心与入口：
  - `scripts/eval-core.ts`
  - `scripts/eval-memory-skill.ts`
- 新增与补强测试：
  - `tests/eval-core.test.ts`
  - `tests/eval-memory-skill-cases.test.ts`（50 个独立参考案例）
- 新增中文评估文档：
  - `docs/memory-skill-eval-zh.md`
  - `docs/memory-skill-eval-readme-zh.md`
- 关键修复点：
  - `PASS` 判定改为：hard gate 通过 + `build/tests` 必须通过（修复假阳性）
  - diff 统计过滤噪声目录（`reports/`、`dist/`、`node_modules/`、`coverage/` 等）
  - memory/skill 文件计数从模糊匹配改为路径语义匹配
  - LLM 请求增加超时控制（`--request-timeout-ms`）
  - fallback 推荐按原因细分（missing-key / timeout / rate-limit / base-url / auth / region / network / schema）
  - 修复路径归一化边界 bug（混合空格 + `./` + `\\` 场景）

### 解决的问题

- 解决了“评估通过但工程实际不可运行”的判定漏洞
- 解决了“报告文件反向污染评估指标”的问题
- 解决了“skill/memory 变更计数偏差大”的问题
- 解决了“LLM 失败时推荐不可操作”的问题



### 改动后的 `.md` 文件位置

- `docs/memory-skill-eval-zh.md`
- `docs/memory-skill-eval-readme-zh.md`
- `reports/eval/memory-skill-before-fix.md`
- `reports/eval/memory-skill-after-fix-50-cases.md`

### 对应中文 `.md`（docs）

- `docs/memory-skill-eval-zh.md`
- `docs/memory-skill-eval-readme-zh.md`

---

## 5) 检验报告（汇总）

### 5.1 Skill 路由模拟评估（50 case）

来源：`docs/skill-routing-eval-simulation.md`

- Before：`30/50 = 60%`
- After：`50/50 = 100%`
- 提升：`+40pp`
- 关键指标：
  - Hit rate：100%（目标 ≥ 90%）
  - Over-trigger rate：0%（目标 ≤ 10%）
  - Ambiguity rate：100%（目标 ≥ 67%）

### 5.2 Memory/Skill Eval 对比（before vs after-fix-50-cases）

来源：
- `reports/eval/memory-skill-before-fix.json`
- `reports/eval/memory-skill-after-fix-50-cases.json`

核心结果：

- 总分：`7.47 (C) -> 7.89 (B)`（`+0.42`）
- 结论：`PASS -> PASS`
- 客观调整：`0.16 -> 0.58`（`+0.42`）
- 其他关键指标：
  - `totalTests: 295 -> 298`
  - `passedTests: 295 -> 298`
  - `netAdditions: 3936 -> 2256`
  - `memoryFilesChanged: 10 -> 1`
  - `skillFilesChanged: 10 -> 1`

### 5.3 自动化测试结果

- 独立 eval 50 案例：`tests/eval-memory-skill-cases.test.ts` 通过
- 全量测试：`23 files, 298 tests` 通过
- 记忆检索测试：`tests/memory-retrieval.test.ts` 通过
- skill 提取测试：`tests/skill-extraction.test.ts` 通过

---

## 6) 结论

本轮改动保持了 NanoClaw 的轻量、可控与隔离边界：  
不引入重型向量与外部编排层，不重写 Claude Code 主链路，而是通过“分层检索 + skill 文档路由治理 + 增量提取 + 可量化评估”完成了稳定增强。整体结果是：可运行性保持、误选率下降、评估可信度提高、维护成本可控。
