# OpenCode StatsPills

A compact stats bar for OpenCode V2: generation speed, token usage, cache hits, cost, and context usage at a glance, without opening the sidebar.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-V2%20·%20tested%202.0.29-black.svg)](https://opencode.ai)

**English** · [简体中文](README-zh.md)

![StatsPills below the OpenCode input box](assets/screenshots/hero.png)

## Features

![Stats bar](assets/screenshots/stats-bar.png)

- **Speed**: streamed output speed (tok/s), model time, and average time to first token
- **Tokens**: total usage with cache hit rate, plus input, cached reads, output, and reasoning
- **Cost**: current session and most recent turn, with optional custom per-model prices
- **Context**: usage of the model's context window, calculated the same way as OpenCode itself
- Click any pill for details; main and subagent sessions are tracked separately
- Works without extra fonts; optional custom icons

> [!NOTE]
> The UI text is currently in Chinese. Translations are welcome.

## Requirements

- **OpenCode V2** (tested on **2.0.29**; V1 is not supported)
- Node.js and npm, to build from source
- A terminal with mouse support

## Installation

### Let OpenCode install it

Copy this prompt into OpenCode:

```text
Install the OpenCode plugin https://github.com/Henry-916/opencode-stats-pills for me. The steps are in docs/installation.md in that repository; follow that guide.

Before changing anything, ask me whether I also want the optional custom icons. Tell me what they involve (installing a font and adding it to my terminal's font fallback) so I can decide.

While installing:
- Put the repository somewhere permanent, not in a temporary folder or my current project. OpenCode loads the plugin from its build output, so the folder can't move later.
- Add to my existing OpenCode config without removing or overwriting anything.
- If a step fails or my setup doesn't match the guide, stop and tell me instead of working around it.

When you're done, tell me where the repository is and which files you changed, and remind me to restart OpenCode.
```

### Install manually

Build the plugin, point a local TUI entry at the build output, and enable it in `cli.json`. Step-by-step instructions and the optional custom icons are in the [installation guide](docs/installation.md).

## Usage

In a main session, the bar sits below the input box. In a subagent session, it sits above the **Subagents / Shell** panel.

Hover over a pill to highlight it, then click to open its details. Press **Esc** or click outside to close.

<table>
  <tr>
    <td width="50%"><b>Speed</b>: model time, average TTFT, generation speed<br><img src="assets/screenshots/session-stats.png" alt="Speed details"></td>
    <td width="50%"><b>Tokens</b>: cache hits, uncached input, cached reads, output, reasoning<br><img src="assets/screenshots/token-usage.png" alt="Token details"></td>
  </tr>
  <tr>
    <td width="50%"><b>Cost</b>: current session, most recent conversation turn<br><img src="assets/screenshots/cost.png" alt="Cost details"></td>
    <td width="50%"><b>Context</b>: latest request usage, context window, progress bar<br><img src="assets/screenshots/context-usage.png" alt="Context details"></td>
  </tr>
</table>

Each session has its own totals; subagent usage is not added to its parent.

### How the numbers are measured

- **Speed** counts only output whose generation can be observed: tokens generated between the start of streamed reasoning or the first text batch and model stream completion, divided by that time. It excludes initial token wait, reasoning that returns no text, and tool execution.
- **Tokens and cost** sum the model and compaction requests in the session, excluding automatic title generation.
- **`—`** means there is nothing reliable to show yet, for example a step with only tool calls and brief reasoning, a reply delivered in a single batch, incomplete history, or an unpriced request. The plugin never estimates a missing value.

The [statistics reference](docs/metrics.md) explains every calculation and its limitations.

## Configuration

### Custom prices

By default, cost comes from OpenCode's own charges. To use your own rates, replace `"opencode-stats-pills"` in the `plugins` array of `cli.json` with this object, keeping your other settings:

```json
{
  "package": "/absolute/path/to/opencode/plugins/stats-pills",
  "options": {
    "prices": {
      "your-provider-id": {
        "your-model-id": {
          "input": 1.0,
          "output": 2.0,
          "cacheRead": 0.1
        }
      }
    }
  }
}
```

- Set `package` to the absolute path of the local plugin directory containing `tui.ts`, for example `C:/Users/your-name/.config/opencode/plugins/stats-pills` on Windows. Do not use the plugin ID `opencode-stats-pills`: OpenCode 2.0.26 does not pass options when enabling an already discovered plugin by ID.
- Rates are in **USD per million tokens**. The numbers above are examples; enter your provider ID, model ID, and actual rates, then restart OpenCode.
- `input` and `output` are required. Reasoning uses the output rate; cache writes use the input rate.
- `cacheRead` may be omitted when cached reads are unused; cached reads without a rate make the cost unavailable. Set an explicit `0` for free buckets.

Custom prices override OpenCode charges for matching models; other models keep using host charges. Changing rates recalculates existing requests. Amounts are estimates, not invoices.

## Contributing

**PRs are welcome**: fixes, terminal support, translations, and documentation. Small changes can go straight to a PR; for larger changes, please open an issue first.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and PR requirements. Bug reports should include your OpenCode version, OS, terminal, and steps to reproduce.

## Credits

The interface is inspired by the StatsPills in DeepSeek Harness (DSH).

## License

[MIT](LICENSE)
