# Statistics

[简体中文](metrics-zh.md) · [Back to README](../README.md)

## Calculations

| Metric | Calculation |
| --- | --- |
| Generation speed | Sum of output + reasoning tokens divided by total time from first output to model stream completion, across eligible completed steps |
| Model time | Sum of step start → model stream completion durations; excludes subsequent tool execution |
| Average TTFT | Average step start → first output duration across eligible samples |
| Total tokens | Host-reported session cumulative `input + cache.read + cache.write + output + reasoning` |
| Cache hit rate | `cache.read / (input + cache.read + cache.write)` |
| Context usage | Token usage of the latest completed model step divided by the selected model's context window; child sessions use their own model |

The first output can be text, reasoning, or tool arguments. In OpenCode V2, `time.streamed` marks **stream completion**, while `time.completed` may also include tool execution.

### Data availability

- Samples with missing timing, generation spans shorter than 100 ms, or reasoning timestamps detected as batched are excluded from speed calculations. `—` means no eligible measurement is available.
- Historical text-only responses cannot provide speed measurements if their first-output events are unavailable.
- Total tokens use the host's cumulative session accounting, which can include background requests. Speed uses completed assistant steps, so their accounting scopes can differ.
- External subagents that do not report usage to OpenCode cannot provide accurate token statistics through this plugin.
- Cache values normalized to zero by the host cannot distinguish missing upstream reporting from actual cache misses.
- Context is a recent-request reading, not cumulative session usage. A system/tools/messages breakdown is not available.
