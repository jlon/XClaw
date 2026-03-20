import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const zhChannels = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/i18n/locales/zh/channels.json'), 'utf8'),
) as {
  account: {
    idLabel: string;
    boundTo: string;
    unassigned: string;
  };
  editor: {
    behaviorDesc: string;
  };
};

describe('channels zh copy', () => {
  it('uses more natural Chinese wording for account and agent details', () => {
    expect(zhChannels.account.idLabel).toBe('账号标识：{{id}}');
    expect(zhChannels.account.boundTo).not.toContain('绑定对象');
    expect(zhChannels.account.boundTo).toContain('负责');
    expect(zhChannels.account.unassigned).toContain('Agent');
    expect(zhChannels.editor.behaviorDesc).toContain('负责处理');
    expect(zhChannels.editor.behaviorDesc).toContain('收到的消息');
  });
});
