# OpenCode StatsPills

A small stats bar for OpenCode V2. See generation speed, token usage, cache hits, and context usage without opening the sidebar.

**English** · [简体中文](README-zh.md)

```text
◴ 7.3 tok/s    ▤ 12.9K tok · 缓存命中 78%    ◌ 1%
```

The UI is currently in Chinese and uses a bundled icon font.

## Quick start

Tested on **OpenCode 2.0.26**. You need OpenCode V2, Node.js/npm, and a terminal with mouse support. See the [installation guide](docs/installation.md) for dependency and font requirements.

### Let OpenCode install it

Copy this prompt into OpenCode:

```text
Install https://github.com/Henry-916/opencode-stats-pills for me.

Read the repository's README and installation guide, then build and enable the plugin and configure its icon font. During installation:
- Check OpenCode V2 and the required dependencies. Explain what needs attention if tools are missing or versions are incompatible.
- Keep the checkout in a permanent directory and create a local plugin entry using the build output's absolute path.
- Merge existing configuration without overwriting other settings or adding duplicate entries. Preserve local changes and sessions.
- If opencode-tps-meter is enabled, disable its TUI contribution to avoid duplicate statistics.
- Configure icons for the terminal I use, preserving my current main font.

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
| Context | Recent request usage, context window, progress bar |

In a main session, the bar sits below the input box. In a child session, it sits above the **Subagents / Shell** panel. Each session has its own totals; child usage is not added to its parent.

Generation speed includes reasoning tokens. `—` means there is no usable timing sample, which can happen with historical or batched responses. The [statistics reference](docs/metrics.md) explains the calculations and data limitations.

## Contributing

**PRs are welcome** — fixes, terminal support, translations, and documentation. Small changes can go straight to a PR; discuss larger changes in an issue first.

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and PR requirements.

For bug reports, include your OpenCode version, OS, terminal, and steps to reproduce.

## Credits

The interface is inspired by DeepSeek Harness (DSH)'s StatsPills.

## License

[MIT](LICENSE).
