import { describe, expect, it } from 'vitest';

import { CHANNEL_FIELD_REGISTRY } from '@/lib/channel-registry';

const CHANNELS = ['feishu', 'wecom', 'dingtalk', 'telegram', 'qqbot', 'openclaw-weixin'] as const;

const collectActiveFieldKeys = (channelType: (typeof CHANNELS)[number]) => {
  const entry = CHANNEL_FIELD_REGISTRY[channelType];
  return [
    ...entry.basicFields.map((field) => field.key),
    ...entry.advancedSections.flatMap((section) => section.fields.map((field) => field.key)),
  ];
};

describe('CHANNEL_FIELD_REGISTRY', () => {
  it('exists for the supported channel set', () => {
    expect(Object.keys(CHANNEL_FIELD_REGISTRY).sort()).toEqual([...CHANNELS].sort());
  });

  it('keeps active v1 fields grounded in current XClaw evidence', () => {
    for (const channelType of CHANNELS) {
      const entry = CHANNEL_FIELD_REGISTRY[channelType];
      const activeFields = [
        ...entry.basicFields,
        ...entry.advancedSections.flatMap((section) => section.fields),
      ];

      expect(entry.behaviorControls.length).toBeGreaterThan(0);
      for (const field of activeFields) {
        expect(field.key).toBeTruthy();
        expect(field.storagePath || field.routePath).toBeTruthy();
        expect(field.evidenceLevel).not.toBe('upstream-plugin-only');
        expect(field.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps telegram allowedUsers active with current roundtrip evidence', () => {
    const telegram = CHANNEL_FIELD_REGISTRY.telegram;
    const allowedUsers = [
      ...telegram.basicFields,
      ...telegram.advancedSections.flatMap((section) => section.fields),
    ].find((field) => field.key === 'allowedUsers');

    expect(allowedUsers).toBeDefined();
    expect(allowedUsers?.evidenceLevel).toBe('current-xclaw-roundtrip');
    expect(allowedUsers?.storagePath).toContain('allowFrom');
  });

  it('keeps candidate-only fields out of active v1 lists', () => {
    const wecom = CHANNEL_FIELD_REGISTRY.wecom;
    const qqbot = CHANNEL_FIELD_REGISTRY.qqbot;

    expect(collectActiveFieldKeys('wecom')).not.toContain('mode');
    expect(collectActiveFieldKeys('wecom')).not.toContain('webhookPath');
    expect(collectActiveFieldKeys('qqbot')).not.toContain('markdownSupport');

    expect([
      ...wecom.candidateFields.basicFields,
      ...wecom.candidateFields.advancedSections.flatMap((section) => section.fields),
      ...wecom.candidateFields.behaviorControls,
    ].map((field) => field.key)).toEqual(expect.arrayContaining(['mode', 'webhookPath']));

    expect([
      ...qqbot.candidateFields.basicFields,
      ...qqbot.candidateFields.advancedSections.flatMap((section) => section.fields),
      ...qqbot.candidateFields.behaviorControls,
    ].map((field) => field.key)).toContain('markdownSupport');
  });

  it('keeps weixin limited to the confirmed v1 account fields', () => {
    expect(collectActiveFieldKeys('openclaw-weixin')).toEqual(['name', 'cdnBaseUrl', 'routeTag']);
  });

  it('keeps displayed plugin-derived fields grounded in current editor roundtrip evidence', () => {
    const pluginFields = CHANNELS.flatMap((channelType) => {
      const entry = CHANNEL_FIELD_REGISTRY[channelType];
      return [
        ...entry.candidateFields.basicFields,
        ...entry.candidateFields.advancedSections.flatMap((section) => section.fields),
      ];
    });

    expect(pluginFields.length).toBeGreaterThan(0);

    for (const field of pluginFields) {
      expect(field.evidenceLevel).toBe('current-xclaw-roundtrip');
      expect(field.evidence.length).toBeGreaterThan(0);
      if (field.valueType === 'boolean' || field.valueType === 'number' || field.valueType === 'string[]') {
        expect(field.readStrategy).toBe('editor-value-roundtrip');
      } else {
        expect(field.readStrategy).toBe('string-form-value');
      }
    }
  });

  it('separates behavior controls from normal fields', () => {
    const telegram = CHANNEL_FIELD_REGISTRY.telegram;
    const behaviorKeys = telegram.behaviorControls.map((field) => field.key);
    const normalKeys = [
      ...telegram.basicFields.map((field) => field.key),
      ...telegram.advancedSections.flatMap((section) => section.fields.map((field) => field.key)),
    ];

    expect(behaviorKeys).toEqual(expect.arrayContaining(['enabled', 'defaultAccount', 'binding']));
    expect(normalKeys).not.toEqual(expect.arrayContaining(['enabled', 'defaultAccount', 'binding']));
  });
});
