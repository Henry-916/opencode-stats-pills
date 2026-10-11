# OpenCode StatsPills

A small stats bar for OpenCode V2. See generation speed, token usage, cache hits, cost, and context usage without opening the sidebar.

**English** · [简体中文](README-zh.md)

![Stats bar](assets/screenshots/stats-bar.png)

![Session statistics](assets/screenshots/session-stats.png)

![Token usage](assets/screenshots/token-usage.png)

![Context usage](assets/screenshots/context-usage.png)

The UI is currently in Chinese. Icons automatically fall back to ordinary symbols when the existing custom font is not detected.

## Quick start

Tested on **OpenCode 2.0.26**. You need OpenCode V2, Node.js/npm, and a terminal with mouse support. See the [installation guide](docs/installation.md) for dependency requirements.

### Let OpenCode install it

Copy this prompt into OpenCode:

```text
Install https://github.com/Henry-916/opencode-stats-pills for me.

Read the repository's README and installation guide, then build and enable the plugin. During installation:
- Check OpenCode V2 and the required dependencies. Explain what needs attention if tools are missing or versions are incompatible.
- Keep the checkout in a permanent directory and create a local plugin entry using the build output's absolute path.
- Merge existing configuration without overwriting other settings or adding duplicate entries. Preserve local changes and sessions.
- If opencode-tps-meter is enabled, disable its TUI contribution to avoid duplicate statistics.
- Preserve my terminal and font settings.

Check the build output, entry path, and enabled configuration. Report the installation location and which applications need restarting. Do not send a model request just to verify installation; clearly report any incomplete steps.
```

### Install manually

See the [installation guide](docs/installation.md).

## Using it

Hover over a group to highlight it, then click to open its details. Press **Esc** or click outside to close.

| Group | Details |
| --- | --- |
| Speed | Model time, average TTFT, generation speed |
| Tokens | Cache hits, input, cached reads, output, reasoning |
| Cost | Current session, most recent conversation turn |
| Context | Recent request usage, context window, progress bar |

In a main session, the bar sits below the input box. In a child session, it sits above the **Subagents / Shell** panel. Each session has its own totals; child usage is not added to its parent.

`—` means no streamed output has been measured yet, such as steps with only tool calls and brief reasoning, or a reply delivered in a single batch. The [statistics reference](docs/metrics.md) explains the calculations and data limitations.

Output speed counts only output whose generation can be observed: tokens generated between the start of streamed reasoning or the first text batch and model stream completion, divided by that total time. It excludes initial token wait, reasoning that returns no text, and tool execution.

## Custom prices

In the `plugins` array of `cli.json`, replace `"opencode-stats-pills"` with this object. Keep your other settings:

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

Set `package` to the absolute path of the local plugin directory containing `tui.ts`, for example `C:/Users/your-name/.config/opencode/plugins/stats-pills` on Windows. Do not use the plugin ID `opencode-stats-pills`: OpenCode 2.0.26 does not pass options when enabling an already discovered plugin by ID.

Rates are in **USD per million tokens**. These numbers are examples; enter your provider ID, model ID, and actual rates, then restart OpenCode.

`input` and `output` are required. Reasoning uses the output rate; cache writes use the input rate. `cacheRead` may be omitted when cached reads are unused; cached reads without a rate make the cost unavailable. Set an explicit `0` for free buckets.

Custom prices override OpenCode charges for matching models. Other models use host charges. The cost pill sits between tokens and context; click it for the session total and most recent conversation turn. Changing rates recalculates existing requests. Amounts are estimates, not invoices.

Token usage and session cost sum model and compaction requests in the session timeline, excluding automatic title generation. Incomplete history or unpriced requests yield `—`. Parent and child sessions are calculated separately.

## Contributing

**PRs are welcome** — fixes, terminal support, translations, and documentation. Small changes can go straight to a PR; discuss larger changes in an issue first.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and PR requirements.

For bug reports, include your OpenCode version, OS, terminal, and steps to reproduce.

## Credits

The interface is inspired by DeepSeek Harness (DSH)'s StatsPills.

## License

[MIT](LICENSE).
