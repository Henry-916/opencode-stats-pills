import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectIconFont, iconFamily, plainIcons, installedWindowsFont } from '../src/icons.js';

test('installed Windows font is available before any subprocess or async render update', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local', WINDIR: 'C:\\Windows' };
  const userFont = 'C:\\Users\\test\\AppData\\Local\\Microsoft\\Windows\\Fonts\\StatsPillsIcons-1.7.ttf';
  assert.equal(installedWindowsFont(path => path === userFont, env), true);
  assert.equal(installedWindowsFont(path => path === 'C:\\Windows\\Fonts\\StatsPillsIcons-1.7.ttf', env), true);
  assert.equal(installedWindowsFont(() => false, env), false);
  assert.equal(installedWindowsFont(() => { throw new Error('permission denied'); }, env), false);
  assert.equal(installedWindowsFont(path => path === userFont, { USERPROFILE: 'C:\\Users\\test' }), true);
});

test('Windows accepts a registered font only when its file exists', async () => {
  const paths: string[] = [];
  assert.equal(await detectIconFont('win32', {
    run: async (command, args) => {
      assert.equal(command, 'reg.exe');
      assert.equal(args.at(-1), `${iconFamily} (TrueType)`);
      return `${iconFamily} (TrueType)    REG_SZ    C:\\Users\\test\\Fonts\\StatsPillsIcons-1.7.ttf\r\n`;
    },
    exists: async path => { paths.push(path); return true; },
  }), true);
  assert.deepEqual(paths, ['C:\\Users\\test\\Fonts\\StatsPillsIcons-1.7.ttf']);
  assert.equal(await detectIconFont('win32', {
    run: async () => 'font    REG_SZ    missing.ttf', exists: async () => false,
  }), false);
});

test('Windows checks system-wide fonts if the per-user registration is absent', async () => {
  const hives: string[] = [];
  assert.equal(await detectIconFont('win32', {
    run: async (_command, args) => {
      hives.push(args[1].split('\\')[0]);
      if (hives.length === 1) throw new Error('value not found');
      return 'font    REG_SZ    StatsPillsIcons-1.7.ttf';
    },
    exists: async path => path.endsWith('\\Fonts\\StatsPillsIcons-1.7.ttf'),
  }), true);
  assert.deepEqual(hives, ['HKCU', 'HKLM']);
});

test('fontconfig matches the exact family, including alternate family names', async () => {
  for (const platform of ['linux', 'darwin']) {
    assert.equal(await detectIconFont(platform, {
      run: async () => `Other Font\nAlternative Name,${iconFamily}\n`, exists: async () => false,
    }), true);
    for (const output of ['', 'StatsPills Icons Large v1.6', `${iconFamily} Extra`]) {
      assert.equal(await detectIconFont(platform, { run: async () => output, exists: async () => false }), false);
    }
  }
});

test('missing tools, timeout, unsupported platforms and registry errors fall back safely', async () => {
  for (const platform of ['win32', 'linux', 'darwin', 'unknown']) {
    assert.equal(await detectIconFont(platform, {
      run: async () => { throw new Error('probe failed'); }, exists: async () => false,
    }), false);
  }
  // Fallbacks use one ordinary Unicode character, never private-use font glyphs.
  assert.ok(Object.values(plainIcons).every(icon => /^\P{C}$/u.test(icon)));
});
