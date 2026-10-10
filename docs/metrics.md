# Statistics

[简体中文](metrics-zh.md) · [Back to README](../README.md)

## Calculations

| Metric | Calculation |
| --- | --- |
| Generation speed | Sum of output + reasoning tokens divided by total time from first output to model stream completion, across eligible completed steps |
| Model time | Sum of step start → model stream completion durations; excludes subsequent tool execution |
| Average TTFT | Average step start → first output duration across eligible samples |
| Total tokens | Sum of completed model and compaction request `input + cache.read + cache.write + output + reasoning`, excluding title requests |
| Cache hit rate | `cache.read / (input + cache.read + cache.write)` |
| Context usage | Token usage of the latest completed model step divided by the selected model's context window; child sessions use their own model |

The first output can be text, reasoning, or tool arguments. In OpenCode V2, `time.streamed` marks **stream completion**, while `time.completed` may also include tool execution.

### Data availability

- Samples without reliable timing, with generation spans shorter than 100 ms, or with text timing but unobserved reasoning are excluded from full TPS. `—` means no eligible measurement is available. TTFT is evaluated separately.
- First output uses nonempty text, reasoning, or tool-argument delta timestamps. Empty block-start notifications do not count. Observed times are saved in durable host plugin storage and restored after TUI restarts.
- Unobserved historical replies use guarded content timestamps where available. Empty or briefly recorded reasoning blocks cannot recover actual generation timing; missing reliable records remain `—`.
- Hidden reasoning with token counts but no usable timing can retain observed-output TTFT. Its tokens are not divided by the text-only generation span.
- Tokens and cost use paginated request history, deduplicated by message ID, excluding title generation. Compaction requests with usage records remain included. Speed uses eligible assistant steps. Tokens and cost show `—` until the full history is loaded.
- External subagents that do not report usage to OpenCode cannot provide accurate token statistics through this plugin.
- Cache values normalized to zero by the host cannot distinguish missing upstream reporting from actual cache misses.
- Context is a recent-request reading, not cumulative session usage. A system/tools/messages breakdown is not available.

## Cost

Amounts are in USD. Custom rates are per million tokens:

`((uncached input + cache writes) × input + (output + reasoning) × output + cached reads × cacheRead) / 1,000,000`

Token buckets are disjoint; reasoning uses the output rate and cache writes use the input rate. Each completed request matches its own provider/model and is deduplicated by message ID. Session totals exclude child sessions. The most recent conversation turn sums completed model and compaction requests since the latest user message. A turn with no completed requests shows `—`.

Models without custom rates use OpenCode charges. A host value of `0` is treated as free only when model prices explicitly confirm that. Changing custom rates recalculates historical requests. Estimates may differ from invoices due to discounts or other charges.

Costs sum request records in the same session instead of the host session total that includes title charges. Title requests are excluded from tokens, cache hit rate, and cost. Missing records or unpriced requests yield `—`. See [configuration](../README.md#custom-prices).
