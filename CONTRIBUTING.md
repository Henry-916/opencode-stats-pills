# Contributing

PRs for code, documentation, translations, and terminal compatibility are welcome.

## Before you start

Small fixes can go straight to a PR. For a new feature or a larger redesign, open an issue first to discuss the direction. Bug reports should include the OpenCode version, OS, terminal, and reproducible steps.

## Local setup

Fork the repository, clone your fork, and create a branch for your change. From the repository root:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Use the local entry described in [the installation guide](docs/installation.md) to load your build into OpenCode. Restart OpenCode after rebuilding.

## Sending a PR

- Keep the change focused; avoid unrelated formatting or dependency updates.
- Explain the problem and what the change does. Link an issue if there is one.
- Run the checks relevant to your change. Add regression tests for changes to statistics logic where needed. Documentation-only changes do not need a plugin build.
- For UI changes, include a screenshot and your OpenCode/terminal versions. Check main and child sessions if the shared layout changes.
- Keep the English and Chinese documentation in sync when changing shared instructions.

Icon detection is read-only. Keep the ordinary-symbol fallback working without installing fonts or modifying terminal settings.

## 简体中文

欢迎贡献代码、文档、翻译和终端适配。小修复可以直接提 PR；新功能或较大的设计调整，建议先开 issue 讨论方向。

Fork 仓库后，克隆自己的 fork，并为改动创建分支。开发命令见上方；本地加载方式见[安装指南](docs/installation-zh.md)。重新构建后重启 OpenCode。

提交 PR 时：

- 一次聚焦一个问题，避免夹带无关格式修改或依赖更新。
- 说明问题、改动和验证方式；有对应 issue 时附上链接。
- 按改动范围运行检查。统计逻辑改动在有必要时补回归测试；纯文档改动不需要构建插件。
- 界面改动附截图及 OpenCode、终端版本。修改共享布局时检查主会话和子会话。
- 修改共同的使用说明时，同步中英文文档。

图标检测只读。请保持未安装字体时的普通符号回退，不安装字体或修改终端设置。
