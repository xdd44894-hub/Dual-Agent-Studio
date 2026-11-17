# DSH Bridge 0.3.0

Windows 上的两个本地插件共用一个收件箱。ChatGPT Work 侧显示三方聊天室，DeepSeek Harness 侧从你选的原会话领取消息并回帖。

## 安装

在仓库的 `plugins/dsh-bridge` 目录打开 PowerShell。需要 Node.js 22.12 或更高版本。

```powershell
npm ci
npm run install:local
$Bridge = "$env:USERPROFILE\.codex\plugins\dsh-bridge\dist\server.mjs"
$Receiver = node $Bridge setup-receiver threeway
$Receiver
```

最后一行打印 DSH 接收插件的绝对目录。它在 `%LOCALAPPDATA%\Dual Agent Studio\DSH Bridge\receiver-threeway`。重复生成会保留收件箱历史。

- **Work 侧**。完全退出并重开 ChatGPT 桌面版，从个人本地插件目录更新 **DSH Bridge** 到 0.3.0。在本地 Work 对话里用 `@` 选中它，说「打开 `threeway` 三方聊天室」。已安装旧版时，如果插件页仍显示 0.2.0，移除旧版后从本地目录重新安装。
- **DSH 侧**。在 DSH 专用对话里，让它用 `plugin_manager` 的 `install_bundle` 安装上面打印的绝对目录，并在 DSH 界面批准安装。也可以在 PowerShell 对当前正在使用的 DSH 启动配置执行 `dsh plugin --profile <当前配置名> add "$Receiver"`。启用后，DSH 会看到 `mcp__threeway__receive_message` 和 `mcp__threeway__post_reply` 两个工具。该插件需要 DSH 的 MCP Manager，近期 Web 和桌面配置均包含它。

## 使用

1. 在 Work 房间写一句话，点「批准并发送给 DSH」。
2. 回到 DSH 的专用对话，说「用 threeway 插件领一条待处理消息，结合本对话的上下文回答，再用 post_reply 把回复发回房间」。同一个对话会保留 DSH 的原生上下文。
3. 回复会出现在 Work 右侧时间线。点「选择回传给 Work 的文字」，编辑并批准后，选定文字会进入当前 Work 对话。

第一版在 DSH 侧手动领取。接收插件按房间别名限定访问范围，安装在 DSH 配置中的工具可能也会被其他对话看见，请在专用对话使用。持久化的房间和收件箱消息以明文保存在本机 `%LOCALAPPDATA%\Dual Agent Studio\DSH Bridge\rooms`，面板显示最近 100 条。以同一别名重新打开可以恢复时间线和待回消息。
