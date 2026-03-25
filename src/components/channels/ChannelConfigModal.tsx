import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Loader2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useChannelsStore } from '@/stores/channels';
import { ChannelIcon } from '@/components/channels/ChannelIcon';

import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { cn } from '@/lib/utils';
import {
  CHANNEL_NAMES,
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type ChannelMeta,
  type ChannelConfigField,
} from '@/types/channel';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ChannelConfigModalProps {
  initialSelectedType?: ChannelType | null;
  configuredTypes?: string[];
  showChannelName?: boolean;
  allowExistingConfig?: boolean;
  allowEditAccountId?: boolean;
  existingAccountIds?: string[];
  initialConfigValues?: Record<string, string>;
  availableAgents?: Array<{ id: string; name: string }>;
  agentId?: string;
  accountId?: string;
  onClose: () => void;
  onChannelSaved?: (channelType: ChannelType, accountId?: string) => void | Promise<void>;
}

type QrChannelFlow = {
  startPath: string;
  cancelPath: string;
  qrEvent: string;
  successEvent: string;
  errorEvent: string;
};

const QR_CHANNEL_FLOWS: Partial<Record<ChannelType, QrChannelFlow>> = {
  whatsapp: {
    startPath: '/api/channels/whatsapp/start',
    cancelPath: '/api/channels/whatsapp/cancel',
    qrEvent: 'channel:whatsapp-qr',
    successEvent: 'channel:whatsapp-success',
    errorEvent: 'channel:whatsapp-error',
  },
};

type WeixinLoginStartResponse = {
  error?: string;
  message?: string;
  qrcodeUrl?: string;
  sessionKey?: string;
  success?: boolean;
};

type WeixinLoginPollResponse = {
  accountId?: string;
  connected?: boolean;
  error?: string;
  message?: string;
  qrcodeUrl?: string;
  sessionKey?: string;
  status?: 'wait' | 'scaned' | 'confirmed' | 'expired' | 'error';
  success?: boolean;
};

const WEIXIN_POLL_MS = 1500;

const inputClasses = 'appearance-none h-8 rounded-md border border-border/60 app-field-surface font-mono text-[13px] text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/55 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0';
const labelClasses = 'text-[12.5px] font-semibold tracking-[0.01em] text-foreground/78 select-none';
const outlineButtonClasses = 'workbench-motion-button h-8 rounded-md border border-border/60 bg-[hsl(var(--surface-elevated)/0.96)] px-3 text-[12px] font-medium text-foreground/78 shadow-sm hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground select-none';
const primaryButtonClasses = 'workbench-motion-button h-8 rounded-md bg-foreground px-4 text-[12px] font-medium text-background shadow-sm hover:bg-foreground/90 select-none';
const modalCardClasses = 'app-modal-surface flex max-h-[88vh] w-full max-w-[900px] flex-col overflow-hidden rounded-xl border-border/55 shadow-lg';
const modalSurfaceClasses = 'app-pane-surface rounded-md border border-border/55';
const modalSubtleSurfaceClasses = 'app-pane-surface rounded-md border border-border/50';

export function ChannelConfigModal({
  initialSelectedType = null,
  configuredTypes = [],
  showChannelName = true,
  allowExistingConfig = true,
  allowEditAccountId = false,
  existingAccountIds = [],
  initialConfigValues,
  availableAgents = [],
  agentId,
  accountId,
  onClose,
  onChannelSaved,
}: ChannelConfigModalProps) {
  const { t } = useTranslation('channels');
  const { channels, addChannel, fetchChannels } = useChannelsStore();
  const [selectedType, setSelectedType] = useState<ChannelType | null>(initialSelectedType);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [channelName, setChannelName] = useState('');
  const [accountIdInput, setAccountIdInput] = useState(accountId || '');
  const [selectedAgentId, setSelectedAgentId] = useState(agentId || '');
  const [connecting, setConnecting] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [weixinSessionKey, setWeixinSessionKey] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [isExistingConfig, setIsExistingConfig] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const weixinPollBusyRef = useRef(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const meta: ChannelMeta | null = selectedType ? CHANNEL_META[selectedType] : null;
  const qrFlow = selectedType ? QR_CHANNEL_FLOWS[selectedType] ?? null : null;
  const isWeixinChannel = selectedType === 'openclaw-weixin';
  const shouldUseCredentialValidation = selectedType !== 'feishu';
  const initialBoundAgentId = agentId?.trim() || '';
  const resolvedAccountId = allowEditAccountId
    ? accountIdInput.trim()
    : accountId;

  useEffect(() => {
    setSelectedType(initialSelectedType);
  }, [initialSelectedType]);

  useEffect(() => {
    setAccountIdInput(accountId || '');
  }, [accountId]);

  useEffect(() => {
    setSelectedAgentId(agentId || '');
  }, [agentId, selectedType]);

  useEffect(() => {
    if (!selectedType) {
      setConfigValues({});
      setChannelName('');
      setIsExistingConfig(false);
      setValidationResult(null);
      setQrCode(null);
      setWeixinSessionKey(null);
      setConnecting(false);
      Object.values(QR_CHANNEL_FLOWS).forEach((flow) => {
        if (!flow) return;
        hostApiFetch(flow.cancelPath, { method: 'POST' }).catch(() => { });
      });
      return;
    }

    const shouldLoadExistingConfig = allowExistingConfig && configuredTypes.includes(selectedType);
    if (!shouldLoadExistingConfig) {
      setConfigValues({});
      setIsExistingConfig(false);
      setLoadingConfig(false);
      setChannelName(showChannelName ? CHANNEL_NAMES[selectedType] : '');
      return;
    }

    if (initialConfigValues) {
      setConfigValues(initialConfigValues);
      setIsExistingConfig(Object.keys(initialConfigValues).length > 0);
      setLoadingConfig(false);
      setChannelName(showChannelName ? CHANNEL_NAMES[selectedType] : '');
      return;
    }

    let cancelled = false;
    setLoadingConfig(true);
    setChannelName(showChannelName ? CHANNEL_NAMES[selectedType] : '');

    (async () => {
      try {
        const accountParam = resolvedAccountId ? `?accountId=${encodeURIComponent(resolvedAccountId)}` : '';
        const result = await hostApiFetch<{ success: boolean; values?: Record<string, string> }>(
          `/api/channels/config/${encodeURIComponent(selectedType)}${accountParam}`
        );
        if (cancelled) return;

        if (result.success && result.values && Object.keys(result.values).length > 0) {
          setConfigValues(result.values);
          setIsExistingConfig(true);
        } else {
          setConfigValues({});
          setIsExistingConfig(false);
        }
      } catch {
        if (!cancelled) {
          setConfigValues({});
          setIsExistingConfig(false);
        }
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowExistingConfig, configuredTypes, initialConfigValues, resolvedAccountId, selectedType, showChannelName]);

  useEffect(() => {
    if (selectedType && !loadingConfig && showChannelName && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [selectedType, loadingConfig, showChannelName]);

  useEffect(() => {
    if (!qrCode || qrCode.startsWith('data:image') || !qrCanvasRef.current) {
      return;
    }

    void Promise.resolve(QRCode.toCanvas(qrCanvasRef.current, qrCode, {
      width: 240,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })).catch(() => { });
  }, [qrCode]);

  useEffect(() => {
    if (!isWeixinChannel || !weixinSessionKey) {
      return;
    }

    return () => {
      hostApiFetch('/api/channels/weixin/cancel', {
        method: 'POST',
        body: JSON.stringify({ sessionKey: weixinSessionKey }),
      }).catch(() => { });
    };
  }, [isWeixinChannel, weixinSessionKey]);

  const finishSave = useCallback(async (channelType: ChannelType, savedAccountId?: string) => {
    const targetAccountId = savedAccountId ?? resolvedAccountId ?? 'default';
    const displayName = showChannelName && channelName.trim()
      ? channelName.trim()
      : CHANNEL_NAMES[channelType];
    const existingChannel = channels.find((channel) => channel.type === channelType);

    if (!existingChannel) {
      await addChannel({
        type: channelType,
        name: displayName,
        token: meta?.configFields[0]?.key ? configValues[meta.configFields[0].key] : undefined,
      });
    } else {
      await fetchChannels();
    }

    if (selectedAgentId !== initialBoundAgentId) {
      if (selectedAgentId) {
        const bindResult = await hostApiFetch<{ success?: boolean; error?: string }>('/api/channels/binding', {
          method: 'PUT',
          body: JSON.stringify({
            channelType,
            accountId: targetAccountId,
            agentId: selectedAgentId,
          }),
        });
        if (!bindResult?.success) {
          throw new Error(bindResult?.error || 'Failed to bind agent');
        }
      } else if (initialBoundAgentId) {
        const clearResult = await hostApiFetch<{ success?: boolean; error?: string }>('/api/channels/binding', {
          method: 'DELETE',
          body: JSON.stringify({
            channelType,
            accountId: targetAccountId,
          }),
        });
        if (!clearResult?.success) {
          throw new Error(clearResult?.error || 'Failed to clear agent binding');
        }
      }
    }

    await onChannelSaved?.(channelType, targetAccountId);
  }, [addChannel, channelName, channels, configValues, fetchChannels, initialBoundAgentId, meta?.configFields, onChannelSaved, resolvedAccountId, selectedAgentId, showChannelName]);

  useEffect(() => {
    if (!selectedType || !qrFlow) return;

    const onQr = (...args: unknown[]) => {
      const data = args[0] as { qr?: string; raw?: string; qrDataUrl?: string };
      void data.raw;
      const nextQr = data.qrDataUrl?.trim()
        || (data.qr ? `data:image/png;base64,${data.qr}` : '');
      if (!nextQr) return;
      setQrCode(nextQr);
    };

    const onSuccess = async (...args: unknown[]) => {
      const data = args[0] as { accountId?: string } | undefined;
      try {
        if (selectedType === 'whatsapp') {
          toast.success(t('toast.whatsappConnected'));
          const saveResult = await hostApiFetch<{ success?: boolean; error?: string }>('/api/channels/config', {
            method: 'POST',
            body: JSON.stringify({ channelType: 'whatsapp', config: { enabled: true }, accountId: resolvedAccountId }),
          });
          if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'Failed to save WhatsApp config');
          }
          await finishSave('whatsapp');
        } else {
          toast.success(t('toast.channelSaved', { name: CHANNEL_NAMES[selectedType] }));
          await finishSave(selectedType, data?.accountId);
        }

        try {
          await fetchChannels();
        } catch (postSaveError) {
          toast.warning(t('toast.savedButRefreshFailed'));
          console.warn('Channel saved but post-save refresh failed:', postSaveError);
        }
        onClose();
      } catch (error) {
        toast.error(t('toast.configFailed', { error: String(error) }));
        setConnecting(false);
      }
    };

    const onError = (...args: unknown[]) => {
      const err = args[0] as string;
      if (selectedType === 'whatsapp') {
        toast.error(t('toast.whatsappFailed', { error: err }));
      } else {
        toast.error(t('toast.configFailed', { error: err }));
      }
      setQrCode(null);
      setConnecting(false);
    };

    const removeQrListener = subscribeHostEvent(qrFlow.qrEvent, onQr);
    const removeSuccessListener = subscribeHostEvent(qrFlow.successEvent, onSuccess);
    const removeErrorListener = subscribeHostEvent(qrFlow.errorEvent, onError);

    return () => {
      removeQrListener();
      removeSuccessListener();
      removeErrorListener();
      hostApiFetch(qrFlow.cancelPath, { method: 'POST' }).catch(() => { });
    };
  }, [fetchChannels, finishSave, onClose, qrFlow, resolvedAccountId, selectedType, t]);

  useEffect(() => {
    if (!isWeixinChannel || !weixinSessionKey || !connecting) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (weixinPollBusyRef.current) {
        return;
      }
      weixinPollBusyRef.current = true;
      try {
        const result = await hostApiFetch<WeixinLoginPollResponse>('/api/channels/weixin/poll', {
          method: 'POST',
          body: JSON.stringify({ sessionKey: weixinSessionKey }),
        });
        if (cancelled) {
          return;
        }
        if (!result.success) {
          throw new Error(result.error || 'Failed to poll Weixin login status');
        }
        if (result.qrcodeUrl?.trim()) {
          setQrCode(result.qrcodeUrl.trim());
        }
        if (result.status === 'confirmed' && result.connected && result.accountId) {
          toast.success(t('toast.channelSaved', { name: CHANNEL_NAMES['openclaw-weixin'] }));
          await finishSave('openclaw-weixin', result.accountId);
          try {
            await fetchChannels();
          } catch (postSaveError) {
            toast.warning(t('toast.savedButRefreshFailed'));
            console.warn('Channel saved but post-save refresh failed:', postSaveError);
          }
          onClose();
          return;
        }
        if (result.status === 'expired') {
          toast.error(t('toast.configFailed', { error: 'QR code expired, please refresh.' }));
          setConnecting(false);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(t('toast.configFailed', { error: String(error) }));
          setConnecting(false);
        }
      } finally {
        weixinPollBusyRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, WEIXIN_POLL_MS);

    return () => {
      cancelled = true;
      weixinPollBusyRef.current = false;
      window.clearInterval(timer);
    };
  }, [connecting, fetchChannels, finishSave, isWeixinChannel, onClose, t, weixinSessionKey]);

  const handleValidate = async () => {
    if (!selectedType || !shouldUseCredentialValidation) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await hostApiFetch<{
        success: boolean;
        valid?: boolean;
        errors?: string[];
        warnings?: string[];
        details?: Record<string, string>;
      }>('/api/channels/credentials/validate', {
        method: 'POST',
        body: JSON.stringify({ channelType: selectedType, config: configValues }),
      });

      const warnings = result.warnings || [];
      if (result.valid && result.details) {
        const details = result.details;
        if (details.botUsername) warnings.push(`Bot: @${details.botUsername}`);
        if (details.guildName) warnings.push(`Server: ${details.guildName}`);
        if (details.channelName) warnings.push(`Channel: #${details.channelName}`);
      }

      setValidationResult({
        valid: result.valid || false,
        errors: result.errors || [],
        warnings,
      });
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [String(error)],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedType || !meta) return;

    setConnecting(true);
    setValidationResult(null);

    try {
      if (allowEditAccountId) {
        const nextAccountId = accountIdInput.trim();
        if (!nextAccountId) {
          toast.error(t('account.invalidId'));
          setConnecting(false);
          return;
        }
        const duplicateExists = existingAccountIds.some((id) => id === nextAccountId && id !== (accountId || '').trim());
        if (duplicateExists) {
          toast.error(t('account.accountIdExists', { accountId: nextAccountId }));
          setConnecting(false);
          return;
        }
      }

      if (selectedType === 'openclaw-weixin') {
        const result = await hostApiFetch<WeixinLoginStartResponse>('/api/channels/weixin/start', {
          method: 'POST',
          body: JSON.stringify({
            ...(resolvedAccountId ? { accountId: resolvedAccountId, force: true } : {}),
            config: configValues,
          }),
        });
        if (!result.success || !result.sessionKey?.trim() || !result.qrcodeUrl?.trim()) {
          throw new Error(result.error || result.message || 'Failed to start Weixin login');
        }
        setWeixinSessionKey(result.sessionKey.trim());
        setQrCode(result.qrcodeUrl.trim());
        return;
      }

      if (meta.connectionType === 'qr' && qrFlow) {
        const body = selectedType === 'whatsapp'
          ? { accountId: resolvedAccountId || 'default' }
          : (resolvedAccountId ? { accountId: resolvedAccountId, force: true } : {});
        await hostApiFetch(qrFlow.startPath, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return;
      }

      if (meta.connectionType === 'token' && shouldUseCredentialValidation) {
        const validationResponse = await hostApiFetch<{
          success: boolean;
          valid?: boolean;
          errors?: string[];
          warnings?: string[];
          details?: Record<string, string>;
        }>('/api/channels/credentials/validate', {
          method: 'POST',
          body: JSON.stringify({ channelType: selectedType, config: configValues }),
        });

        if (!validationResponse.valid) {
          setValidationResult({
            valid: false,
            errors: validationResponse.errors || ['Validation failed'],
            warnings: validationResponse.warnings || [],
          });
          setConnecting(false);
          return;
        }

        const warnings = validationResponse.warnings || [];
        if (validationResponse.details) {
          const details = validationResponse.details;
          if (details.botUsername) warnings.push(`Bot: @${details.botUsername}`);
          if (details.guildName) warnings.push(`Server: ${details.guildName}`);
          if (details.channelName) warnings.push(`Channel: #${details.channelName}`);
        }

        setValidationResult({
          valid: true,
          errors: [],
          warnings,
        });
      }

      const config: Record<string, unknown> = { ...configValues };
      const saveResult = await hostApiFetch<{
        success?: boolean;
        error?: string;
        warning?: string;
      }>('/api/channels/config', {
        method: 'POST',
        body: JSON.stringify({ channelType: selectedType, config, accountId: resolvedAccountId }),
      });
      if (!saveResult?.success) {
        throw new Error(saveResult?.error || 'Failed to save channel config');
      }
      if (typeof saveResult.warning === 'string' && saveResult.warning) {
        toast.warning(saveResult.warning);
      }

      try {
        await finishSave(selectedType);
      } catch (postSaveError) {
        toast.warning(t('toast.savedButRefreshFailed'));
        console.warn('Channel saved but post-save refresh failed:', postSaveError);
      }

      toast.success(t('toast.channelSaved', { name: meta.name }));
      toast.success(t('toast.channelConnecting', { name: meta.name }));
      await new Promise((resolve) => setTimeout(resolve, 800));
      onClose();
    } catch (error) {
      toast.error(t('toast.configFailed', { error: String(error) }));
      setConnecting(false);
    }
  };

  const isFormValid = () => {
    if (!meta) return false;
    return meta.configFields
      .filter((field) => field.required)
      .every((field) => configValues[field.key]?.trim());
  };

  const updateConfigValue = (key: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      data-testid="channel-config-modal"
      className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        data-testid="channel-config-modal-card"
        className={modalCardClasses}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/45 px-5 pb-4 pt-4 sm:px-6">
          <div className="min-w-0">
            <CardTitle className="text-[19px] font-semibold tracking-[-0.03em] text-foreground">
              {selectedType
                ? isExistingConfig
                  ? t('dialog.updateTitle', { name: CHANNEL_NAMES[selectedType] })
                  : t('dialog.configureTitle', { name: CHANNEL_NAMES[selectedType] })
                : t('dialog.addTitle')}
            </CardTitle>
            <CardDescription className="mt-1 max-w-[52ch] text-[12.5px] leading-5 text-foreground/60">
              {selectedType && isExistingConfig
                ? t('dialog.existingDesc')
                : meta ? t(meta.description.replace('channels:', '')) : t('dialog.selectDesc')}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-md border border-border/55 bg-[hsl(var(--foreground)/0.03)] text-foreground/55 shadow-sm hover:bg-[hsl(var(--foreground)/0.055)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-5 pb-0 pt-4 sm:px-6">
          {!selectedType ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {getPrimaryChannels().map((type) => {
                const channelMeta = CHANNEL_META[type];
                const isConfigured = configuredTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      `group relative flex min-h-[92px] items-center gap-3 rounded-md border border-border/55 p-3 text-left shadow-none transition-colors ${modalSubtleSurfaceClasses}`,
                      isConfigured
                        ? 'border-border/65 bg-[hsl(var(--foreground)/0.04)]'
                        : 'hover:border-border/60 hover:bg-[hsl(var(--foreground)/0.028)]'
                    )}
                  >
                    <div className="app-pane-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/55 text-foreground shadow-sm">
                      <ChannelLogo type={type} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="mb-1 flex min-w-0 items-center gap-2 pr-10">
                        <p className="truncate text-[14px] font-semibold text-foreground">{channelMeta.name}</p>
                        {channelMeta.isPlugin && (
                          <Badge
                            variant="secondary"
                            className="rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.04)] px-2 py-0.5 font-mono text-[10px] font-medium text-foreground/64 shadow-none"
                          >
                            {t('pluginBadge')}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-[12.5px] leading-[1.55] text-muted-foreground/76">
                        {t(channelMeta.description.replace('channels:', ''))}
                      </p>
                      <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/68">
                        {channelMeta.connectionType === 'qr' ? t('dialog.qrCode') : t('dialog.token')}
                      </p>
                    </div>
                    {isConfigured && (
                      <Badge className="absolute right-3 top-3 rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.045)] px-2 py-0.5 text-[10px] font-medium text-foreground/72 hover:bg-[hsl(var(--foreground)/0.045)]">
                        {t('configuredBadge')}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ) : qrCode ? (
            <div className="space-y-5 pb-4 text-center">
              <div className={cn('inline-block p-3', modalSurfaceClasses)}>
                {qrCode.startsWith('data:image') ? (
                  <img src={qrCode} alt="Scan QR Code" className="h-60 w-60 rounded-md object-contain" />
                ) : (
                  <canvas ref={qrCanvasRef} className="h-60 w-60 rounded-md" />
                )}
              </div>
              <p className="text-[13px] leading-5 text-muted-foreground/78">
                {t('dialog.scanQR', { name: meta?.name })}
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  className={outlineButtonClasses}
                  onClick={() => {
                    setQrCode(null);
                    void handleConnect();
                  }}
                >
                  {t('dialog.refreshCode')}
                </Button>
              </div>
            </div>
          ) : loadingConfig ? (
            <div className={cn('flex items-center justify-center gap-2 px-4 py-10', modalSurfaceClasses)}>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground/78">{t('dialog.loadingConfig')}</span>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {isExistingConfig && (
                <div className="flex items-center gap-2 rounded-md border border-border/55 bg-[hsl(var(--foreground)/0.035)] p-3 text-[13px] text-foreground/78">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{t('dialog.existingHint')}</span>
                </div>
              )}

              <div className={cn('space-y-4 p-4 shadow-none', modalSurfaceClasses)}>
                <div className="space-y-1">
                  <div>
                    <p className={labelClasses}>{t('dialog.howToConnect')}</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground/76">
                      {meta ? t(meta.description.replace('channels:', '')) : ''}
                    </p>
                  </div>
                </div>
                <ol className="list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-muted-foreground/78">
                  {meta?.instructions.map((instruction, index) => (
                    <li key={index}>{t(instruction)}</li>
                  ))}
                </ol>
              </div>

              {showChannelName && (
                <div className="space-y-2">
                  <Label htmlFor="name" className={labelClasses}>{t('dialog.channelName')}</Label>
                  <Input
                    ref={firstInputRef}
                    id="name"
                    placeholder={t('dialog.channelNamePlaceholder', { name: meta?.name })}
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    className={inputClasses}
                  />
                </div>
              )}

              {allowEditAccountId && (
                <div className="space-y-2.5">
                  <Label htmlFor="account-id" className={labelClasses}>{t('account.customIdLabel')}</Label>
                  <Input
                    id="account-id"
                    value={accountIdInput}
                    onChange={(event) => setAccountIdInput(event.target.value)}
                    placeholder={t('account.customIdPlaceholder')}
                    className={inputClasses}
                  />
                  <p className="text-[11.5px] leading-5 text-muted-foreground/68">{t('account.customIdHint')}</p>
                </div>
              )}

              {availableAgents.length > 0 && (
                <div className="space-y-2.5">
                  <Label htmlFor="channel-config-agent" className={labelClasses}>{t('account.bindAgentLabel')}</Label>
                  <Select
                    id="channel-config-agent"
                    aria-label={t('account.bindAgentLabel')}
                    data-testid="channel-config-agent-select"
                    value={selectedAgentId}
                    onValueChange={setSelectedAgentId}
                    options={[
                      { value: '', label: t('account.unassigned') },
                      ...availableAgents.map((agent) => ({
                        value: agent.id,
                        label: agent.name,
                      })),
                    ]}
                    className="h-8 rounded-md border border-border/60 app-field-surface text-[13px] shadow-sm"
                  />
                  <p className="text-[11.5px] leading-5 text-muted-foreground/68">{t('account.bindAgentHint')}</p>
                </div>
              )}

              <div className="space-y-3.5">
                {meta?.configFields.map((field) => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={configValues[field.key] || ''}
                    onChange={(value) => updateConfigValue(field.key, value)}
                    showSecret={showSecrets[field.key] || false}
                    onToggleSecret={() => toggleSecretVisibility(field.key)}
                  />
                ))}
              </div>

              {validationResult && (
                <div
                  className={cn(
                    'rounded-md border p-3.5 text-sm shadow-sm',
                    validationResult.valid
                      ? 'border-border/55 bg-[hsl(var(--foreground)/0.03)] text-foreground/78'
                      : 'border-destructive/20 bg-[hsl(var(--destructive)/0.055)] text-destructive'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    {validationResult.valid ? (
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h4 className="font-medium mb-1">
                        {validationResult.valid ? t('dialog.credentialsVerified') : t('dialog.validationFailed')}
                      </h4>
                      {validationResult.errors.length > 0 && (
                        <ul className="list-disc list-inside space-y-0.5">
                          {validationResult.errors.map((err, index) => (
                            <li key={index}>{err}</li>
                          ))}
                        </ul>
                      )}
                      {validationResult.valid && validationResult.warnings.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-foreground/70">
                          {validationResult.warnings.map((info, index) => (
                            <p key={index} className="text-xs leading-5">{info}</p>
                          ))}
                        </div>
                      )}
                      {!validationResult.valid && validationResult.warnings.length > 0 && (
                        <div className="mt-2 text-foreground/70">
                          <p className="mb-1 text-xs font-medium uppercase">{t('dialog.warnings')}</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {validationResult.warnings.map((warn, index) => (
                              <li key={index}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Separator className="bg-border/55" />

              <div className="flex flex-col gap-3 rounded-md border border-border/55 bg-[hsl(var(--surface-elevated)/0.72)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-col gap-2 sm:flex-row">
                  {meta?.connectionType === 'token' && shouldUseCredentialValidation && (
                    <Button
                      variant="outline"
                      onClick={handleValidate}
                      disabled={validating}
                      className={outlineButtonClasses}
                    >
                      {validating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t('dialog.validating')}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          {t('dialog.validateConfig')}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      void handleConnect();
                    }}
                    disabled={connecting || !isFormValid() || (allowEditAccountId && !accountIdInput.trim())}
                    className={primaryButtonClasses}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {meta?.connectionType === 'qr' ? t('dialog.generatingQR') : t('dialog.validatingAndSaving')}
                      </>
                    ) : meta?.connectionType === 'qr' ? (
                      t('dialog.generateQRCode')
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {isExistingConfig ? t('dialog.updateAndReconnect') : t('dialog.saveAndConnect')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface ConfigFieldProps {
  field: ChannelConfigField;
  value: string;
  onChange: (value: string) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
}

function ChannelLogo({ type }: { type: ChannelType }) {
  return <ChannelIcon type={type} size={22} />;
}

function ConfigField({ field, value, onChange, showSecret, onToggleSecret }: ConfigFieldProps) {
  const { t } = useTranslation('channels');
  const isPassword = field.type === 'password';

  return (
    <div className="space-y-2">
      <Label htmlFor={field.key} className={labelClasses}>
        {t(field.label)}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          id={field.key}
          type={isPassword && !showSecret ? 'password' : 'text'}
          placeholder={field.placeholder ? t(field.placeholder) : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClasses}
        />
        {isPassword && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleSecret}
            className="h-8 w-8 shrink-0 rounded-md border border-border/60 app-pane-surface text-muted-foreground/70 shadow-sm hover:text-foreground"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {field.description && (
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          {t(field.description)}
        </p>
      )}
      {field.envVar && (
        <p className="text-[12px] text-muted-foreground/70 font-mono">
          {t('dialog.envVar', { var: field.envVar })}
        </p>
      )}
    </div>
  );
}
