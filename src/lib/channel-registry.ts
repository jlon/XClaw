import {
  CHANNEL_META,
  type ChannelBehaviorControl,
  type ChannelConfigContractField,
  type ChannelConfigContractSection,
  type ChannelFieldRegistryEntry,
  type ChannelType,
} from '@/types/channel';

type RegistryChannelType = Extract<ChannelType, 'feishu' | 'wecom' | 'dingtalk' | 'telegram' | 'qqbot' | 'openclaw-weixin'>;

const dmPolicyOptions = [
  { value: 'open', label: '开放' },
  { value: 'pairing', label: '配对' },
  { value: 'allowlist', label: '白名单' },
] as const;

const groupPolicyOptions = [
  { value: 'open', label: '开放' },
  { value: 'allowlist', label: '白名单' },
] as const;

const disabledCapableDmPolicyOptions = [
  ...dmPolicyOptions,
  { value: 'disabled', label: '关闭' },
] as const;

const disabledCapableGroupPolicyOptions = [
  ...groupPolicyOptions,
  { value: 'disabled', label: '关闭' },
] as const;

const wecomModeOptions = [
  { value: 'ws', label: 'WebSocket' },
  { value: 'webhook', label: 'Webhook' },
] as const;

const dingtalkMessageTypeOptions = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'card', label: '互动卡片' },
] as const;

const evidence = {
  genericStringRoundtrip: [
    'electron/utils/channel-config.ts:423 saveChannelConfig()',
    'electron/utils/channel-config.ts:547 extractFormValues()',
  ],
  genericEditorRoundtrip: [
    'electron/utils/channel-config.ts:423 saveChannelConfig()',
    'electron/utils/channel-config.ts:589 extractEditorValues()',
    'electron/utils/channel-config.ts:620 getChannelEditorValues()',
  ],
  telegramAllowedUsersRoundtrip: [
    'electron/utils/channel-config.ts:286 transformChannelConfig()',
    'electron/utils/channel-config.ts:569 extractFormValues()',
  ],
  feishuWecomDmPolicy: [
    'electron/utils/channel-config.ts:301 transformChannelConfig()',
    'electron/utils/channel-config.ts:547 extractFormValues()',
  ],
  routeEnabled: [
    'electron/api/routes/channels.ts:376 /api/channels/config/enabled',
    'electron/utils/channel-config.ts:857 setChannelEnabled()',
  ],
  routeDefaultAccount: [
    'electron/api/routes/channels.ts:252 /api/channels/default-account',
    'electron/utils/channel-config.ts:772 setChannelDefaultAccount()',
  ],
  routeBinding: [
    'electron/api/routes/channels.ts:264 /api/channels/binding PUT',
    'electron/api/routes/channels.ts:276 /api/channels/binding DELETE',
  ],
  feishuPlugin: [
    'node_modules/@larksuite/openclaw-lark/src/core/config-schema.js:130',
    'node_modules/@larksuite/openclaw-lark/src/channel/plugin.js:124',
  ],
  wecomPlugin: [
    'node_modules/@openclaw-china/wecom/openclaw.plugin.json:8',
    'node_modules/@openclaw-china/wecom/dist/index.d.ts:5',
  ],
  dingtalkPlugin: [
    'node_modules/@soimy/dingtalk/src/config-schema.ts:3',
    'node_modules/@soimy/dingtalk/src/channel.ts:85',
  ],
  qqbotPlugin: [
    'node_modules/@sliverp/qqbot/src/types.ts:32',
    'node_modules/@sliverp/qqbot/src/config.ts:67',
  ],
  weixinPlugin: [
    'node_modules/@tencent-weixin/openclaw-weixin/src/auth/accounts.ts:244',
    'node_modules/@tencent-weixin/openclaw-weixin/src/config/config-schema.ts:12',
  ],
} as const;

const createMetaField = (
  channelType: RegistryChannelType,
  key: string,
  overrides: Partial<ChannelConfigContractField>,
): ChannelConfigContractField => {
  const field = CHANNEL_META[channelType].configFields.find((item) => item.key === key);
  if (!field) {
    throw new Error(`Missing base field metadata for ${channelType}.${key}`);
  }
  return {
    ...field,
    valueType: 'string',
    readStrategy: 'string-form-value',
    writeStrategy: 'channel-config',
    evidence: [...evidence.genericStringRoundtrip],
    evidenceLevel: 'current-xclaw-roundtrip',
    ...overrides,
  };
};

const createStringField = (
  key: string,
  label: string,
  overrides: Partial<ChannelConfigContractField>,
): ChannelConfigContractField => ({
  key,
  label,
  type: 'text',
  valueType: 'string',
  readStrategy: 'string-form-value',
  writeStrategy: 'channel-config',
  evidence: [...evidence.genericStringRoundtrip],
  evidenceLevel: 'current-xclaw-roundtrip',
  ...overrides,
});

const createCandidateField = (
  key: string,
  label: string,
  valueType: ChannelConfigContractField['valueType'],
  evidenceSources: string[],
  overrides: Partial<ChannelConfigContractField> = {},
): ChannelConfigContractField => ({
  key,
  label,
  type: valueType === 'boolean' ? 'boolean' : valueType === 'number' ? 'number' : valueType === 'string[]' ? 'array' : 'text',
  valueType,
  readStrategy:
    valueType === 'boolean' || valueType === 'number' || valueType === 'string[]'
      ? 'editor-value-roundtrip'
      : 'string-form-value',
  writeStrategy: 'channel-config',
  evidence: [
    ...(valueType === 'boolean' || valueType === 'number' || valueType === 'string[]'
      ? evidence.genericEditorRoundtrip
      : evidence.genericStringRoundtrip),
    ...evidenceSources,
  ],
  evidenceLevel: 'current-xclaw-roundtrip',
  ...overrides,
});

const createSection = (id: string, label: string, fields: ChannelConfigContractField[]): ChannelConfigContractSection => ({
  id,
  label,
  fields,
});

const createBehaviorControl = (control: ChannelBehaviorControl): ChannelBehaviorControl => control;

const behaviorControls = {
  enabled: createBehaviorControl({
    key: 'enabled',
    label: '启用频道',
    routePath: '/api/channels/config/enabled',
    readStrategy: 'route-state',
    writeStrategy: 'channel-enabled-route',
    evidence: [...evidence.routeEnabled],
    evidenceLevel: 'current-xclaw-route',
  }),
  defaultAccount: createBehaviorControl({
    key: 'defaultAccount',
    label: '默认账号',
    routePath: '/api/channels/default-account',
    readStrategy: 'route-state',
    writeStrategy: 'default-account-route',
    evidence: [...evidence.routeDefaultAccount],
    evidenceLevel: 'current-xclaw-route',
  }),
  binding: createBehaviorControl({
    key: 'binding',
    label: '绑定 Agent',
    routePath: '/api/channels/binding',
    readStrategy: 'route-state',
    writeStrategy: 'binding-route',
    evidence: [...evidence.routeBinding],
    evidenceLevel: 'current-xclaw-route',
  }),
} as const;

export const CHANNEL_FIELD_REGISTRY: Record<RegistryChannelType, ChannelFieldRegistryEntry> = {
  feishu: {
    basicFields: [
      createMetaField('feishu', 'appId', {
        storagePath: 'channels.feishu.accounts.<accountId>.appId',
      }),
      createMetaField('feishu', 'appSecret', {
        storagePath: 'channels.feishu.accounts.<accountId>.appSecret',
        valueType: 'password',
      }),
    ],
    advancedSections: [
      createSection('access', '消息接入规则', [
        createStringField('dmPolicy', '私聊消息', {
          type: 'select',
          options: [...dmPolicyOptions],
          storagePath: 'channels.feishu.accounts.<accountId>.dmPolicy',
          evidence: [...evidence.feishuWecomDmPolicy],
          defaultValue: 'open',
          description: '决定谁可以通过私聊把消息送进当前账号。',
        }),
        createCandidateField('allowFrom', '允许进入的私聊用户', 'string[]', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.allowFrom',
          description: '仅在私聊消息选择白名单时生效，多个 ID 用逗号分隔。',
        }),
        createStringField('groupPolicy', '群聊消息', {
          type: 'select',
          options: [...groupPolicyOptions],
          storagePath: 'channels.feishu.accounts.<accountId>.groupPolicy',
          defaultValue: 'open',
          description: '决定群消息如何进入当前账号。',
        }),
        createCandidateField('groupAllowFrom', '允许进入的群聊', 'string[]', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.groupAllowFrom',
          description: '仅在群聊消息选择白名单时生效，填写允许接入的群组 ID。',
        }),
        createCandidateField('requireMention', '仅在被 @ 时回复', 'boolean', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.requireMention',
          description: '开启后，群里只有明确提到机器人时才会响应。',
        }),
      ]),
    ],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [
        createCandidateField('encryptKey', 'Encrypt Key', 'string', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.encryptKey',
        }),
        createCandidateField('verificationToken', 'Verification Token', 'string', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.verificationToken',
        }),
        createCandidateField('domain', '域名', 'string', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.domain',
        }),
        createCandidateField('connectionMode', '连接模式', 'string', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.connectionMode',
          description: '选择 WebSocket 或 Webhook 等接入模式，未设置时由插件默认处理。',
        }),
        createCandidateField('webhookPath', 'Webhook Path', 'string', [...evidence.feishuPlugin], {
          storagePath: 'channels.feishu.accounts.<accountId>.webhookPath',
        }),
      ],
      advancedSections: [
        createSection('plugin', '插件扩展', [
          createCandidateField('streaming', '流式输出', 'boolean', [...evidence.feishuPlugin], {
            storagePath: 'channels.feishu.accounts.<accountId>.streaming',
            description: '允许机器人在支持的场景中分段输出回复。',
          }),
          createCandidateField('textChunkLimit', '文本分块长度', 'number', [...evidence.feishuPlugin], {
            storagePath: 'channels.feishu.accounts.<accountId>.textChunkLimit',
            description: '限制单次推送的文本长度，避免长消息被平台截断。',
          }),
        ]),
      ],
      behaviorControls: [],
    },
  },
  wecom: {
    basicFields: [
      createMetaField('wecom', 'botId', {
        storagePath: 'channels.wecom.accounts.<accountId>.botId',
      }),
      createMetaField('wecom', 'secret', {
        storagePath: 'channels.wecom.accounts.<accountId>.secret',
        valueType: 'password',
      }),
    ],
    advancedSections: [
      createSection('access', '消息接入规则', [
        createStringField('dmPolicy', '私聊消息', {
          type: 'select',
          options: [...disabledCapableDmPolicyOptions],
          storagePath: 'channels.wecom.accounts.<accountId>.dmPolicy',
          evidence: [...evidence.feishuWecomDmPolicy],
          defaultValue: 'open',
          description: '决定谁可以通过企业微信私聊把消息送进当前账号。',
        }),
        createCandidateField('allowFrom', '允许进入的私聊用户', 'string[]', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.allowFrom',
          description: '仅在私聊消息选择白名单时生效，多个 ID 用逗号分隔。',
        }),
        createStringField('groupPolicy', '群聊消息', {
          type: 'select',
          options: [...disabledCapableGroupPolicyOptions],
          storagePath: 'channels.wecom.accounts.<accountId>.groupPolicy',
          defaultValue: 'open',
          description: '决定企业微信里的群消息如何进入当前账号。',
        }),
        createCandidateField('groupAllowFrom', '允许进入的群聊', 'string[]', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.groupAllowFrom',
          description: '仅在群聊消息选择白名单时生效，填写允许接入的群聊 ID。',
        }),
        createCandidateField('requireMention', '仅在被 @ 时回复', 'boolean', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.requireMention',
          description: '开启后，群里只有明确 @ 机器人时才会响应。',
        }),
      ]),
    ],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [
        createCandidateField('mode', '连接模式', 'string', [...evidence.wecomPlugin], {
          type: 'select',
          options: [...wecomModeOptions],
          storagePath: 'channels.wecom.accounts.<accountId>.mode',
          defaultValue: 'ws',
          description: 'WebSocket 更省配置，Webhook 更适合固定公网回调。',
        }),
        createCandidateField('webhookPath', 'Webhook Path', 'string', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.webhookPath',
          description: 'Webhook 模式下接收企业微信事件的回调路径。',
        }),
        createCandidateField('token', '回调 Token', 'string', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.token',
          description: 'Webhook 模式下校验企业微信回调来源的 Token。',
        }),
        createCandidateField('encodingAESKey', 'Encoding AES Key', 'string', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.encodingAESKey',
          description: 'Webhook 模式下用于解密企业微信推送消息。',
        }),
        createCandidateField('wsUrl', 'WebSocket URL', 'string', [...evidence.wecomPlugin], {
          storagePath: 'channels.wecom.accounts.<accountId>.wsUrl',
          description: '覆盖插件默认的企业微信 WebSocket 地址，通常无需修改。',
        }),
      ],
      advancedSections: [
        createSection('plugin', '插件扩展', [
          createCandidateField('welcomeText', '欢迎语', 'string', [...evidence.wecomPlugin], {
            storagePath: 'channels.wecom.accounts.<accountId>.welcomeText',
            description: '首次建立会话时发给用户的欢迎文案。',
          }),
        ]),
      ],
      behaviorControls: [],
    },
  },
  dingtalk: {
    basicFields: [
      createMetaField('dingtalk', 'clientId', {
        storagePath: 'channels.dingtalk.accounts.<accountId>.clientId',
      }),
      createMetaField('dingtalk', 'clientSecret', {
        storagePath: 'channels.dingtalk.accounts.<accountId>.clientSecret',
        valueType: 'password',
      }),
    ],
    advancedSections: [
      createSection('identity', '应用标识', [
        createStringField('robotCode', 'Robot Code', {
          storagePath: 'channels.dingtalk.accounts.<accountId>.robotCode',
        }),
        createStringField('corpId', 'Corp ID', {
          storagePath: 'channels.dingtalk.accounts.<accountId>.corpId',
        }),
        createStringField('agentId', 'Agent ID', {
          storagePath: 'channels.dingtalk.accounts.<accountId>.agentId',
        }),
      ]),
      createSection('access', '访问控制', [
        createStringField('dmPolicy', '私聊策略', {
          type: 'select',
          options: [...dmPolicyOptions],
          storagePath: 'channels.dingtalk.accounts.<accountId>.dmPolicy',
          defaultValue: 'open',
          description: '控制钉钉私聊入口。开放表示任意私聊都可进入。',
        }),
        createStringField('groupPolicy', '群聊策略', {
          type: 'select',
          options: [...groupPolicyOptions],
          storagePath: 'channels.dingtalk.accounts.<accountId>.groupPolicy',
          defaultValue: 'open',
          description: '控制钉钉群聊入口。白名单模式只处理指定会话。',
        }),
      ]),
    ],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [],
      advancedSections: [
        createSection('plugin', '插件扩展', [
          createCandidateField('allowFrom', '允许来源', 'string[]', [...evidence.dingtalkPlugin], {
            storagePath: 'channels.dingtalk.accounts.<accountId>.allowFrom',
          }),
          createCandidateField('showThinking', '显示思考中', 'boolean', [...evidence.dingtalkPlugin], {
            storagePath: 'channels.dingtalk.accounts.<accountId>.showThinking',
            defaultValue: true,
            description: '开启后，钉钉会在回复前展示思考中的占位状态。',
          }),
          createCandidateField('messageType', '消息类型', 'string', [...evidence.dingtalkPlugin], {
            type: 'select',
            options: [...dingtalkMessageTypeOptions],
            storagePath: 'channels.dingtalk.accounts.<accountId>.messageType',
            defaultValue: 'markdown',
            description: 'Markdown 更稳定，互动卡片更适合流式与可视化回复。',
          }),
        ]),
      ],
      behaviorControls: [],
    },
  },
  telegram: {
    basicFields: [
      createMetaField('telegram', 'botToken', {
        storagePath: 'channels.telegram.accounts.<accountId>.botToken',
        valueType: 'password',
      }),
      createMetaField('telegram', 'allowedUsers', {
        storagePath: 'channels.telegram.accounts.<accountId>.allowFrom',
        readStrategy: 'telegram-allowed-users',
        writeStrategy: 'telegram-allowed-users-transform',
        evidence: [...evidence.telegramAllowedUsersRoundtrip],
      }),
    ],
    advancedSections: [],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [],
      advancedSections: [],
      behaviorControls: [],
    },
  },
  qqbot: {
    basicFields: [
      createMetaField('qqbot', 'appId', {
        storagePath: 'channels.qqbot.accounts.<accountId>.appId',
      }),
      createMetaField('qqbot', 'clientSecret', {
        storagePath: 'channels.qqbot.accounts.<accountId>.clientSecret',
        valueType: 'password',
      }),
    ],
    advancedSections: [],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [],
      advancedSections: [
        createSection('plugin', '插件扩展', [
          createCandidateField('markdownSupport', 'Markdown 支持', 'boolean', [...evidence.qqbotPlugin], {
            storagePath: 'channels.qqbot.accounts.<accountId>.markdownSupport',
            defaultValue: true,
            description: '开启后，QQ 机器人会优先使用 Markdown 消息格式发送回复。',
          }),
          createCandidateField('dmPolicy', '私聊策略', 'string', [...evidence.qqbotPlugin], {
            type: 'select',
            options: [...dmPolicyOptions],
            storagePath: 'channels.qqbot.accounts.<accountId>.dmPolicy',
            defaultValue: 'open',
            description: '控制 QQ 私聊消息如何进入当前账号。',
          }),
          createCandidateField('allowFrom', '允许来源', 'string[]', [...evidence.qqbotPlugin], {
            storagePath: 'channels.qqbot.accounts.<accountId>.allowFrom',
          }),
        ]),
      ],
      behaviorControls: [],
    },
  },
  'openclaw-weixin': {
    basicFields: [
      createCandidateField('name', '账号名称', 'string', [...evidence.weixinPlugin], {
        storagePath: 'channels.openclaw-weixin.accounts.<accountId>.name',
        description: '仅用于 XClaw 内部展示，不影响上游账号标识。',
      }),
      createCandidateField('cdnBaseUrl', 'CDN 地址', 'string', [...evidence.weixinPlugin], {
        storagePath: 'channels.openclaw-weixin.accounts.<accountId>.cdnBaseUrl',
        description: '覆盖微信插件使用的媒体 CDN 地址。',
      }),
    ],
    advancedSections: [
      createSection('runtime', '运行设置', [
        createCandidateField('routeTag', '路由标签', 'number', [...evidence.weixinPlugin], {
          storagePath: 'channels.openclaw-weixin.accounts.<accountId>.routeTag',
          description: '按需透传给微信网关请求头的 SKRouteTag。',
        }),
      ]),
    ],
    behaviorControls: [behaviorControls.enabled, behaviorControls.defaultAccount, behaviorControls.binding],
    candidateFields: {
      basicFields: [],
      advancedSections: [],
      behaviorControls: [],
    },
  },
};

export const V1_CHANNEL_REGISTRY_ORDER = ['feishu', 'wecom', 'dingtalk', 'telegram', 'qqbot'] as const;
