# Installation

[简体中文](installation-zh.md) · [Back to README](../README.md)

## Requirements

- **OpenCode V2**. Tested with **2.0.26**; V1 is not supported.
- A terminal with mouse support and a fallback font for the bundled icons.
- Node.js and npm to build from source. The OpenTUI development dependencies declare Node.js 26 or later.

The font installer supports stable Windows Terminal. Other terminals need manual font setup.

## Installation

### 1. Build the plugin

Clone or download this repository, open a terminal in its directory, and run:

```sh
npm ci
npm run build
```

Keep this checkout in a permanent location: the local plugin entry points to its build output.

### 2. Create a local TUI entry

Create `plugins/stats-pills/tui.ts` inside your OpenCode configuration directory. The default directory is `~/.config/opencode`; on Windows, it is `%USERPROFILE%\.config\opencode`.

```ts
export { default } from 'C:/path/to/opencode-stats-pills/dist/tui.mjs'
```

Replace the example with the **absolute path** to your checkout. Use forward slashes in the TypeScript string, including on Windows.

### 3. Enable the plugin

Add `opencode-stats-pills` to the `plugins` array in `cli.json` in the same configuration directory. Merge it into your existing settings.

```json
{
  "plugins": ["opencode-stats-pills"]
}
```

If `opencode-tps-meter` is also installed, you can disable its TUI contribution to avoid duplicate statistics:

```json
{
  "plugins": ["-opencode-tps-meter", "opencode-stats-pills"]
}
```

### 4. Set up the icons

On stable Windows Terminal, run this script from the repository root:

```powershell
pwsh -File ./scripts/install-icons.ps1
```

The script installs the bundled font for the current user and adds **StatsPills Icons Large v1.7** to the default Windows Terminal font fallback list. It updates the terminal's `settings.json`.

For manual setup, install [StatsPillsIcons.ttf](../assets/StatsPillsIcons.ttf) and configure your terminal to use **StatsPills Icons Large v1.7** as a fallback. A Windows Terminal font setting can look like this:

```json
{
  "font": {
    "face": "Cascadia Mono, StatsPills Icons Large v1.7"
  }
}
```

Windows Terminal 1.21 or later supports this fallback format. Fully close and reopen your terminal after font installation, then restart OpenCode.
