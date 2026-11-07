# Security policy / 安全说明

**Prototype warning / 原型警告：** The application invokes local external CLI programs. Provider-specific `read-only` options and instruction prompts are a **best-effort restriction, not a security guarantee**. Do not run it with access to secrets, sensitive repositories, or untrusted commands. / 本工具会调用本地 CLI；“只读”参数和提示词不能代替真正的安全沙箱。请勿开放敏感数据访问权限。

## Supported status / 支持状态

v0.1.1 is an experimental preview. No security audits or paid bug bounty program are offered. / v0.1.1 尚未通过专业安全审计。

## What the current prototype does / 目前的保护

- Binds the coordinator to the loopback interface (`127.0.0.1`) only.
- Rejects non-local `Host` headers and foreign browser `Origin` values.
- Requires JSON POST requests and enforces request body and task length limits.
- Passes task text via stdin rather than shell string interpolation.
- Spawns CLIs in a separate user-data test directory by default.

These controls reduce some risks but do **not** make the HTTP endpoint safe to expose on the LAN, Internet, or through port forwarding. / 不应将此服务映射到局域网或互联网。

## Known gaps / 已知限制

- There is **no local authentication** or per-request approval for the HTTP endpoint. Other programs under the same computer user's account may be able to send requests.
- The original prototype calls external CLI programs via a Windows command shell and assumes the installed binaries are trusted.
- Each call creates a new process; forced timeouts may not reliably terminate an entire spawned process tree.
- Model providers may receive prompts and context over the network; credentials and service limits are controlled by each provider.
- There is no hardened workspace sandbox, no permission broker, no secure credential vault, no installer signature, and no general supply-chain audit.
- Read-only restrictions vary by agent and have **not** been independently verified against installed versions.

## Sensitive issue reporting / 漏洞报告

**Do not disclose exploit details or credentials in a public issue.** Before publication, configure GitHub's private vulnerability reporting under **Settings → Security → Private vulnerability reporting**, where supported. Otherwise use a private maintainer contact agreed at publication time. / 请勿在公开 Issue 中发布利用细节；正式发布前需启用私密漏洞报告渠道。

## Safe contribution rules / 提交安全规则

Never commit `.env*`, login caches, API tokens, files from `%APPDATA%` or `%LOCALAPPDATA%`, real user prompts, agent output logs, workspaces, or private material. / 禁止提交密钥、本地账号文件、用户提示词、日志和私人工作区。
