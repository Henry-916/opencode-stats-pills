# OpenCode StatsPills

给 OpenCode V2 加一条轻量统计栏。不用展开侧栏，就能看到生成速度、Token 用量、缓存命中和上下文占用。

[English](README.md) · **简体中文**

```text
◴ 7.3 tok/s    ▤ 12.9K tok · 缓存命中 78%    ◌ 1%
```

## 快速开始

已在 **OpenCode 2.0.26** 验证。需要 OpenCode V2、Node.js/npm 和支持鼠标的终端。详细的依赖与字体要求见[安装指南](docs/installation-zh.md)。

### 让 OpenCode 帮你安装

复制下面的提示词发给 OpenCode：

```text
请帮我安装 https://github.com/Henry-916/opencode-stats-pills 。

先阅读仓库的 README 和安装指南，再完成构建、插件启用及图标字体配置。安装时请：
- 检查 OpenCode V2 和所需依赖；缺少工具或版本不兼容时，说明需要处理什么。
- 将仓库放在固定目录，用构建产物的绝对路径创建本地插件入口。
- 合并现有配置，不覆盖其他设置、不重复添加插件，保留本地改动和会话。
- 如果已启用 opencode-tps-meter，禁用它的 TUI 部分，避免重复显示。
- 按实际终端配置图标字体，保留当前正文字体。

完成后检查构建产物、入口和启用配置，说明安装位置及需要重启的程序。不要为了验证安装发送模型请求；未完成的步骤请明确告诉我。
```

### 手动安装

见[安装指南](docs/installation-zh.md)。

## 怎么用

悬浮在指标上会高亮，点击打开详情。按 **Esc** 或点击外部关闭。

| 指标 | 详情 |
| --- | --- |
| 速度 | 模型用时、平均首 Token 延迟、生成速度 |
| Token | 缓存命中、输入、缓存读取、输出、思考 |
| 上下文 | 最近请求用量、模型窗口、进度条 |

主会话显示在输入框下方，子会话显示在 **Subagents / Shell** 面板上方。每个会话单独统计，不会把子会话用量加到主会话上。

速度包含思考 Token。`—` 表示没有可用的时间样本，历史回复或批量回传时可能出现。计算方式和数据限制见[统计口径](docs/metrics-zh.md)。

## 参与贡献

**欢迎提 PR**：修复 bug、适配终端、翻译和补充文档。小改动可以直接提交；较大的改动请先开 issue 讨论。

开发步骤和提交要求见 [CONTRIBUTING.md](CONTRIBUTING.md#简体中文)。

反馈 bug 请附 OpenCode 版本、操作系统、终端和复现步骤。

## 致谢

界面设计参考 DeepSeek Harness（DSH）的 StatsPills。

## 许可证

[MIT](LICENSE)。
