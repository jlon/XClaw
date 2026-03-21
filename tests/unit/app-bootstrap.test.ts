import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app bootstrap', () => {
  it('mounts React into the same container declared by index.html', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const entry = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

    expect(html).toContain('<div id="app"></div>');
    expect(entry).toContain("document.getElementById('app')");
  });

  it('guards the main-process navigation bridge for browser-only dev pages', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(appSource).toContain('window.electron?.ipcRenderer?.on');
  });
});
