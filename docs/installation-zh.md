# 安装指南

[English](installation.md) · [返回 README](../README-zh.md)

## 环境要求

- **OpenCode V2**，已在 **2.0.26** 验证，不支持 V1。
- 支持鼠标操作的终端。
- 从源码构建需要 Node.js 和 npm；OpenTUI 开发依赖声明要求 Node.js 26 或更高版本。

无需安装字体。插件默认使用普通符号，检测到本机已有 StatsPills Icons Large v1.7 字体后使用专用图标。Windows 下先检查已安装字体目录中的版本化字体文件，必要时再查询字体注册表；Linux/macOS 下使用 fc-list；检测不可用或失败时继续使用普通符号。专用图标仍需要终端已配置该字体作为回退字体。插件不会安装字体或修改终端设置。

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
