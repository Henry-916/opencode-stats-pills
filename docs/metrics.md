# Statistics

[简体中文](metrics-zh.md) · [Back to README](../README.md)

## Calculations

| Metric | Calculation |
| --- | --- |
| Generation speed | Tokens whose generation can be observed, divided by the matching total time; the span runs from streamed reasoning or the first text batch to model stream completion |
| Model time | Sum of step start → model stream completion durations; excludes subsequent tool execution |
| Average TTFT | Average step start → first output duration across eligible samples |
| Total tokens | Sum of completed model and compaction request `input + cache.read + cache.write + output + reasoning`, excluding title requests |
| Cache hit rate | `cache.read / (input + cache.read + cache.write)` |
| Context usage | Latest completed request input, including cache reads/writes, divided by that request model's context window; excludes output and reasoning |

For TTFT, the first output can be text, reasoning, a tool name, or tool arguments. In OpenCode V2, `time.streamed` marks **stream completion**, while `time.completed` may also include tool execution.

### What generation speed counts

A rate is only meaningful when the tokens in the numerator were generated during the time in the denominator. DSH divides all output tokens by first-output → stream-completion time, which assumes the client sees deltas as soon as the model starts generating. OpenCode's event stream does not satisfy that assumption:

- Reasoning can be entirely invisible: a request that does not ask for reasoning text gets only an encrypted payload, and brief reasoning returns no text even when asked. Those tokens are generated before the first output, and their time is counted as initial token wait.
- Tool calls often arrive whole: the model spends seconds generating arguments, and the client sees them milliseconds before the stream ends.
- A short reply may be a single batch of deltas, all generated before the stopwatch starts.

With the DSH formula, a measured 41-step session read 483.7 tok/s: its 39 tool-only steps contributed 10,046 tokens against 0.4 seconds. Text in the same session actually streamed at about 136 tok/s.

Speed therefore counts only output whose generation can be observed. Each step's span runs from streamed reasoning or the first text batch, whichever comes first, to model stream completion:

- Text: the step's `output` tokens, which cover text and tool calls. When text opens the span, the first text batch is deducted by character share (it was generated before the stopwatch started).
- Reasoning: reasoning text is a summary written after the fact. It trails the actual thinking, and its length does not track tokens. The plugin treats thinking as running since the step began and counts `reasoning` tokens only for the share of that time the reasoning blocks cover; gaps between blocks do not count as covered.
- When the reasoning stream covers less than half of that time, the step's reasoning is not counted. A summary that arrives in one burst at the end of a step is such a case: no generation was observed.
- Steps without such a span, and steps where a tool call precedes it, contribute neither tokens nor time.

### Data availability

- Speed has one definition. It excludes initial token wait and tool execution. Tokens and durations are summed before division; per-step rates are not averaged arithmetically.
- There is no duration threshold and no cap. A reply delivered in a single text batch has no measurable span and shows `—`; a session with only tool calls and brief reasoning also shows `—` until reasoning or text streams.
- Text deltas sharing a timestamp count as one batch. The first text batch's time and size are captured live and persisted; OpenCode's history does not store deltas, so steps without that record cannot restore a text span. Reasoning blocks keep their start and end times in history and need no capture.
- Whether reasoning text is returned depends on the provider and the request. In OpenCode 2.0.26, OpenAI Responses needs `reasoningSummary`, the native Gemini API needs `thinkingConfig`, and chat completions forward only `reasoningEffort`. Reasoning that returns no text is treated as invisible.
- Tool calls generated after the text and before the stream ends are counted. Hidden reasoning between text and a tool call lengthens the denominator and lowers the reading.
- The reading reflects the rate of visible output, not the precise internal generation time of every token. Counting reasoning by time share treats the initial token wait as thinking time, so that part reads slightly low.
- For TTFT, first output uses nonempty text, reasoning, tool-name or tool-argument timestamps; empty block starts do not count. Observed times are persisted, with historical timestamps as a supplementary source. When reasoning is invisible, TTFT includes the reasoning time.
- Tokens and cost use paginated request history, deduplicated by message ID, excluding title generation. Compaction requests with usage records remain included. Tokens and cost show `—` until the full history is loaded.
- External subagents that do not report usage to OpenCode cannot provide accurate token statistics through this plugin.
- Cache values normalized to zero by the host cannot distinguish missing upstream reporting from actual cache misses.
- Context is the latest request’s prompt-side input paired with its own model capacity; missing readings show `—`, not `0%`. DSH additionally projects subsequent surface changes. This plugin does not reproduce that projection or the system/tools/messages breakdown.

## Cost

Amounts are in USD. Custom rates are per million tokens:

`((uncached input + cache writes) × input + (output + reasoning) × output + cached reads × cacheRead) / 1,000,000`

Token buckets are disjoint; reasoning uses the output rate and cache writes use the input rate. Each completed request matches its own provider/model and is deduplicated by message ID. Session totals exclude child sessions. The most recent conversation turn sums completed model and compaction requests since the latest user message. A turn with no completed requests shows `—`.

Models without custom rates use OpenCode charges. A host value of `0` is treated as free only when model prices explicitly confirm that. Changing custom rates recalculates historical requests. Estimates may differ from invoices due to discounts or other charges.

Costs sum request records in the same session instead of the host session total that includes title charges. Title requests are excluded from tokens, cache hit rate, and cost. Missing records or unpriced requests yield `—`. See [configuration](../README.md#custom-prices).
