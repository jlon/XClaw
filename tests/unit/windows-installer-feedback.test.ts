import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const readProjectFile = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('windows installer feedback contract', () => {
  it('keeps installer feedback in the nsis include flow without switching to a custom root script', () => {
    const config = readProjectFile('config/build/electron-builder.config.cjs');

    expect(config).toContain("include: 'scripts/installer.nsh'");
    expect(config).not.toContain('script:');
    expect(config).toContain('oneClick: false');
  });

  it('shows install details by default and restores detail output when installation work starts', () => {
    const script = readProjectFile('scripts/installer.nsh');

    expect(script).toContain('!define MUI_ABORTWARNING');
    expect(script).toContain('!macro customHeader');
    expect(script).toContain('ShowInstDetails show');
    expect(script).toContain('!macro customPageAfterChangeDir');
    expect(script).toContain('!define MUI_PAGE_CUSTOMFUNCTION_SHOW XClawInstFilesShow');
    expect(script).toContain('Function XClawInstFilesShow');
    expect(script).toContain('SetDetailsView show');
    expect(script).toContain('SetDetailsPrint both');
    expect(script).toContain('Call XClawEnableInstallCancel');
    expect(script).toContain('!macro customCheckAppRunning');
    expect(script).toContain('StrCpy $XClawInstallPageActive "1"');
  });

  it('keeps cancel enabled during installation and uses the native abort confirmation flow', () => {
    const script = readProjectFile('scripts/installer.nsh');

    expect(script).toContain('Function XClawEnableInstallCancel');
    expect(script).toContain('GetDlgItem $0 $HWNDPARENT 2');
    expect(script).toContain('EnableWindow $0 1');
    expect(script).toContain('!define MUI_ABORTWARNING');
  });
});
