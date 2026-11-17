# DSH Bridge 0.2.0

在 Windows 版 ChatGPT Work 的本地对话中打开三方聊天室。你、Work 和 DSH 的消息在一条时间线上显示。桥接进程走 MCP stdio。

## 安装与绑定

需要 Windows 桌面交互会话、Node.js 22.12 或更高版本、本机 PATH 中可用的 `dsh`，以及支持本地插件的 ChatGPT 桌面版。

在本仓库的 PowerShell 中执行：

```powershell
Set-Location plugins/dsh-bridge
npm ci
npm run install:local
dsh --profile headless --help
node dist/server.mjs bind my-project 'session-实际ID' 'E:\WorkSpace\实际项目目录'
```

用实际会话 ID 和该会话创建时的工作目录替换示例。DSH 只会续接相同工作目录下、且能被 headless 配置加载的既有会话。使用不同的别名可以登记另一个会话。旧别名的绑定文件位于 `%LOCALAPPDATA%\Dual Agent Studio\DSH Bridge\bindings`。绑定文件只记录 DSH 会话 ID 和工作目录。使用同一 DSH 配置目录，并确保 headless 已有可用的模型凭据。DSH 的 GUI 登录与 headless 凭据设置可能不同，详情见 [DSH headless 文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/headless)。

完全退出并重新打开 ChatGPT 桌面版，在「插件」中找到安装命令打印的本地目录名称，再安装或更新 **DSH Bridge**。安装命令会把构建好的插件登记到个人本地目录和 `~/.agents/plugins/marketplace.json`，可以在其他项目的本地 Work 对话中找到它。在目标本地 Work 对话里用 `@` 选择 DSH Bridge，说「打开 my-project 的三方聊天室」。DSH 侧用你专门创建的会话。第一版复用 DSH 的 headless 入口，安装 Work 插件和绑定 DSH 会话后即可接入。

- **你发言**时，可以只加入房间，发给 Work，或批准发给 DSH。
- **Work 回复**时用插件把回复加入同一条时间线。你可以把它载入编辑框，审阅后再发给 DSH。
- **DSH 回复**后先显示在房间。点「选择回传给 Work 的文字」，编辑确认后，选定文本会进入当前 Work 对话。

回到原来的 Work 对话重新打开同一别名，DSH 会继续使用同一个会话 ID。房间消息以本地明文保存在 `%LOCALAPPDATA%\Dual Agent Studio\DSH Bridge\rooms`，面板显示最近 100 条。用不同别名可分开不同对话。Work 对话由你选择，别名不会自动绑定到某条 Work 线程。

验收时可以让 DSH 在专用会话记一个约定，再从房间询问该约定。随后批准回传其中一段，让 Work 回应，确认三方发言出现在同一个面板。最后关闭并重新打开同一房间，确认时间线恢复。验证会使用 DSH 当前配置的模型，避免同时从 DSH 原界面提交到正在运行的同一会话。
