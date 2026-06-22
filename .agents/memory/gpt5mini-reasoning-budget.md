---
name: gpt-5-mini reasoning token budget
description: gpt-5-mini burns internal reasoning tokens before writing visible content — too small a max_completion_tokens cap produces aiContentChars=0
---

`gpt-5-mini` is a reasoning model. It generates hidden reasoning tokens first, then writes the visible response. With `max_completion_tokens: 120`, the reasoning step consumes the entire budget and zero content tokens are produced (`finishReason: "length"`, `aiContentChars: 0`).

**Why:** Reasoning models (o-series, gpt-5-mini) have internal chain-of-thought that counts against `max_completion_tokens`. Small caps silently produce empty content with no error thrown.

**How to apply:** Always set `max_completion_tokens` to at least 1000 for gpt-5-mini (or any reasoning model). For short outputs (50-word intros), 1000 is still fast and cheap because the visible output is still short — the budget is just not the bottleneck.
