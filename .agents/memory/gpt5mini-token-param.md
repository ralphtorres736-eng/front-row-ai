---
name: gpt-5-mini token parameter
description: gpt-5-mini (and newer Replit proxy models) reject max_tokens with a 400 error — must use max_completion_tokens
---

The Replit AI proxy model `gpt-5-mini` returns HTTP 400 "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." if you pass `max_tokens`.

**Why:** Newer OpenAI-compatible models exposed through the Replit proxy use the newer parameter name `max_completion_tokens`. The older `max_tokens` alias is not accepted.

**How to apply:** Always use `max_completion_tokens` for any model on the Replit AI integration proxy (gpt-5-mini, gpt-5, gpt-5-nano, etc.). Only use `max_tokens` for legacy models (gpt-4o, gpt-4o-mini) if they are already in the project.
