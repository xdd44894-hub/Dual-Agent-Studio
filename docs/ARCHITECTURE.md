# Architecture / 架构说明

## Current prototype / 当前原型 v0.1.1

```text
Browser (http://127.0.0.1:3700)
           |
       HTTP JSON
           |
   Node.js server.js (one local process)
       /               \
 codex CLI             dsh CLI
 (one-shot)           (one-shot)
       \               /
       local user-data test-workspace
```

- `server.js`: Node HTTP server, host/origin validation, CLI detection, process spawning, timeout, busy flag, and orchestration.
- `index.html`: embedded dashboard with two modes; vanilla HTML/CSS/JavaScript.
- `sea-config.json` + `build.cmd`: build a Windows single-file **local web-server launcher** via Node SEA (not Electron).
- `tests/`: no-network/no-agent HTTP smoke tests.

### Lifecycle and limitations

The Node process binds to loopback. The UI submits a task via `/api/run`; the coordinator calls each CLI separately, reads stdout/stderr, optionally makes one more pair of invocations with the other's answer as context, and returns the final JSON response. UI rendering is not token-streaming. The underlying CLIs may use online providers. Status is PATH presence, not live provider connectivity.

`DUAL_AGENT_PORT` (default `3700`) is intended for local testing. `DUAL_AGENT_WORKSPACE` overrides the default user-data test workspace. **Do not expose any port or workspace outside your trusted local computer.**

## Proposed desktop architecture / 规划中的桌面架构（尚未实现）

```text
Electron renderer (React + TypeScript)
                |
     Typed, restricted IPC interface
                |
       Electron main process
      /          |            \
Agent adapters  Orchestrator   Local storage
    |                |             |
    +--- Codex SDK/stdio       SQLite
    +--- DeepSeek SDK/stdio
                 |
       Approved Git worktrees
```

Planned principles / 设计原则：

1. **Default deny**: no project write, terminal command, or file merge without explicit user approval.
2. **One owner per file/worktree**: avoid concurrent edits to the same working tree.
3. **Durable sessions**: persist messages and provenance without logging credentials.
4. **Event-driven processing**: display per-Agent progress, errors, and permission requests in real time.
5. **Separation of processes**: Electron UI never receives shell execution primitives or API tokens.
6. **Bounded cooperation**: limit discussion rounds, time, and token/cost budget; leave unresolved disagreement visible.
7. **Local first, not local inference**: Agent coordination stays on the PC, while provider inference can remain remote.

### Migration outline / 迁移步骤

1. Introduce TypeScript types for `AgentAdapter` (`start`, `sendTask`, `events`, `stop`); keep existing CLI path as a compatibility adapter.
2. Integrate an Electron main-process service manager and a secure preload IPC bridge.
3. Rebuild the UI in React without publicly binding a local HTTP port, unless separately needed.
4. Implement SDK/JSON-RPC adapters with protocol compatibility tests.
5. Add authenticated local session storage and explicit permission broker.
6. Introduce Git worktree isolation and review/merge workflow only after approval and sandbox design are tested.

None of these desktop-phase components exist in the current release-preparation archive. / 当前归档中尚未实现上述桌面阶段模块。
