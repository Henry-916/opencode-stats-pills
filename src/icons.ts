import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { win32 } from 'node:path';

export const iconFamily = 'StatsPills Icons Large v1.7';
export const customIcons = { time: '\uE900\uE904', usage: '\uE901', context: '\uE902', cost: '\uE903' };
export const plainIcons = { time: '◷', usage: '≡', context: '◉', cost: '$' };

// The former local installer used this versioned file name. Check installed
// font directories before rendering, without spawning a process in the TUI.
export function installedWindowsFont(
  exists: (path: string) => boolean = existsSync,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const local = env.LOCALAPPDATA ?? win32.join(env.USERPROFILE ?? homedir(), 'AppData', 'Local');
  const paths = [
    win32.join(local, 'Microsoft', 'Windows', 'Fonts', 'StatsPillsIcons-1.7.ttf'),
    win32.join(env.WINDIR ?? 'C:\\Windows', 'Fonts', 'StatsPillsIcons-1.7.ttf'),
  ];
  return paths.some(path => { try { return exists(path); } catch { return false; } });
}

export function initialIcons() {
  return process.platform === 'win32' && installedWindowsFont() ? customIcons : plainIcons;
}

type FontProbe = {
  run: (command: string, args: string[]) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
};
const probe: FontProbe = {
  run: (command, args) => new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', windowsHide: true, timeout: 3000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => error ? reject(error) : resolve(stdout));
  }),
  exists: async path => { try { await access(path); return true; } catch { return false; } },
};

// Read-only, bounded probes. Missing tools, files or permissions select plain icons.
export async function detectIconFont(platform: string = process.platform, io: FontProbe = probe): Promise<boolean> {
  if (platform === 'win32') {
    for (const hive of ['HKCU', 'HKLM']) {
      try {
        const output = await io.run('reg.exe', ['query', `${hive}\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts`, '/v', `${iconFamily} (TrueType)`]);
        const value = output.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+)/)?.[1]?.trim();
        if (!value) continue;
        const expanded = value.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
        const path = win32.isAbsolute(expanded) ? expanded : win32.join(process.env.WINDIR ?? 'C:\\Windows', 'Fonts', expanded);
        if (await io.exists(path)) return true;
      } catch { /* Try the other registry hive. */ }
    }
    return false;
  }
  if (platform === 'linux' || platform === 'darwin') {
    try {
      const output = await io.run('fc-list', ['--format', '%{family}\n']);
      return output.split(/[\r\n,]/).some(family => family.trim() === iconFamily);
    } catch { return false; }
  }
  return false;
}

let detected: Promise<boolean> | undefined;
export function hasIconFont(): Promise<boolean> {
  return detected ??= process.platform === 'win32' && installedWindowsFont()
    ? Promise.resolve(true)
    : detectIconFont();
}
