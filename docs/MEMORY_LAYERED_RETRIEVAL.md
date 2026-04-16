# 分层记忆检索（非向量）

本文说明 NanoClaw 在不引入向量 embedding 的前提下，对记忆检索所做的改进。

## 背景

此前每轮都会把全量 `global CLAUDE.md` 注入上下文。对于长期使用的群组，这会导致 prompt 持续膨胀，并稀释当前问题的相关信号。

## 改动内容

Agent Runner 在每次调用前，改为按层构建记忆上下文：

1. **语义记忆（global）**  
   来源：`/workspace/global/CLAUDE.md`（仅非 main 群组）
   - 当文本长度低于阈值时，仍全量注入。
   - 当超过阈值时，先按 Markdown 标题切分，再按与当前 prompt 的词项重叠分数选取 Top-K 段落。

2. **情节记忆（对话归档）**  
   来源：`/workspace/group/conversations/*.md`
   - 按“词项重叠 + 轻量时间新近性加权”召回片段。
   - 仅注入 Top-K 条目。

3. **注入方式**
   - 召回结果统一通过 `systemPrompt.append` 注入。
   - 既有 `additionalDirectories` + SDK 记忆加载机制保持不变。

## 检索方法

本方案不使用向量索引。

- 分词：小写词项 + 停用词过滤
- 相似度：词项重叠分数
- 情节排序：重叠分数 + 新近性加权
- 输出控制：Top-K + 段落/片段长度上限

## 环境变量开关

可通过以下环境变量调整行为：

- `NANOCLAW_MEMORY_RETRIEVAL_ENABLED`（`0` 表示关闭检索注入）
- `NANOCLAW_MEMORY_FULL_THRESHOLD_CHARS`
- `NANOCLAW_MEMORY_SEMANTIC_TOP_K`
- `NANOCLAW_MEMORY_EPISODIC_TOP_K`
- `NANOCLAW_MEMORY_MAX_SECTION_CHARS`
- `NANOCLAW_MEMORY_MAX_EPISODIC_CHARS`
- `NANOCLAW_MEMORY_MAX_EPISODIC_FILES`

## 涉及文件

- `container/agent-runner/src/memory-retrieval.ts`（新增）
- `container/agent-runner/src/index.ts`（接入点）
- `tests/memory-retrieval.test.ts`（测试）

## 取舍说明

优点：
- 降低大体量 global memory 的上下文成本
- 提升当前问题相关记忆命中率
- 实现简单、透明，便于调参与排障

限制：
- 词项匹配可能漏掉语义相近但措辞不同的内容
- 检索效果依赖文本组织结构和标题质量
