import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(__dirname, '..', '..');
const readBytes = (path: string) => readFileSync(resolve(rootDir, path));
const readPngSize = (path: string) => {
  const bytes = readBytes(path);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

describe('icon brand assets', () => {
  it('references web favicon assets in index.html', () => {
    const html = readFileSync(resolve(rootDir, 'index.html'), 'utf8');
    expect(html).toContain('/favicon.svg');
    expect(html).toContain('/favicon.ico');
    expect(html).toContain('/apple-touch-icon.png');
  });

  it('keeps lobster-based brand sources in resources/icons', () => {
    const iconSvg = readFileSync(resolve(rootDir, 'resources/icons/icon.svg'), 'utf8');
    const faviconSvg = readFileSync(resolve(rootDir, 'resources/icons/favicon.svg'), 'utf8');
    const traySvg = readFileSync(resolve(rootDir, 'resources/icons/tray-icon-template.svg'), 'utf8');
    const rendererLogoSvg = readFileSync(resolve(rootDir, 'src/assets/logo.svg'), 'utf8');
    expect(iconSvg).toContain('lobster-gradient');
    expect(iconSvg).toContain('icon-card-gradient');
    expect(faviconSvg).toContain('lobster-gradient');
    expect(rendererLogoSvg).toContain('lobster-gradient');
    expect(iconSvg).toContain('#00e5cc');
    expect(traySvg).toContain('fill="#000000"');
  });

  it('commits generated browser icon artifacts', () => {
    expect(existsSync(resolve(rootDir, 'public/favicon.svg'))).toBe(true);
    expect(existsSync(resolve(rootDir, 'public/favicon.ico'))).toBe(true);
    expect(existsSync(resolve(rootDir, 'public/apple-touch-icon.png'))).toBe(true);
  });

  it('keeps cross-platform desktop icon outputs for mac and win', () => {
    const icns = readBytes('resources/icons/icon.icns');
    const ico = readBytes('resources/icons/icon.ico');
    const tray = readPngSize('resources/icons/tray-icon-Template.png');
    const icon16 = readPngSize('resources/icons/16x16.png');
    const icon32 = readPngSize('resources/icons/32x32.png');
    const icon64 = readPngSize('resources/icons/64x64.png');

    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(ico[0]).toBe(0);
    expect(ico[1]).toBe(0);
    expect(ico[2]).toBe(1);
    expect(ico[3]).toBe(0);
    expect(tray).toEqual({ width: 22, height: 22 });
    expect(icon16).toEqual({ width: 16, height: 16 });
    expect(icon32).toEqual({ width: 32, height: 32 });
    expect(icon64).toEqual({ width: 64, height: 64 });
  });
});
