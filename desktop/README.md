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

Chromium 会话数据放在所选目录的 `Chromium/`。已确认的凭据方案使用 `Security/vault.dasv`，算法为 Argon2id 和 XChaCha20-Poly1305。本阶段只创建 `Security/` 目录。加密库和凭据录入留待接入阶段。

## Windows x64 打包

在 Windows 上执行 `npm run package:win`。生成两种免安装产物。

| 发行形式 | 输出 | 数据行为 |
| --- | --- | --- |
| 单 EXE | `out/single/DualAgentStudio-<version>-Single.exe` | 默认标准目录。在 EXE 旁创建空的 `portable.flag` 可启用便携模式 |
| 便携文件夹 | `out/folder/win-unpacked/` | 构建时生成 `portable.flag`。保留整个文件夹并启动 `DualAgentStudio.exe` |

打包脚本使用 `publish: never`。
