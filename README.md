# opencode-stats-pills

OpenCode V2 输入框下方的性能与用量统计插件，参考 DSH 的 StatsPills / TimePill / UsagePill 和独立 ContextMeter。实现为原创 TUI 代码，没有复制 DSH 分发包的代码。

```text
◴ 7.3 tok/s    ▤ 12.9K tok · 缓存命中 —    ◌ 1%
```

## 使用

- 悬浮：文字提亮和背景高亮。
- 点击速度、用量、上下文：在对应位置上方打开详情；面板会限制在终端范围内。
- Esc 或点击外部：关闭，并恢复输入焦点。
- 保留宿主原来的上下文提示、忙碌状态和命令入口；没有轮数/步数。

## 本机安装

已安装的全局入口：`C:/Users/24701/.config/opencode/plugins/stats-pills/tui.ts`。

```ts
export { default } from 'C:/Users/24701/Desktop/opencode-stats-pills/dist/tui.mjs'
```

`cli.json` 已启用 `opencode-stats-pills`，并通过 `-opencode-tps-meter` 禁用旧 TPS 插件。OMO-Slim 保留。

源码修改后运行：

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

重新打开 OpenCode V2 加载构建结果。退出应用不会删除已有会话。

## 统计口径

| 指标 | 实现 |
| --- | --- |
| tok/s | 当前会话已完成模型步骤的输出和推理 Token / 首个文本/思考/工具参数开始，到模型流结束的累计时长；排除首 Token 等待和工具运行时间 |
| 过短样本 | 首 Token 后不足 100ms 或没有时间数据时，不计入速度；没有有效样本显示 — |
| Token 总量 | 宿主的会话累计 input + cache.read + cache.write + output + reasoning，包含后台请求用量 |
| 缓存命中 | cache.read / (input + cache.read + cache.write)，无分母或缺数据显示 — |
| 上下文 | 最近完成模型步骤的 Token usage / 当前选中模型窗口；完成模型步骤后刷新 |

会话累计用量可能与右侧“最近请求上下文”不同，这是两个不同范围的数据。宿主把未上报的缓存值归一化为零时，插件无法区分“上游没有上报”和“确实没有命中”；详情中说明了这一限制。

历史按官方 message.list 分页读取。速度仅统计模型步骤，Token 总量使用宿主累计值，因此两者不强求覆盖完全相同的后台请求集合。上下文没有可靠的 system/tools/messages 分类数据，暂不虚构分类图。

## DSH 参考与差异

本地 DSH 0.2.0-rc.2 的 `dsh-client-ui-chat/lib/client.js` 中 StatsPills 挂在 `conversation.composer.dock`，包含 TimePill、UsagePill；ContextMeter 来自 `dsh-client-ui-conversation`。参考其居中布局、弱对比、悬浮高亮、上方详情、Esc/外部点击关闭和会话累计统计方式。

DSH 是图形 UI，OpenCode 使用终端事件和组件。这里采用终端面板展示明细。OpenCode 2.0.26 的 prompt.footer 容器默认是单行，插件局部调整其换行和行间距，以保留宿主页脚；这个布局适配在后续宿主版本需要重新验收。

## 验证

在 OpenCode 2.0.26 的独立终端进程和已有会话中验证：插件加载、历史读取、独立统计行、原有页脚保留、悬浮、三种鼠标详情、外部点击和 Esc 关闭。未发送新的付费模型请求，尚未验证长回答持续生成、浅色主题和不同终端尺寸。

8 项核心统计测试通过，TypeScript 检查与构建通过。

参考官方插件 API： https://opencode.ai/v2/docs/build/plugins/cli/

## 2026-10-10 修正

V2 的 `message.time.streamed` 是模型流结束，不是首 Token。`completed` 可能包含工具执行。原实现误读这两个字段，导致工具等待计入分母，并将正常生成误判为短样本。现在生成速度始终包含 `output + reasoning`，分母为首输出事件到 `streamed`；模型用时为 `created → streamed`。缓存投影更新不会覆盖更早的首输出时间。

历史首输出时间来自 reasoning/tool 的持久化时间或仍可重放的事件日志；纯文本历史若没有可重放日志，不能精确恢复首 Token，因此不参与速度样本。新会话中的文本、思考和工具参数开始都会实时记录。没有把等待时间当作首 Token，也没有用字数估算 token。

复核截图会话：输出 19,117，思考 28,709，有效生成时间 356.449 秒，速度 134.2 tok/s；工具 1043.970 秒排除。宿主累计输出 19,196 与模型步骤输出范围略有不同。UI 移除了统计范围、短样本、缓存说明、关闭提示和未知分类等文案；思考和缓存写入行仅在有用量时展示。

## 图标字体

三个图标为原创矢量字形：仪表盘、数据库圆柱、上下文圆环。`assets/StatsPillsIcons.ttf` 使用 U+E900–U+E902，单个终端字符宽；正文继续使用原字体。Windows Terminal 1.21+ 支持逗号分隔的字体回退，当前本机 1.24 已设置为 `Cascadia Mono, StatsPills Icons Large`。

安装字体及回退设置：`./scripts/install-icons.ps1`。安装后完全关闭并重新打开终端，以刷新字体缓存。字体源码为 `scripts/build-icons.py`，重新构建需要 Python fonttools。其他终端需要自行把 StatsPills Icons 设置为回退字体。

Windows Terminal 字体回退文档：https://devblogs.microsoft.com/commandline/windows-terminal-preview-1-21-release/

图标 1.1：字形放大 40%，保持 1200 单位字符宽度与正文行高，调整垂直位置。预览中的图标与正文采用相同字号。新字体族名为 StatsPills Icons Large，以避免正在运行的终端占用旧字体文件及缓存旧字形。

## 子会话统计栏位置

子会话不渲染 prompt.footer。通过 session.composer.top 在 Subagents/Shell 面板上方显示该子会话的 StatsPills，居中排列并与面板留一行间距。上下文窗口使用子会话自身模型，避免沿用主会话模型。已在“制作鹈鹕骑车 SVG 动画”子会话中验证显示、详情和关闭。

该子会话中的部分 Gemini 请求把思考批量回传，思考时间戳只有几毫秒，无法恢复真实首 Token；这类样本不用于速度/TTFT，避免显示虚高 TPS。模型用时和 Token 用量仍可读取。
