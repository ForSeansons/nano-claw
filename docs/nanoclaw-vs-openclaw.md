# NanoClaw vs OpenClaw 对比

> 基于修改前的原始版本对比（NanoClaw @ f23a54a，OpenClaw 原版）

---

## 一句话定位

| | NanoClaw | OpenClaw |
|---|---|---|
| 定位 | 小到能读懂的个人 AI 助手 | 功能完整的个人 AI 助手平台 |
| 代码规模 | ~几千行，少量源文件 | ~50 万行，53 个配置文件，70+ 依赖 |
| 设计哲学 | 简单、可理解、可定制 | 功能完整、插件化、多模型 |

NanoClaw 的 README 开篇就说：OpenClaw 是令人印象深刻的项目，但我没办法把我不理解的复杂软件完全访问我的生活。

---

## 安全隔离

| | NanoClaw | OpenClaw |
|---|---|---|
| 隔离方式 | OS 级容器隔离（Docker / Apple Container） | 应用级权限控制（allowlist、pairing code） |
| 进程模型 | 每个 agent 独立 Linux 容器，独立文件系统 | 单 Node 进程，共享内存 |
| Bash 安全 | 命令在容器内执行，不影响宿主机 | 运行在同一进程内 |

**NanoClaw 优势**：真正的 OS 级隔离，不是权限检查。

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

---

## 频道支持

| | NanoClaw | OpenClaw |
|---|---|---|
| 支持频道 | WhatsApp、Telegram、Slack、Discord、Gmail | 20+ 频道（含 Signal、iMessage、Matrix、飞书、LINE、WeChat、QQ 等） |
| 添加方式 | `/add-xxx` skill，合并代码分支 | 插件安装，运行时加载 |
| 语音支持 | 需安装 voice-transcription skill | 原生支持，多 TTS/STT 提供商 |

---

## 模型支持

| | NanoClaw | OpenClaw |
|---|---|---|
| 默认模型 | Claude（通过 Claude Code / Anthropic API） | 多模型（OpenAI、Anthropic、Gemini、本地模型等） |
| 切换方式 | 改 `.env` 中的 API 配置 | 配置文件 + CLI，支持 auth profile 轮换和 failover |

---

## 总结

**选 NanoClaw 如果你：**
- 想完全理解自己运行的代码
- 需要真正的 OS 级容器隔离
- 只用 Claude，不需要多模型
- 喜欢 fork + 改代码的方式定制

**选 OpenClaw 如果你：**
- 需要更多频道（Signal、iMessage、WeChat 等）
- 需要多模型支持
- 需要工程化的记忆检索
- 需要稳定可预测的多 agent 路由
- 不想改代码，只想配置
