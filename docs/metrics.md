# Statistics

[简体中文](metrics-zh.md) · [Back to README](../README.md)

## Calculations

| Metric | Calculation |
| --- | --- |
| Generation speed | Sum of output + reasoning tokens divided by total first-output → model-stream-completion time across eligible steps; the DSH generation-phase weighted mean |
| Model time | Sum of step start → model stream completion durations; excludes subsequent tool execution |
| Average TTFT | Average step start → first output duration across eligible samples |
| Total tokens | Sum of completed model and compaction request `input + cache.read + cache.write + output + reasoning`, excluding title requests |
| Cache hit rate | `cache.read / (input + cache.read + cache.write)` |
| Context usage | Latest completed request input, including cache reads/writes, divided by that request model's context window; excludes output and reasoning |

The first output can be text, reasoning, a tool name, or tool arguments. In OpenCode V2, `time.streamed` marks **stream completion**, while `time.completed` may also include tool execution.

### Data availability

- Speed has one definition. It excludes initial token wait and tool execution. Tokens and generation durations are summed before division; per-step rates are not averaged arithmetically.
- There is no 100 ms threshold or multiple-delta requirement. Valid first-output timestamps and usage participate; missing first output, missing usage or invalid times contribute neither tokens nor time. Zero-duration samples retain their tokens in mixed aggregates; total generation duration must be positive. No eligible samples means `—`.
- First output uses nonempty text, reasoning, tool-name or tool-argument timestamps; empty block starts do not count. Observed times are persisted, with historical timestamps as a supplementary source.
- Coalescing or delayed reasoning summaries can shorten measured generation spans and produce high TPS on short replies. Rates are not capped or replaced with whole-request averages. Use longer replies to check stability; the reading does not measure the precise internal generation time of every token.
- Tokens and cost use paginated request history, deduplicated by message ID, excluding title generation. Compaction requests with usage records remain included. Speed uses eligible assistant steps. Tokens and cost show `—` until the full history is loaded.
- External subagents that do not report usage to OpenCode cannot provide accurate token statistics through this plugin.
- Cache values normalized to zero by the host cannot distinguish missing upstream reporting from actual cache misses.
- Context is the latest request’s prompt-side input paired with its own model capacity; missing readings show `—`, not `0%`. DSH additionally projects subsequent surface changes. This plugin does not reproduce that projection or the system/tools/messages breakdown.

## Cost

Amounts are in USD. Custom rates are per million tokens:

`((uncached input + cache writes) × input + (output + reasoning) × output + cached reads × cacheRead) / 1,000,000`

Token buckets are disjoint; reasoning uses the output rate and cache writes use the input rate. Each completed request matches its own provider/model and is deduplicated by message ID. Session totals exclude child sessions. The most recent conversation turn sums completed model and compaction requests since the latest user message. A turn with no completed requests shows `—`.

Models without custom rates use OpenCode charges. A host value of `0` is treated as free only when model prices explicitly confirm that. Changing custom rates recalculates historical requests. Estimates may differ from invoices due to discounts or other charges.

Costs sum request records in the same session instead of the host session total that includes title charges. Title requests are excluded from tokens, cache hit rate, and cost. Missing records or unpriced requests yield `—`. See [configuration](../README.md#custom-prices).
