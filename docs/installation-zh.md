# 安装指南

[English](installation.md) · [返回 README](../README-zh.md)

## 环境要求

- **OpenCode V2**，已在 **2.0.26** 验证，不支持 V1。
- 支持鼠标操作和图标字体回退的终端。
- 从源码构建需要 Node.js 和 npm；OpenTUI 开发依赖声明要求 Node.js 26 或更高版本。

字体安装脚本支持稳定版 Windows Terminal，其他终端需手动配置字体。

## 安装

### 1. 构建插件

克隆或下载本仓库，在仓库目录打开终端，运行：

```sh
npm ci
npm run build
```

仓库需保存在固定目录，插件入口会引用其中的构建产物。

### 2. 创建本地 TUI 入口

在 OpenCode 配置目录中创建 `plugins/stats-pills/tui.ts`。默认配置目录为 `~/.config/opencode`；Windows 下为 `%USERPROFILE%\.config\opencode`。

```ts
export { default } from 'C:/path/to/opencode-stats-pills/dist/tui.mjs'
```

将示例路径替换为仓库的**绝对路径**。TypeScript 字符串中的路径使用正斜杠，Windows 下也一样。

### 3. 启用插件

在同一配置目录的 `cli.json` 中，将 `opencode-stats-pills` 加入 `plugins` 数组，合并到已有配置中。

```json
{
  "plugins": ["opencode-stats-pills"]
}
```

如果同时安装了 `opencode-tps-meter`，可以禁用它的 TUI 部分，避免重复显示统计：

```json
{
  "plugins": ["-opencode-tps-meter", "opencode-stats-pills"]
}
```

### 4. 配置图标字体

使用稳定版 Windows Terminal 时，在仓库根目录运行：

```powershell
pwsh -File ./scripts/install-icons.ps1
```

脚本会为当前用户安装附带字体，并将 **StatsPills Icons Large** 加入 Windows Terminal 默认字体回退列表；它会更新终端的 `settings.json`。

手动配置时，安装 [StatsPillsIcons.ttf](../assets/StatsPillsIcons.ttf)，将 **StatsPills Icons Large** 设置为终端的回退字体。Windows Terminal 的字体配置示例：

```json
{
  "font": {
    "face": "Cascadia Mono, StatsPills Icons Large"
  }
}
```

Windows Terminal 1.21 或更高版本支持这种回退配置。安装字体后，完全关闭并重新打开终端，再启动 OpenCode。
