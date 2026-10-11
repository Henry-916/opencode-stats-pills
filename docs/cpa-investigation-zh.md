# CPA 流式计时调查

调查日期：2026-10-10。实际运行版本：CLIProxyAPI 8.0.23，源码提交 d318bcc3afb9ea8782862f5e8cdb541afdc9dfa5。

## 发现

Gemini 原生接口能够逐段返回思考摘要。CPA 的 Gemini → OpenAI Responses 转换会暂存无签名的思考文本，直到签名到达或输出结束才发送。它保留了文本和 Token 数，却改变了客户端看到的首次输出时间。

直接绕过 OpenCode 的测试中，原版 Responses 的三段摘要在 9896–9897 ms 同时到达，正文在 9902 ms 到达。另一次原生接口测试中，摘要在 6421、8414、10969 ms 等时刻陆续到达，正文在 19981 ms 到达。两次生成并不相同，不能直接比较模型速度；它们揭示了摘要事件的到达方式。

对应源码：[gemini_openai-responses_response.go](https://github.com/router-for-me/CLIProxyAPI/blob/d318bcc3afb9ea8782862f5e8cdb541afdc9dfa5/internal/translator/gemini/openai/responses/gemini_openai-responses_response.go)。思考分支只有在 ReasoningEnc 非空时才调用 openReasoning；否则把 delta 放入 ReasoningPendingDeltas。

## 已验证的本地实验

临时补丁允许 ReasoningBuf 非空时立即 openReasoning，后到的签名在完成事件中保留。

- 新回归测试在原版上失败：第一段思考被缓冲；补丁版通过。
- Gemini 和 Antigravity Responses 转换测试通过。
- HTTP 上游等待客户端收到思考摘要再结束的执行器集成测试通过。
- 补丁版真实 Gemini 请求的摘要在 7558、10185、12728 ms 等时刻陆续到达，正文在 33323 ms 到达，不再全部集中在末尾。
- 携带上一轮输出的真实续聊返回 HTTP 200 并完成。
- GPT-6.1 Sol 测试中摘要在 5372–6548 ms 逐段到达，正文在 6592 ms 到达。该路径未修改。

## 当前状态与边界

用户要求尽量不修改 CPA 后，已恢复原版 8.0.23 程序，并核对与原版备份的 SHA256 一致。诊断用 payload 规则已撤销，其他配置值保持不变。恢复后的鉴权模型列表与管理页面均返回 HTTP 200。

仅修改插件无法恢复被上游转换层隐藏的首次摘要到达时间。请求全程平均方案试验后已撤回。速度随后改为只统计能观察到生成过程的区间（见 [DSH 统计对照记录](dsh-audit.md)）：思考摘要按其覆盖的时间比例计入，集中在末尾到达的摘要不计入；TTFT 仍受摘要到达时间限制。

## 原生接口验证与最终选择

隔离配置的 OpenCode 2.0.26 已完成 CPA 原生 Gemini 流式、工具调用和续聊验证，均返回 HTTP 200；工具结果与上一轮内容正确保留，思考签名随续聊请求回传。长回复收到 2 个思考摘要帧和 78 个正文帧。日常模型配置没有修改。

原生接口可以避开 Responses 转换缓冲，但摘要仍不等于模型内部思考的开始。短回答中 853 个思考 Token 的第一段摘要在约 6 秒后才出现，随后很快结束；用摘要到达时间作分母仍会产生偏高速度。

曾试验 [opencode-plugins 的请求平均算法](https://github.com/madsoftwaredev/opencode-plugins/blob/b77b397d5df1328509229ec319861f2d0b96d7e9/packages/stats/stats.ts)：输出与思考 Token / 请求开始到模型流结束的用时。该方案包含首 Token 等待，短回复读数明显偏低，已按用户要求撤回。CPA 和日常模型接口未调整。临时原生验证环境已清理。

2026-10-11 起，日常配置改为 GPT 走 Responses 并设置 `reasoningSummary`，Gemini 走 CPA 的原生接口并设置 `thinkingConfig`。CPA 本身没有修改。

## 已撤回方案的请求平均速度复核

读取原会话数据库，并直接调用修改后的 `reading()`、`fold()` 和 `speed()`，未发送新模型请求：

| 会话 | 输出与思考 Token | 模型用时 | 平均速度 |
| --- | ---: | ---: | ---: |
| `ses_eda7045aeffe6X7jlW6CrjKBh7` | 7 | 2.739 s | 2.6 tok/s |
| `ses_eda70030dffe5FhHMtjbKv6N0r` | 2,115 | 19.992 s | 105.8 tok/s |
| `ses_eda6ff130ffeQ0Oiu8c5O09Oz1` | 25,775 | 367.682 s | 70.1 tok/s |

第三个会话累计 42 个模型步骤，另有 75.825 s 工具用时，未加入速度分母。三个会话均有完整时间与用量，计算结果与用户截图中的回答末尾速度一致。这些读数是已撤回方案的验证结果，不代表当前生成阶段速度。
