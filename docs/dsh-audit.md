# DSH 统计对照记录

核对日期：2026-10-10。参考本机安装的 DeepSeek Harness `resources/app.asar`，以及 OpenCode 2.0.26 的 SDK 类型和可执行文件内的实现。没有把界面相似当作统计一致的证据。

## 源码依据

以下路径均为 DSH 安装包内部路径：

- `@deepseek-ai/dsh-client-ui-chat/lib/client.js`：`StatsPills`、`deriveStats`、`assistantStepReading`、`cacheHitPercent`、`billedInputTokens`。
- `@deepseek-ai/dsh-session-stats/lib/index.js`：`sessionStatsProjectionDefinition`。
- `@deepseek-ai/dsh-llm/lib/index.js`：`isTokenDelta`、`assistantStreamFirstTokenTime`。
- `@deepseek-ai/dsh-token-meter/lib/types/usage-projection.js`：Token 去重替换累计、`pressureFrom`、`contextPressureProjectionDefinition`。
- `@deepseek-ai/dsh-client-ui-conversation/lib/client.js`：`contextOccupancy`。
- `@deepseek-ai/dsh-llm-pi-ai/lib/index.js`：`mapUsage`。
- `@earendil-works/pi-ai/dist/api/openai-responses-shared.js`：供应商输出总量与其中的 reasoning 明细。

OpenCode 本机实现中，`AI.Usage.visibleOutputTokens` 为 `max(0, outputTokens - reasoningTokens)`；`N5` 把该值写入消息 `tokens.output`，并把 reasoning 单独写入 `tokens.reasoning`。`S0` 计费时重新相加。因此相加这两个 OpenCode 字段对应 DSH 的供应商输出总量，并非重复累计思考。

## 对照结果

请求全程平均方案试验后已按用户要求撤回，速度恢复 DSH 的生成阶段分母。其余统计范围保持不变。

| 项目 | DSH | StatsPills 的处理 |
| --- | --- | --- |
| 速度 | 累计供应商输出 Token / 累计首输出到模型消息结算的时长 | `output + reasoning` / 累计首输出到 `time.streamed` 的时长；排除首 Token 等待，没有双模式或 100ms 门槛 |
| 首输出 | 非空正文、思考，或包含工具名称/参数的增量 | 正文、思考、参数增量和工具名称事件；工具名称不再等到参数事件才计时 |
| 零生成时长 | 有用量时保留 Token，累计时长为正才显示速度 | 有用量时保留 Token，累计生成时长为正才显示速度 |
| 模型用时 | 模型阶段累计，不含后续工具执行 | 使用 `time.streamed`，不用包含工具执行的 `time.completed`；长时长改为分钟显示 |
| Token 总量 | 未缓存输入 + 缓存读取 + 缓存写入 + 供应商输出总量 | 逐消息 ID 去重累计对应的五个 OpenCode 桶；标题按用户要求排除 |
| 缓存命中 | 缓存读取 / 全部输入桶；接近 100% 时增加显示精度 | 分母一致；修正原先 `<100%` 和 99.5% 边界，按需增加小数位 |
| 上下文 | 请求输入作为基准，加后续可见内容的投影变化；窗口来自请求上下文 | 修正为最近请求的输入基准和该请求模型窗口；不再把输出/思考账单加进输入，也不混用新选择的模型窗口；未知显示 `—` |
| 费用 | 本次读取的原版 StatsPills 没有费用 pill | 项目扩展，保留用户指定的自定义单价；以各请求的模型计费，标题与子会话不计入主会话 |

## 尚未复现的能力

- DSH 在生成源头保留增量时间，持久日志也可恢复。OpenCode 的 TUI 正文和思考增量经过 100ms 合并；插件保存的是收到的事件时间，短回复的生成时长可能被压缩。这会影响生成速度和 TTFT；短回复读数可能偏高，未设置读数上限。历史纯文本若没有插件采集记录，也无法恢复准确首输出时间。
- DSH 的上下文占用会随回复、工具结果、用户内容及压缩后的可见内容更新，并有请求头、图片和文件等估算逻辑。当前插件只显示最近请求输入基准，没有复现这些投影。它不应被描述成完整的 DSH 上下文估算器。
- DSH 的 Token 投影可累计报告用量的重试 attempt，并避免同一 attempt 的重复结算。当前插件依赖 OpenCode 消息明细；未单独保留的失败 attempt 用量无法重建。分页明细和按消息 ID 去重只能保证已报告的消息记录不重复。
- 缓存上游缺报经过 OpenCode 归零后无法与真实零用量区分。缺失定价请求使会话费用显示 `—`，不会当作免费。

这些差异记录在维护文档中，不在 pill 弹窗中加入调试说明。

## 验证

- 回归测试覆盖加权生成速度、思考桶、零时长混合累计、首输出恢复、工具名称、上下文输入、缺失值、缓存舍入和自定义计费。
- 只读核对已有 OpenCode 会话 `ses_edac34815ffejU0s3UypZJvLVy` 的三个完成请求：未缓存输入 21,122，缓存读取 18,432，正文输出 118，思考 989，总量 40,661。最近请求输入基准为 19,760。核对期间没有发送模型请求。
- `npm run typecheck`、`npm test` 和 `npm run build` 通过。测试和源码核对不能替代重新启动后的真实生成事件验证。
