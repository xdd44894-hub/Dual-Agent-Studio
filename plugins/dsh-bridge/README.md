# DSH Bridge 0.1.0

在 Windows 版 ChatGPT Work 的本地线程中，向现有 DSH 会话发送经你批准的提示词。桥接进程走 MCP stdio。两次批准都在 Windows 对话框里完成。

## 安装与绑定

需要 Windows 桌面交互会话、Node.js 22.12 或更高版本、本机 PATH 中可用的 `dsh`，以及支持本地插件的 ChatGPT 桌面版。

在本仓库的 PowerShell 中执行：

```powershell
Set-Location plugins/dsh-bridge
npm ci
npm test
dsh --profile headless --help
node dist/server.mjs bind my-project 'session-实际ID' 'E:\WorkSpace\实际项目目录'
```

用实际会话 ID 和该会话创建时的工作目录替换示例。DSH 只会续接相同工作目录下、且能被 headless 配置加载的既有会话。使用不同的别名可以登记另一个会话。旧别名的绑定文件位于 `%LOCALAPPDATA%\Dual Agent Studio\DSH Bridge\bindings`。绑定文件只记录 DSH 会话 ID 和工作目录。使用同一 DSH 配置目录，并确保 headless 已有可用的模型凭据。DSH 的 GUI 登录与 headless 凭据设置可能不同，详情见 [DSH headless 文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/headless)。

重新打开 ChatGPT 桌面版，从该仓库的本地插件列表安装 **DSH Bridge**。在目标本地 Work 对话中用 `@` 选择 DSH Bridge，然后说「用 my-project 会话问 DSH 这个问题」。以后在同一 Work 对话继续使用同一别名。别名由你指定，批准窗口会显示实际的 DSH 会话 ID 和目录。

1. 第一扇窗口里预览或编辑发送给 DSH 的提示词，再点 **Approve and send**。
2. 第二扇窗口里保留需要回传的文字，再点 **Approve and return**。
3. 结果回到发起工具调用的 Work 对话。之后明确要求继续时，双方沿用各自的会话上下文。

可先在 DSH 的已有会话里留下一个约定，然后从 Work 问「刚才约定的内容是什么」。重启桌面版后回到同一条 Work 对话，用同一别名再问一句上下文相关的问题。避免让 DSH 自己的界面和插件同时向同一会话提交任务。验证会使用 DSH 当前配置的模型。
