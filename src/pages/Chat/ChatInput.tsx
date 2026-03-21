/**
 * Chat Input Component
 * Textarea with send button and universal file upload support.
 * Enter to send, Shift+Enter for new line.
 * Supports: native file picker, clipboard paste, drag & drop.
 * Files are staged to disk via IPC — only lightweight path references
 * are sent with the message (no base64 over WebSocket).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SendHorizontal, Square, X, Paperclip, FileText, Film, Music, FileArchive, File, Loader2, AtSign, Box, Check, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { getProviderAccountRuntimeKey } from '@/lib/provider-accounts';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { resolveGatewayUi } from './gateway-ui';
import type { ProviderAccount } from '@/lib/providers';

// ── Types ────────────────────────────────────────────────────────

export interface FileAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  stagedPath: string;        // disk path for gateway
  preview: string | null;    // data URL for images, null for others
  status: 'staging' | 'ready' | 'error';
  error?: string;
}

interface ChatInputProps {
  onSend: (text: string, attachments?: FileAttachment[], targetAgentId?: string | null) => void;
  onStop?: () => void;
  disabled?: boolean;
  sending?: boolean;
  isEmpty?: boolean;
  draftSeed?: string;
  draftSeedVersion?: number;
  showScrollToLatest?: boolean;
  hasPendingLatest?: boolean;
  onScrollToLatest?: () => void;
}

interface ChatModelOption {
  ref: string;
  modelId?: string;
  name?: string;
  vendorId?: string;
  providerLabel?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') return <FileText className={className} />;
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('7z')) return <FileArchive className={className} />;
  if (mimeType === 'application/pdf') return <FileText className={className} />;
  return <File className={className} />;
}

function normalizeChatModelOption(
  raw: unknown,
  providerLabelMap: Map<string, string>,
): ChatModelOption | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const model = raw as Record<string, unknown>;
  const vendorId = typeof model.vendorId === 'string'
    ? model.vendorId
    : (typeof model.provider === 'string' ? model.provider : undefined);
  const rawModelId = typeof model.id === 'string'
    ? model.id
    : (typeof model.model === 'string' ? model.model : '');
  const ref = (() => {
    if (typeof model.key === 'string' && model.key.trim()) {
      return model.key.trim();
    }
    if (typeof model.ref === 'string' && model.ref.trim()) {
      return model.ref.trim();
    }
    if (typeof model.modelRef === 'string' && model.modelRef.trim()) {
      return model.modelRef.trim();
    }
    const trimmedModelId = rawModelId.trim();
    if (!trimmedModelId) {
      return '';
    }
    if (trimmedModelId.includes('/')) {
      return trimmedModelId;
    }
    const trimmedVendorId = vendorId?.trim();
    return trimmedVendorId ? `${trimmedVendorId}/${trimmedModelId}` : trimmedModelId;
  })();
  if (!ref) {
    return null;
  }
  const name = typeof model.name === 'string'
    ? model.name
    : (typeof model.label === 'string' ? model.label : undefined);
  const trimmedModelId = rawModelId.trim();
  const refProvider = ref.includes('/') ? ref.split('/')[0]?.trim() : undefined;
  const refModelId = ref.includes('/') ? ref.slice(ref.indexOf('/') + 1).trim() : undefined;
  const normalizedVendorId = vendorId?.trim() || refProvider || undefined;
  const normalizedModelId = (
    trimmedModelId.includes('/')
      ? trimmedModelId.slice(trimmedModelId.indexOf('/') + 1).trim()
      : trimmedModelId
  ) || refModelId || undefined;
  return {
    ref,
    modelId: normalizedModelId,
    name: name?.trim() || undefined,
    vendorId: normalizedVendorId,
    providerLabel: providerLabelMap.get(normalizedVendorId || '')?.trim() || undefined,
  };
}

function getModelLabel(model: ChatModelOption): string {
  return model.name || model.modelId || model.ref;
}

function getModelHintBase(model: ChatModelOption): string {
  if (model.modelId && model.modelId !== model.ref) {
    return model.modelId;
  }
  if (model.name && model.name !== model.ref) {
    return model.name;
  }
  return model.ref;
}

function getModelHint(model: ChatModelOption): string | null {
  if (model.providerLabel) {
    const hintBase = getModelHintBase(model);
    if (!hintBase) {
      return model.providerLabel;
    }
    const providerPrefix = `${model.providerLabel}/`;
    if (hintBase.startsWith(providerPrefix)) {
      return model.providerLabel;
    }
    if (hintBase === model.providerLabel) {
      return null;
    }
    return `${model.providerLabel} · ${hintBase}`;
  }
  if (model.name && model.name !== model.ref) {
    return model.ref;
  }
  if (model.modelId && model.modelId !== model.ref) {
    return model.ref;
  }
  return null;
}

/**
 * Read a browser File object as base64 string (without the data URL prefix).
 */
function readFileAsBase64(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (!dataUrl || !dataUrl.includes(',')) {
        reject(new Error(`Invalid data URL from FileReader for ${file.name}`));
        return;
      }
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error(`Empty base64 data for ${file.name}`));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Component ────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  onStop,
  disabled = false,
  sending = false,
  isEmpty = false,
  draftSeed,
  draftSeedVersion = 0,
  showScrollToLatest = false,
  hasPendingLatest = false,
  onScrollToLatest,
}: ChatInputProps) {
  const { t } = useTranslation('chat');
  const isWindows = window.electron?.platform === 'win32';
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [switchingModel, setSwitchingModel] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const gatewayStatus = useGatewayStore((s) => s.status);
  const gatewayRpc = useGatewayStore((s) => s.rpc);
  const agents = useAgentsStore((s) => s.agents);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessions = useChatStore((s) => s.sessions);
  const setSessionModel = useChatStore((s) => s.setSessionModel);
  const currentAgentName = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId)?.name ?? currentAgentId,
    [agents, currentAgentId],
  );
  const currentAgent = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId) ?? null,
    [agents, currentAgentId],
  );
  const mentionableAgents = useMemo(
    () => (agents ?? []).filter((agent) => agent.id !== currentAgentId),
    [agents, currentAgentId],
  );
  const selectedTarget = useMemo(
    () => (agents ?? []).find((agent) => agent.id === targetAgentId) ?? null,
    [agents, targetAgentId],
  );
  const showAgentPicker = mentionableAgents.length > 0;
  const currentSession = useMemo(
    () => (sessions ?? []).find((session) => session.key === currentSessionKey) ?? null,
    [sessions, currentSessionKey],
  );
  const currentModelId = currentSession?.model?.trim() || null;
  const selectedModel = useMemo(
    () => models.find((model) => model.ref === currentModelId) ?? null,
    [models, currentModelId],
  );
  const filteredModels = useMemo(() => {
    const normalizedQuery = modelSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return models;
    }
    return models.filter((model) => [
      getModelLabel(model),
      getModelHint(model) ?? '',
      model.ref,
      model.modelId ?? '',
      model.vendorId ?? '',
    ].join(' ').toLowerCase().includes(normalizedQuery));
  }, [modelSearchQuery, models]);
  const orderedModels = useMemo(() => {
    if (!currentModelId) {
      return filteredModels;
    }
    const currentIndex = filteredModels.findIndex((model) => model.ref === currentModelId);
    if (currentIndex <= 0) {
      return filteredModels;
    }
    const nextModels = [...filteredModels];
    const [currentModel] = nextModels.splice(currentIndex, 1);
    return currentModel ? [currentModel, ...nextModels] : filteredModels;
  }, [currentModelId, filteredModels]);
  const pinnedCurrentModel = currentModelId && orderedModels[0]?.ref === currentModelId
    ? orderedModels[0]
    : null;
  const currentModelLabel = selectedModel
    ? getModelLabel(selectedModel)
    : (currentAgent?.modelDisplay || currentModelId || t('composer.modelPickerDefault'));
  const composerTextareaMinHeight = isEmpty ? 82 : 68;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!input) {
      textarea.style.height = `${composerTextareaMinHeight}px`;
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, composerTextareaMinHeight), 180)}px`;
  }, [composerTextareaMinHeight, input]);

  // Focus textarea on mount (avoids Windows focus loss after session delete + native dialog)
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (!draftSeedVersion || !draftSeed) return;
    setInput(draftSeed);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const caret = draftSeed.length;
      textareaRef.current.setSelectionRange(caret, caret);
    });
  }, [draftSeed, draftSeedVersion]);

  useEffect(() => {
    if (!targetAgentId) return;
    if (targetAgentId === currentAgentId) {
      setTargetAgentId(null);
      setPickerOpen(false);
      return;
    }
    if (!(agents ?? []).some((agent) => agent.id === targetAgentId)) {
      setTargetAgentId(null);
      setPickerOpen(false);
    }
  }, [agents, currentAgentId, targetAgentId]);

  useEffect(() => {
    if (!pickerOpen && !modelPickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!pickerRef.current?.contains(target)) {
        setPickerOpen(false);
      }
      if (!modelPickerRef.current?.contains(target)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [pickerOpen, modelPickerOpen]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsLoadError(null);
    try {
      const [response, providerAccounts] = await Promise.all([
        gatewayRpc<{ models?: unknown[] }>('models.list', {}),
        hostApiFetch<ProviderAccount[]>('/api/provider-accounts').catch(() => []),
      ]);
      const preferredModelRefs = new Set(
        (providerAccounts ?? [])
          .map((account) => {
            const modelId = account.model?.trim();
            if (!modelId) {
              return null;
            }
            return `${getProviderAccountRuntimeKey(account)}/${modelId}`.toLowerCase();
          })
          .filter((ref): ref is string => Boolean(ref)),
      );
      const providerLabelMap = new Map(
        (providerAccounts ?? []).map((account) => [getProviderAccountRuntimeKey(account), account.label]),
      );
      const nextModels = Array.isArray(response?.models)
        ? response.models
          .map((model, index) => ({
            model: normalizeChatModelOption(model, providerLabelMap),
            index,
          }))
          .filter((entry): entry is { model: ChatModelOption; index: number } => Boolean(entry.model))
          .sort((left, right) => {
            const leftPreferred = preferredModelRefs.has(left.model.ref.toLowerCase());
            const rightPreferred = preferredModelRefs.has(right.model.ref.toLowerCase());
            if (leftPreferred !== rightPreferred) {
              return leftPreferred ? -1 : 1;
            }
            return left.index - right.index;
          })
          .map((entry) => entry.model)
        : [];
      setModels(nextModels);
    } catch (error) {
      setModelsLoadError(String(error));
    } finally {
      setModelsLoading(false);
    }
  }, [gatewayRpc]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    void loadModels();
  }, [loadModels, modelPickerOpen]);

  useEffect(() => {
    if (modelPickerOpen) return;
    setModelSearchQuery('');
  }, [modelPickerOpen]);

  const handleModelSelect = useCallback(async (model: string | null) => {
    setSwitchingModel(true);
    try {
      await setSessionModel(model);
      setModelPickerOpen(false);
    } finally {
      setSwitchingModel(false);
    }
  }, [setSessionModel]);

  // ── File staging via native dialog ─────────────────────────────

  const pickFiles = useCallback(async () => {
    try {
      const result = await invokeIpc('dialog:open', {
        properties: ['openFile', 'multiSelections'],
      }) as { canceled: boolean; filePaths?: string[] };
      if (result.canceled || !result.filePaths?.length) return;

      // Add placeholder entries immediately
      const tempIds: string[] = [];
      for (const filePath of result.filePaths) {
        const tempId = crypto.randomUUID();
        tempIds.push(tempId);
        // Handle both Unix (/) and Windows (\) path separators
        const fileName = filePath.split(/[\\/]/).pop() || 'file';
        setAttachments(prev => [...prev, {
          id: tempId,
          fileName,
          mimeType: '',
          fileSize: 0,
          stagedPath: '',
          preview: null,
          status: 'staging' as const,
        }]);
      }

      // Stage all files via IPC
      console.log('[pickFiles] Staging files:', result.filePaths);
      const staged = await hostApiFetch<Array<{
        id: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        stagedPath: string;
        preview: string | null;
      }>>('/api/files/stage-paths', {
        method: 'POST',
        body: JSON.stringify({ filePaths: result.filePaths }),
      });
      console.log('[pickFiles] Stage result:', staged?.map(s => ({ id: s?.id, fileName: s?.fileName, mimeType: s?.mimeType, fileSize: s?.fileSize, stagedPath: s?.stagedPath, hasPreview: !!s?.preview })));

      // Update each placeholder with real data
      setAttachments(prev => {
        let updated = [...prev];
        for (let i = 0; i < tempIds.length; i++) {
          const tempId = tempIds[i];
          const data = staged[i];
          if (data) {
            updated = updated.map(a =>
              a.id === tempId
                ? { ...data, status: 'ready' as const }
                : a,
            );
          } else {
            console.warn(`[pickFiles] No staged data for tempId=${tempId} at index ${i}`);
            updated = updated.map(a =>
              a.id === tempId
                ? { ...a, status: 'error' as const, error: 'Staging failed' }
                : a,
            );
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('[pickFiles] Failed to stage files:', err);
      // Mark any stuck 'staging' attachments as 'error' so the user can remove them
      // and the send button isn't permanently blocked
      setAttachments(prev => prev.map(a =>
        a.status === 'staging'
          ? { ...a, status: 'error' as const, error: String(err) }
          : a,
      ));
    }
  }, []);

  // ── Stage browser File objects (paste / drag-drop) ─────────────

  const stageBufferFiles = useCallback(async (files: globalThis.File[]) => {
    for (const file of files) {
      const tempId = crypto.randomUUID();
      setAttachments(prev => [...prev, {
        id: tempId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        stagedPath: '',
        preview: null,
        status: 'staging' as const,
      }]);

      try {
        console.log(`[stageBuffer] Reading file: ${file.name} (${file.type}, ${file.size} bytes)`);
        const base64 = await readFileAsBase64(file);
        console.log(`[stageBuffer] Base64 length: ${base64?.length ?? 'null'}`);
        const staged = await hostApiFetch<{
          id: string;
          fileName: string;
          mimeType: string;
          fileSize: number;
          stagedPath: string;
          preview: string | null;
        }>('/api/files/stage-buffer', {
          method: 'POST',
          body: JSON.stringify({
            base64,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
          }),
        });
        console.log(`[stageBuffer] Staged: id=${staged?.id}, path=${staged?.stagedPath}, size=${staged?.fileSize}`);
        setAttachments(prev => prev.map(a =>
          a.id === tempId ? { ...staged, status: 'ready' as const } : a,
        ));
      } catch (err) {
        console.error(`[stageBuffer] Error staging ${file.name}:`, err);
        setAttachments(prev => prev.map(a =>
          a.id === tempId
            ? { ...a, status: 'error' as const, error: String(err) }
            : a,
        ));
      }
    }
  }, []);

  // ── Attachment management ──────────────────────────────────────

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const allReady = attachments.length === 0 || attachments.every(a => a.status === 'ready');
  const hasFailedAttachments = attachments.some((a) => a.status === 'error');
  const canSend = (input.trim() || attachments.length > 0) && allReady && !disabled && !sending;
  const canStop = sending && !disabled && !!onStop;
  const gatewayUi = resolveGatewayUi(gatewayStatus.state);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const readyAttachments = attachments.filter(a => a.status === 'ready');
    // Capture values before clearing — clear input immediately for snappy UX,
    // but keep attachments available for the async send
    const textToSend = input.trim();
    const attachmentsToSend = readyAttachments.length > 0 ? readyAttachments : undefined;
    console.log(`[handleSend] text="${textToSend.substring(0, 50)}", attachments=${attachments.length}, ready=${readyAttachments.length}, sending=${!!attachmentsToSend}`);
    if (attachmentsToSend) {
      console.log('[handleSend] Attachment details:', attachmentsToSend.map(a => ({
        id: a.id, fileName: a.fileName, mimeType: a.mimeType, fileSize: a.fileSize,
        stagedPath: a.stagedPath, status: a.status, hasPreview: !!a.preview,
      })));
    }
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(textToSend, attachmentsToSend, targetAgentId);
    setTargetAgentId(null);
    setPickerOpen(false);
  }, [input, attachments, canSend, onSend, targetAgentId]);

  const handleStop = useCallback(() => {
    if (!canStop) return;
    onStop?.();
  }, [canStop, onStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !input && targetAgentId) {
        setTargetAgentId(null);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const nativeEvent = e.nativeEvent as KeyboardEvent;
        if (isComposingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) {
          return;
        }
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, input, targetAgentId],
  );

  // Handle paste (Ctrl/Cmd+V with files)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: globalThis.File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        stageBufferFiles(pastedFiles);
      }
    },
    [stageBufferFiles],
  );

  // Handle drag & drop
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) {
        stageBufferFiles(Array.from(e.dataTransfer.files));
      }
    },
    [stageBufferFiles],
  );

  return (
    <div
      className={cn(
        'chat-im-font app-chat-workbench relative px-4 pb-6 transition-all duration-300',
        isEmpty ? 'pt-5' : 'pt-4',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showScrollToLatest && onScrollToLatest && (
        <div className="pointer-events-none absolute bottom-full right-4 z-10 mb-2">
          <button
            type="button"
            onClick={onScrollToLatest}
            className="app-chat-scroll-to-latest pointer-events-auto"
            aria-label={t('toolbar.scrollToLatest')}
            title={t('toolbar.scrollToLatest')}
          >
            <ChevronDown className="h-4 w-4" />
            {hasPendingLatest && (
              <span className="status-indicator status-indicator-glow absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
            )}
          </button>
        </div>
      )}

      <div className="w-full">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className={cn('app-chat-composer-dock relative rounded-[14px] px-3 py-2.5 transition-all', dragOver ? 'border-primary/30 ring-2 ring-primary/12' : '')}>
          <div className="app-chat-composer-editor">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onPaste={handlePaste}
              placeholder={disabled && gatewayUi.placeholderKey ? t(gatewayUi.placeholderKey) : ''}
              disabled={disabled}
              className={cn(
                'w-full max-h-[180px] resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-[1.6] text-foreground outline-none placeholder:text-muted-foreground/60',
                isEmpty ? 'min-h-[82px]' : 'min-h-[68px]',
              )}
              style={!input ? { height: `${composerTextareaMinHeight}px` } : undefined}
              rows={1}
            />
          </div>

          <div className="app-chat-composer-footer absolute inset-x-3.5 bottom-3 pointer-events-none">
            <div className="app-chat-composer-tools pointer-events-auto">
              <Button
                variant="ghost"
                size="icon"
                className="app-chat-composer-tool-button shrink-0"
                onClick={pickFiles}
                disabled={disabled || sending}
                title={t('composer.attachFiles')}
              >
                <Paperclip className="h-[17px] w-[17px]" />
              </Button>

              {showAgentPicker && (
                <div ref={pickerRef} className="relative shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'app-chat-composer-tool-button',
                      (pickerOpen || selectedTarget) && 'app-chat-composer-tool-button--active'
                    )}
                    onClick={() => {
                      setModelPickerOpen(false);
                      setPickerOpen((open) => !open);
                    }}
                    disabled={disabled || sending}
                    title={t('composer.pickAgent')}
                  >
                    <AtSign className="h-[17px] w-[17px]" />
                  </Button>
                  {pickerOpen && (
                    <div className="app-chat-picker-surface absolute left-0 bottom-full z-20 mb-2 w-72 overflow-hidden rounded-[14px] p-1.5">
                      <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground/80">
                        {t('composer.agentPickerTitle', { currentAgent: currentAgentName })}
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {mentionableAgents.map((agent) => (
                          <AgentPickerItem
                            key={agent.id}
                            agent={agent}
                            selected={agent.id === targetAgentId}
                            onSelect={() => {
                              setTargetAgentId(agent.id);
                              setPickerOpen(false);
                              textareaRef.current?.focus();
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedTarget && (
                <button
                  type="button"
                  onClick={() => setTargetAgentId(null)}
                  className="app-chat-composer-target-chip inline-flex h-6 items-center gap-1.5 rounded-[8px] px-1.5 text-[11px] font-medium text-foreground/74 transition-colors hover:text-foreground"
                  title={t('composer.clearTarget')}
                >
                  <span className="max-w-[180px] truncate">{t('composer.targetChip', { agent: selectedTarget.name })}</span>
                  <X className="h-3.5 w-3.5 text-muted-foreground/72" />
                </button>
              )}

              <div ref={modelPickerRef} className="relative shrink-0">
                <Button
                  data-testid="chat-model-trigger"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'app-chat-composer-tool-button',
                    modelPickerOpen && 'app-chat-composer-tool-button--active',
                  )}
                  onClick={() => {
                    setPickerOpen(false);
                    setModelPickerOpen((open) => !open);
                  }}
                  disabled={disabled || sending || switchingModel}
                  title={t('composer.currentModelTooltip', { model: currentModelLabel })}
                  aria-label={t('composer.currentModelTooltip', { model: currentModelLabel })}
                >
                  {switchingModel ? (
                    <Loader2 className="h-[17px] w-[17px] animate-spin" />
                  ) : (
                    <Box className="h-[17px] w-[17px] shrink-0" />
                  )}
                </Button>
                {modelPickerOpen && (
                  <div className="app-chat-picker-surface absolute left-0 bottom-full z-20 mb-2 w-64 overflow-hidden rounded-[14px] p-1.5">
                    <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground/80">
                      {t('composer.modelPickerTitle')}
                    </div>
                    <div className="px-2 pb-2">
                      <div className="app-chat-picker-search relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
                        <input
                          aria-label={t('composer.modelPickerSearchLabel')}
                          value={modelSearchQuery}
                          placeholder={t('composer.modelPickerSearchPlaceholder')}
                          onChange={(event) => setModelSearchQuery(event.target.value)}
                          className="app-chat-picker-search-input h-8 pl-8.5 pr-3 text-[12px]"
                        />
                      </div>
                    </div>
                    <div
                      className={cn(
                        'max-h-72 overflow-y-auto pr-0.5',
                        isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar',
                      )}
                    >
                      {pinnedCurrentModel && (
                        <ModelPickerItem
                          model={pinnedCurrentModel}
                          selected
                          onSelect={() => {
                            void handleModelSelect(pinnedCurrentModel.ref);
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void handleModelSelect(null);
                        }}
                        className="flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]"
                      >
                        <span className="text-[12.5px] font-medium text-foreground/92">{t('composer.modelPickerDefault')}</span>
                        <span className="text-[10.5px] text-muted-foreground/72">{t('composer.modelPickerDefaultHint')}</span>
                      </button>
                      {modelsLoading && (
                        <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                          {t('composer.modelPickerLoading')}
                        </div>
                      )}
                      {!modelsLoading && orderedModels
                        .filter((model) => model.ref !== pinnedCurrentModel?.ref)
                        .map((model) => (
                        <ModelPickerItem
                          key={model.ref}
                          model={model}
                          selected={model.ref === currentModelId}
                          onSelect={() => {
                            void handleModelSelect(model.ref);
                          }}
                        />
                      ))}
                      {!modelsLoading && !models.length && !modelsLoadError && (
                        <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                          {t('composer.modelPickerEmpty')}
                        </div>
                      )}
                      {!modelsLoading && !!models.length && !orderedModels.length && !modelsLoadError && (
                        <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                          {t('composer.modelPickerEmptySearch')}
                        </div>
                      )}
                      {modelsLoadError && (
                        <div className="px-3 py-3 text-[12px] text-destructive">
                          {t('composer.modelPickerLoadFailed')}: {modelsLoadError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={sending ? handleStop : handleSend}
              disabled={sending ? !canStop : !canSend}
              size="icon"
              className={`pointer-events-auto h-8 w-8 shrink-0 rounded-[12px] transition-[background-color,color,box-shadow] ${
                sending
                  ? 'border border-[hsl(var(--border-subtle)/0.62)] bg-[hsl(var(--surface-elevated)/0.96)] text-foreground hover:bg-[hsl(var(--foreground)/0.04)]'
                  : canSend
                    ? 'bg-primary text-primary-foreground shadow-none hover:bg-primary/90'
                    : 'bg-transparent text-muted-foreground/45 hover:bg-transparent'
              }`}
              variant="ghost"
              title={sending ? t('composer.stop') : t('composer.send')}
            >
              {sending ? (
                <Square className="h-4 w-4" fill="currentColor" />
              ) : (
                <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
              )}
            </Button>
          </div>
        </div>
        {hasFailedAttachments && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px]"
              onClick={() => {
                setAttachments((prev) => prev.filter((att) => att.status !== 'error'));
                void pickFiles();
              }}
            >
              {t('composer.retryFailedAttachments')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attachment Preview ───────────────────────────────────────────

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: FileAttachment;
  onRemove: () => void;
}) {
  const { t } = useTranslation('chat');
  const isImage = attachment.mimeType.startsWith('image/') && attachment.preview;

  return (
    <div className="relative group rounded-lg overflow-hidden border border-border">
      {isImage ? (
        // Image thumbnail
        <div className="w-16 h-16">
          <img
            src={attachment.preview!}
            alt={attachment.fileName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        // Generic file card
        <div className="app-pane-surface flex max-w-[200px] items-center gap-2 rounded-[9px] px-3 py-2">
          <FileIcon mimeType={attachment.mimeType} className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-medium truncate">{attachment.fileName}</p>
            <p className="text-[10px] text-muted-foreground">
              {attachment.fileSize > 0 ? formatFileSize(attachment.fileSize) : '...'}
            </p>
          </div>
        </div>
      )}

      {/* Staging overlay */}
      {attachment.status === 'staging' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--surface-base))/0.88]">
          <Loader2 className="h-4 w-4 animate-spin text-foreground/72" />
        </div>
      )}

      {/* Error overlay */}
      {attachment.status === 'error' && (
        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
          <span className="px-1 text-[10px] font-medium text-destructive">{t('common:status.error')}</span>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -right-1 -top-1 rounded-[8px] border border-border/60 bg-[hsl(var(--surface-elevated)/0.98)] p-1 text-muted-foreground/78 opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function AgentPickerItem({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left transition-colors',
        selected ? 'bg-[hsl(var(--foreground)/0.055)] text-foreground' : 'hover:bg-[hsl(var(--foreground)/0.04)]'
      )}
    >
      <span className="text-[13px] font-medium text-foreground">{agent.name}</span>
      <span className="text-[10.5px] text-muted-foreground/78">
        {agent.modelDisplay}
      </span>
    </button>
  );
}

function ModelPickerItem({
  model,
  selected,
  onSelect,
}: {
  model: ChatModelOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const hint = getModelHint(model);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left transition-[background-color,color]',
        selected
          ? 'bg-[hsl(var(--foreground)/0.055)] text-foreground'
          : 'hover:bg-[hsl(var(--foreground)/0.04)]'
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">{getModelLabel(model)}</span>
        {hint && (
          <span className="block truncate text-[10.5px] text-muted-foreground/78">
            {hint}
          </span>
        )}
      </span>
      {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />}
    </button>
  );
}
