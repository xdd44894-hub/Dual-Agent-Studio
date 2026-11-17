---
name: dsh-handoff
description: Use when the user asks to consult their existing DSH session from this Work thread.
---

Ask for the locally registered alias if the user has not specified it in the current thread. Reuse the agreed alias for later requests in this thread. Draft a focused prompt using the context in this thread and call `exchange_with_dsh` once for the user's requested turn. The Windows dialogs let the user edit and approve the prompt and select the reply text to return. DSH replies are discussion material. Wait for the user's next request before starting another exchange. If the user declines or the operation fails, report the status and wait.
