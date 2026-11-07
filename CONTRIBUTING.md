# Contributing / 贡献指南

Thanks for helping improve Dual Agent Studio. / 感谢参与 Dual Agent Studio。

## Before proposing a change / 提交修改之前

- Open an issue to discuss substantial architectural or protocol changes. / 大型架构调整请先讨论。
- Prefer small, clearly scoped PRs with a description of expected behavior. / 尽量保持 PR 小而明确。
- Do not commit model API keys, CLI login state, tokens, user data, local logs, `.env` files, or proprietary project code. / 禁止提交密钥、凭据、个人文件与私人项目代码。
- Do not use prompts or tests that cause agents to edit sensitive directories. / 不要使用会让 Agent 修改敏感目录的测试。

## Run checks / 执行检查

```sh
node --version
node --check server.js
node --test tests/*.test.js
```

No model credentials or credits are needed for the existing smoke tests. They **do not** verify integration with Codex or DeepSeek. / 测试无需账号额度，但**不代表真实 Agent 联调成功**。

## Pull request checklist / PR 检查项

- [ ] Change is explained in English or Chinese / 用中英文之一说明变更
- [ ] Tests added or updated where feasible / 尽可能补充测试
- [ ] Docs and version/status statements remain accurate / 文档功能状态准确
- [ ] No secrets, personal data, generated binaries, or private paths / 无秘密信息、私有路径和二进制生成物
- [ ] Read-only/default-deny behavior preserved / 保持默认最小权限

## Roadmap priorities / 开发优先级

Near-term work: Electron app shell, process lifecycle management, SDK/stdio adapters, durable local storage, and explicit user approvals before agent-driven file changes. / 近期优先：桌面外壳、进程管理、Agent 接口、会话存储，以及写入项目之前的用户审批。

This repository is independently maintained. Please be respectful in issues and code reviews. / 请在 Issue 和代码审查中保持尊重。
