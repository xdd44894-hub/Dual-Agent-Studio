# Installation / Windows 安装与测试

## Prerequisites / 前提

- Windows 10/11 (x64 for the included SEA build workflow).
- Node.js **25.5+ to build the standalone EXE**, Node.js 26 recommended.
- `codex` CLI and `dsh` CLI available from a PowerShell session for live integration.
- Each provider's authentication/usage entitlement (not provided by this repository).

## Source mode / 源码运行

Open PowerShell in the extracted repository root (not `C:\Windows\System32`):

```powershell
node --version
codex --version
dsh --version
npm.cmd start
```

Open `http://127.0.0.1:3700`. Keep the server console open while using this legacy prototype. Use `Ctrl+C` to stop it.

If `npm` is blocked by PowerShell execution policy, call **`npm.cmd`**, not `Set-ExecutionPolicy Unrestricted`. / 遇到 PowerShell 脚本策略限制时，改用 `npm.cmd`，不要修改全局执行策略。

## Build the legacy EXE / 构建旧版 EXE

```powershell
node --build-sea sea-config.json
```

or double-click `build.cmd`. Expected output: `dist\DualAgentStudio.exe`. The output runs as a local coordinator and launches the default browser; **this is not a native Electron desktop app**.

If unsigned, Windows SmartScreen may display a warning. Only run files you built yourself or verified from a trusted source. / 未签名 EXE 可能触发系统警告，仅运行自己构建或确认来源可信的文件。

## Smoke tests / 无额度测试

```powershell
node --check server.js
node --test
```

These do not call the agents. The tests start an isolated child server on an available loopback port with a temporary workspace, send local HTTP requests, then terminate it.

## Limitations / 注意事项

- `codex` or `dsh` being present does **not** mean logged in, online, or within quota.
- The CLI options used by the prototype may vary between versions; check the help output from your installed CLI. / CLI 参数可能随版本调整。
- The coordinator's process launcher and SEA executable require Windows compatibility validation before a public binary release.
- No model credentials are stored or distributed with the project.
