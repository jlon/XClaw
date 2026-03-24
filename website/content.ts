import logoUrl from '../src/assets/logo.svg';

const screenshotAssets = import.meta.glob('../resources/screenshot/zh/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const communityAssets = import.meta.glob('../src/assets/community/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const screenshot = (name: string) => {
  const asset = screenshotAssets[`../resources/screenshot/zh/${name}`];

  if (!asset) {
    throw new Error(`Website screenshot "${name}" was not found.`);
  }

  return asset;
};

const communityAsset = (...names: string[]) => {
  const asset = names.map((name) => communityAssets[`../src/assets/community/${name}`]).find(Boolean);

  if (!asset) {
    throw new Error(`Website community asset was not found. Tried: ${names.join(', ')}`);
  }

  return asset;
};

const releaseUrl = 'https://github.com/jlon/XClaw/releases';
const repoUrl = 'https://github.com/jlon/XClaw';

export const websiteContent = {
  releaseUrl,
  repoUrl,
  logoUrl,
  contact: {
    trigger: '联系方式',
    tag: '微信群',
    title: '扫码查看微信群联系方式',
    description: '保持入口轻一点，右上角点开就能直接扫码。',
    note: '微信扫码即可查看',
    image: communityAsset('wecom-qr.png', 'image.png'),
    alt: 'XClaw 微信群联系方式二维码',
  },
  nav: [
    { label: '场景', href: '#scenarios' },
    { label: '核心能力', href: '#features' },
    { label: '快速上手', href: '#quickstart' },
    { label: '下载', href: '#download' },
  ],
  hero: {
    badge: 'AI 桌面工作台',
    brandline: '给你无限可能',
    subtitle: '让 AI 在桌面里持续工作',
    description: '把对话、渠道、技能和任务，收进一个真正可下载的桌面工作台。',
    primaryCta: '立即下载',
    secondaryCta: 'GitHub',
    stageLabel: '真实界面',
    stageTitle: '看得见的桌面工作台',
    stageDescription: '不是概念图，直接使用仓库里的真实截图。',
  },
  downloads: [
    { label: 'macOS (Apple 芯片)', icon: 'apple', width: 'wide', href: releaseUrl, downloadKey: 'macArm64' },
    { label: 'macOS (Intel 芯片)', icon: 'apple', width: 'wide', href: releaseUrl, downloadKey: 'macX64' },
    { label: 'Windows', icon: 'windows', width: 'narrow', href: releaseUrl, downloadKey: 'win' },
  ],
  stats: [
    { value: '安装即用', label: '下载后即可进入桌面工作台' },
    { value: '低占用', label: '常驻桌面也保持轻巧' },
    { value: '本地集中', label: '消息与能力同屏可见' },
  ],
  screenshots: [
    {
      id: 'chat',
      label: '对话工作台',
      title: '一句话进入工作状态',
      description: '任务入口、执行过程和结果都在一个界面里。',
      image: screenshot('chat.png'),
      alt: 'XClaw 对话工作台截图',
    },
    {
      id: 'models',
      label: '模型管理',
      title: '模型接入和切换更集中',
      description: '从提供商选择到密钥接入，都在同一个桌面界面里完成。',
      image: screenshot('models.png'),
      alt: 'XClaw 模型管理截图',
    },
    {
      id: 'agents',
      label: '智能体',
      title: '把常用智能体装进工作台',
      description: '筛选、安装和管理模板能力，不用来回切换窗口。',
      image: screenshot('agents.png'),
      alt: 'XClaw 智能体截图',
    },
    {
      id: 'channels',
      label: '多渠道接入',
      title: '多个渠道统一管理',
      description: '账号、配置和状态不再分散。',
      image: screenshot('channels.png'),
      alt: 'XClaw 多渠道接入截图',
    },
    {
      id: 'skills',
      label: '技能扩展',
      title: '把常用能力装进工作台',
      description: '技能不再零散，直接在界面里管理。',
      image: screenshot('skills.png'),
      alt: 'XClaw 技能扩展截图',
    },
    {
      id: 'cron',
      label: '定时任务',
      title: '按时间自动执行',
      description: '重复动作交给时间触发。',
      image: screenshot('cron.png'),
      alt: 'XClaw 定时任务截图',
    },
    {
      id: 'settings',
      label: '设置',
      title: '主题和偏好统一管理',
      description: '语言、主题和常用开关都集中在一个设置页里。',
      image: screenshot('settings.png'),
      alt: 'XClaw 设置截图',
    },
  ],
  scenarios: [
    {
      tone: 'emerald',
      tag: 'WORK',
      title: '工作整理',
      description: '把每天重复确认的消息、待办和提醒交给桌面工作台。',
      chips: ['定时任务', '多渠道接入'],
      prompt: '每天早上 9 点帮我整理昨日消息和今天待办。',
      response: '已建立定时任务，每天 9:00 自动汇总并推到工作台。',
    },
    {
      tone: 'violet',
      tag: 'FILES',
      title: '资料归类',
      description: '把文件、笔记和会议记录收拢成能继续处理的结果。',
      chips: ['技能扩展', '对话工作台'],
      prompt: '把这批会议记录按项目分类，并提炼出重点。',
      response: '已按项目归档，摘要和后续行动项已经生成。',
    },
    {
      tone: 'amber',
      tag: 'CRON',
      title: '周期提醒',
      description: '把每周、每月都要做的动作固定下来，不再靠记忆。',
      chips: ['定时任务', '本地可控'],
      prompt: '每月 25 号提醒我处理账单和对账。',
      response: '收到，已设置周期提醒，到点会在工作台提示。',
    },
    {
      tone: 'cyan',
      tag: 'MODEL',
      title: '模型切换',
      description: '同一个任务按不同模型、不同输出深度来回切换。',
      chips: ['模型管理', '对话工作台'],
      prompt: '同一个需求给我一版简版方案和一版详细方案。',
      response: '已切换模型与输出策略，正在生成两套结果。',
    },
  ],
  features: [
    {
      eyebrow: '01',
      title: '对话工作台',
      description: '任务、过程和结果同屏，不再分散在多个窗口里。',
    },
    {
      eyebrow: '02',
      title: '多渠道接入',
      description: '把多个入口收进一个地方管理，而不是各管各的。',
    },
    {
      eyebrow: '03',
      title: '技能扩展',
      description: '把常用能力持续装进工作台，不用每次重搭环境。',
    },
    {
      eyebrow: '04',
      title: '定时任务',
      description: '把重复动作交给时间触发，固定周期自动执行。',
    },
    {
      eyebrow: '05',
      title: '模型管理',
      description: '按不同场景切换模型和配置，输出更贴近实际需求。',
    },
    {
      eyebrow: '06',
      title: '本地可控',
      description: '桌面端统一承接配置、使用和下载，路径更集中。',
    },
  ],
  quickStart: [
    {
      step: '1',
      title: '下载并安装',
      description: '支持 macOS 和 Windows，安装包直接可用。',
    },
    {
      step: '2',
      title: '完成设置并开始使用',
      description: '打开应用，完成基础设置后就能进入工作台。',
    },
  ],
  release: {
    title: '下载最新版本',
    description: '安装包由官网直连下载，更新说明仍保留在 GitHub Releases。',
    primaryCta: '查看更新说明',
    secondaryCta: '查看 GitHub',
  },
  footer: {
    title: 'XClaw',
    description: '桌面 AI 工作台，把复杂操作收进一个真正能下载的产品里。',
    tagline: '给你无限可能',
    copyright: '© 2026 XClaw. All rights reserved.',
    links: [
      { label: 'GitHub', href: 'https://github.com/jlon/XClaw' },
      { label: 'Releases', href: 'https://github.com/jlon/XClaw/releases' },
    ],
  },
} as const;
