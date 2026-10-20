# Installation

[简体中文](installation-zh.md) · [Back to README](../README.md)

## Requirements

- **OpenCode V2**. Tested with **2.1.0**; V1 is not supported.
- A terminal with mouse support.
- Node.js and npm to build from source. The OpenTUI development dependencies declare Node.js 26 or later.

No font installation is required. The plugin uses ordinary symbols by default and selects custom icons if it detects the existing StatsPills Icons Large v1.7 font. On Windows, detection first checks the existing versioned font file in installed font directories, then queries the font registry if needed. Linux/macOS detection uses fc-list; if detection is unavailable or fails, ordinary symbols remain. Custom icons still require the terminal to use that font as a fallback. The plugin does not install fonts or change terminal settings.

## Installation

### Custom icons (optional)

Custom icons are an optional easter egg; ordinary use does not require installing a font. To try them on Windows, manually run from the repository root:

```powershell
pwsh -File ./scripts/install-icons.ps1
```

The script installs the bundled font for the current user. It does not download anything or read or modify the terminal's `settings.json`. Neither the plugin nor the standard installation steps run it automatically. Add `-WhatIf` to preview the operation.

Then manually add **StatsPills Icons Large v1.7** to your terminal's font fallback list, keeping your main font. For example, if your Windows Terminal profile uses `Cascadia Mono`, set that profile's `font.face` to `Cascadia Mono, StatsPills Icons Large v1.7`. Other terminals require their own fallback settings; you can also install the [font file](../assets/StatsPillsIcons.ttf) manually. Fully close and reopen the terminal, then start OpenCode.

Automatic detection checks whether the font is installed; the terminal must also have that font configured as a fallback. No plugin option is required.

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
