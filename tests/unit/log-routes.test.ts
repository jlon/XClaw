import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const showSaveDialogMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const sendJsonMock = vi.fn();
const getLogDirMock = vi.fn();
const listLogFilesMock = vi.fn();
const readLogFileMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getVersion: () => '2026.3.23',
  },
  dialog: {
    showSaveDialog: (...args: unknown[]) => showSaveDialogMock(...args),
  },
}));

vi.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {},
  readFile: (...args: unknown[]) => readFileMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    getLogDir: (...args: unknown[]) => getLogDirMock(...args),
    listLogFiles: (...args: unknown[]) => listLogFilesMock(...args),
    readLogFile: (...args: unknown[]) => readLogFileMock(...args),
  },
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

describe('handleLogRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getLogDirMock.mockReturnValue('/tmp/xclaw-logs');
    listLogFilesMock.mockResolvedValue([
      {
        name: 'XClaw-2026-03-24.log',
        path: '/tmp/xclaw-logs/XClaw-2026-03-24.log',
        size: 128,
        modified: '2026-03-24T10:00:00.000Z',
      },
      {
        name: 'XClaw-2026-03-23.log',
        path: '/tmp/xclaw-logs/XClaw-2026-03-23.log',
        size: 96,
        modified: '2026-03-23T10:00:00.000Z',
      },
    ]);
    readFileMock.mockImplementation(async (path: string) => `content:${path}`);
    writeFileMock.mockResolvedValue(undefined);
    showSaveDialogMock.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/xclaw-logs.zip',
    });
  });

  it('exports a zip bundle with recent platform log files', async () => {
    const { handleLogRoutes } = await import('@electron/api/routes/logs');

    const handled = await handleLogRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/logs/export'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(showSaveDialogMock).toHaveBeenCalled();
    expect(readFileMock).toHaveBeenCalledTimes(2);
    expect(writeFileMock).toHaveBeenCalledWith('/tmp/xclaw-logs.zip', expect.any(Buffer));
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        savedPath: '/tmp/xclaw-logs.zip',
        fileCount: 2,
      }),
    );
  });
});
