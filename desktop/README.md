# Dual Agent Studio V0.2 Alpha

桌面工程位于本目录。仓库根目录仍可运行 V0.1.1 原型。

## 本地运行

需要 Node.js 22.12 或更新版本。在本目录执行：

```sh
npm ci
npm test
npm start
```

界面显示存储模式和两个模拟 Agent 的状态。输入任务后可以分别启动 Codex 和 DeepSeek 模拟子进程。两个适配器都使用内置 worker。主进程向 worker 的标准输入传递任务，读取标准输出和标准错误，并处理超时、停止和退出回收。

## 数据目录

Windows 使用程序所在目录中的 `portable.flag` 识别便携模式。单 EXE 启动时从 electron-builder 提供的原始启动器目录查找标记，避开临时解包目录。有标记时使用同级 `Data`，否则使用 `%APPDATA%\Dual Agent Studio`。路径不可写时显示启动错误。

Chromium 会话数据放在所选目录的 `Chromium/`。已确认的凭据方案使用 `Security/vault.dasv`，算法为 Argon2id 和 XChaCha20-Poly1305。在桌面界面的「加密凭据库」创建主密码后，可以保存或移除 Codex 与 DeepSeek 的测试凭据。退出程序会锁定凭据库。重启后用同一主密码解锁，界面只显示保存状态。主密码丢失后无法恢复已有凭据。本阶段使用假凭据验收，离线模拟进程不读取凭据。

## Windows x64 打包

在 Windows 上执行 `npm run package:win`。生成两种免安装产物。

| 发行形式 | 输出 | 数据行为 |
| --- | --- | --- |
| 单 EXE | `out/single/DualAgentStudio-<version>-Single.exe` | 默认标准目录。在 EXE 旁创建空的 `portable.flag` 可启用便携模式 |
| 便携文件夹 | `out/folder/win-unpacked/` | 构建时生成 `portable.flag`。保留整个文件夹并启动 `DualAgentStudio.exe` |

打包脚本使用 `publish: never`。

## Windows 验收

功能分支的 GitHub Actions 在通过桌面自动测试后生成两个 Windows x64 验收包。打开该次运行的 Artifacts 分别下载并解压。

1. 双击单 EXE。界面应显示标准模式，路径为 `%APPDATA%\Dual Agent Studio`。
2. 退出程序，在单 EXE 旁创建空的 `portable.flag`，再次启动。界面应显示便携模式，并使用同级 `Data`。
3. 将便携文件夹解压到普通用户可写目录，确认 `portable.flag` 与 `DualAgentStudio.exe` 在同一层。启动后确认进入便携模式。关闭程序，将整个文件夹移到另一处，再次打开并核对新路径下的 `Data`。
4. 输入任意测试文本，分别运行 Codex 和 DeepSeek。两个 Agent 都应显示完成，并输出各自的离线模拟结果。退出后检查任务管理器，确认相关进程已经退出。
