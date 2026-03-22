import telegramIcon from '@/assets/channels/telegram.svg';
import discordIcon from '@/assets/channels/discord.svg';
import whatsappIcon from '@/assets/channels/whatsapp.svg';
import wechatIcon from '@/assets/channels/wechat.svg';
import dingtalkIcon from '@/assets/channels/dingtalk.svg';
import feishuIcon from '@/assets/channels/feishu.png';
import wecomIcon from '@/assets/channels/wecom.png';
import qqIcon from '@/assets/channels/qq.svg';
import { cn } from '@/lib/utils';
import type { ChannelType } from '@/types/channel';

type ChannelIconSpec = {
  src?: string;
};

type ChannelIconProps = {
  type: ChannelType;
  size?: number;
  className?: string;
};

const CHANNEL_ICON_SPECS: Record<ChannelType, ChannelIconSpec> = {
  telegram: { src: telegramIcon },
  discord: { src: discordIcon },
  whatsapp: { src: whatsappIcon },
  'openclaw-weixin': { src: wechatIcon },
  dingtalk: { src: dingtalkIcon },
  feishu: { src: feishuIcon },
  wecom: { src: wecomIcon },
  qqbot: { src: qqIcon },
  signal: {},
  matrix: {},
  line: {},
  msteams: {},
  googlechat: {},
  imessage: {},
  mattermost: {},
};

export function ChannelIcon({ type, size = 22, className }: ChannelIconProps) {
  const spec = CHANNEL_ICON_SPECS[type];

  return (
    <span
      data-testid={`channel-icon-${type}`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden',
        className,
      )}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {spec?.src ? (
        <img
          src={spec.src}
          alt=""
          aria-hidden="true"
          data-testid={`channel-icon-glyph-${type}`}
          className="block h-full w-full object-contain"
        />
      ) : (
        <span
          data-testid={`channel-icon-glyph-${type}`}
          className="inline-flex h-full w-full items-center justify-center rounded-[7px] border border-border/60 bg-[hsl(var(--surface-muted)/0.78)] text-[12px] font-semibold text-foreground/72"
        >
          {type.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
