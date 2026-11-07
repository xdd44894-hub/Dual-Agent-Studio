# Roadmap / 开发路线

This is a plan, **not a feature list for a released product**. / 以下为规划，并非现有功能说明。

| Milestone / 阶段 | Scope / 目标 | Status / 状态 |
| --- | --- | --- |
| v0.1.0 | Local Node.js + browser prototype; parallel/two-round logic | Source present / 源码已有 |
| v0.1.1 | Windows Node SEA build kit | Build files present; Windows EXE unverified / 尚未独立验证 EXE |
| v0.2 | Electron app window, integrated process manager, status and logs | **Planned / 规划中** |
| v0.3 | Persistent agent sessions, streaming events, bounded discussion | **Planned / 规划中** |
| v0.4 | Project/worktree isolation, diff review, user-approved changes | **Planned / 规划中** |
| v0.5 | Task queues, cross-review, test execution, recovery | **Planned / 规划中** |
| v1.0 | Installer/portable distribution, security hardening, release validation | **Planned / 规划中** |

## Near-term engineering backlog / 近期工程任务

- [ ] Validate Codex and DeepSeek CLI invocation formats on actual Windows installs; record known compatible versions.
- [ ] Verify `build.cmd` and `DualAgentStudio.exe` on Windows x64, including termination and CLI discovery.
- [ ] Implement Electron + TypeScript main process and renderer with IPC isolation.
- [ ] Replace one-shot shell commands with persistent stdio/SDK adapters where supported.
- [ ] Implement lifecycle handling (restart, timeout, process-tree cleanup, shutdown).
- [ ] Design local database/schema, retention, export, and privacy controls.
- [ ] Add a safe, explicit approval flow before any project changes.
- [ ] Document licensing, third-party terms, security reporting and release process.
- [ ] Add live integration tests only in separate opt-in workflows, never in public PR CI.

## Non-goals for current v0.1.x / 当前版本明确不做

- Model hosting or inference on the user's GPU / 在用户显卡上部署模型。
- Unattended source edits or automatic merge / 无人监管的项目修改和代码合并。
- Credentials inside releases / 在发行包中捆绑账号密钥。
- Local network/public network access / 对外开放网络服务。
