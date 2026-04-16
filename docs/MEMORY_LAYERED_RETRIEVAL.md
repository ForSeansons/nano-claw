# Memory Layered Retrieval (Non-Vector)

This document describes the memory improvement added to NanoClaw without introducing vector embeddings.

## Why

The previous behavior appended the entire global `CLAUDE.md` every round. For long-lived groups, this increases prompt size and dilutes relevant context.

## What Changed

The agent runner now builds memory context in layers before each query:

1. **Semantic Memory (global)**  
   Source: `/workspace/global/CLAUDE.md` (non-main groups only)
   - If content size is below threshold, append full content.
   - If above threshold, split by markdown sections and retrieve top sections by lexical overlap with the current prompt.

2. **Episodic Memory (conversation archive)**  
   Source: `/workspace/group/conversations/*.md`
   - Retrieve top snippets by lexical overlap + light recency boost.
   - Append only top-K snippets.

3. **Injection**
   - The retrieved memory bundle is appended via `systemPrompt.append`.
   - Additional directories still work through existing `additionalDirectories` + SDK memory loading.

## Retrieval Method

No vector index is used.

- Tokenization: lowercase lexical tokens with stopword filtering
- Similarity: token overlap score
- Episodic ranking: overlap score + small recency boost
- Output control: top-K + per-section/per-snippet char caps

## Environment Controls

The retrieval behavior can be tuned with env vars:

- `NANOCLAW_MEMORY_RETRIEVAL_ENABLED` (`0` disables retrieval context)
- `NANOCLAW_MEMORY_FULL_THRESHOLD_CHARS`
- `NANOCLAW_MEMORY_SEMANTIC_TOP_K`
- `NANOCLAW_MEMORY_EPISODIC_TOP_K`
- `NANOCLAW_MEMORY_MAX_SECTION_CHARS`
- `NANOCLAW_MEMORY_MAX_EPISODIC_CHARS`
- `NANOCLAW_MEMORY_MAX_EPISODIC_FILES`

## Files

- `container/agent-runner/src/memory-retrieval.ts` (new)
- `container/agent-runner/src/index.ts` (integration)
- `tests/memory-retrieval.test.ts` (tests)

## Trade-offs

Pros:
- Reduces prompt bloat on large global memory
- Improves relevance by selecting memory sections/snippets per prompt
- Keeps implementation lightweight and transparent

Cons:
- Lexical matching can miss semantically similar phrasing
- Ranking quality depends on section structure and writing style

