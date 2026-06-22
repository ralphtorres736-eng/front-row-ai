---
name: Vite circular imports from App-exported hooks
description: Why shared context/hooks must live in their own module, not be exported from App.tsx
---

# Vite circular imports from App-exported hooks

Do not export a shared hook/context (e.g. `useMood`) from `App.tsx` and then import it
into page/route components that `App.tsx` itself imports. This creates a circular import.

**Why:** Vite/React tolerate it at runtime (hooks resolve lazily at render), but HMR breaks —
edits trigger "failed to apply HMR as it's within a circular import" reloads and stale-module
errors like "does not provide an export named X" until a full workflow restart.

**How to apply:** Put shared context + provider + hook in their own module
(e.g. `src/contexts/<name>.tsx`). `App.tsx` imports only the Provider; pages import the hook
from the context module. Keeps the dependency graph acyclic.
