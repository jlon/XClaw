/**
 * Chat Input Component
 * Textarea with send button and universal file upload support.
 * Enter to send, Shift+Enter for new line.
 * Supports: native file picker, clipboard paste, drag & drop.
 * Files are staged to disk via IPC — only lightweight path references
 * are sent with the message (no base64 over WebSocket).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { SendHorizontal, Square, X, Paperclip, FileText, Film, Music, FileArchive, File, Loader2, AtSign, Box, ChevronDown, Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { resolveGatewayUi } from './gateway-ui';

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
}

interface ChatModelOption {
  ref: string;
  modelId?: string;
  name?: string;
  vendorId?: string;
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

function normalizeChatModelOption(raw: unknown): ChatModelOption | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const model = raw as Record<string, unknown>;
  const vendorId = typeof model.vendorId === 'string'
    ? model.vendorId
    : (typeof model.provider === 'string' ? model.provider : undefined);
  const modelId = typeof model.id === 'string'
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
    const trimmedModelId = modelId.trim();
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
  return {
    ref,
    modelId: modelId.trim() || undefined,
    name: name?.trim() || undefined,
    vendorId: vendorId?.trim() || undefined,
  };
}

function getModelLabel(model: ChatModelOption): string {
  return model.name || model.modelId || model.ref;
}

function getModelHint(model: ChatModelOption): string | null {
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

export function ChatInput({ onSend, onStop, disabled = false, sending = false, isEmpty = false }: ChatInputProps) {
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
  const currentModelLabel = selectedModel
    ? getModelLabel(selectedModel)
    : (currentModelId || currentAgent?.modelDisplay || t('composer.modelPickerDefault'));

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!input) {
      textarea.style.height = '36px';
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 180)}px`;
  });

  // Focus textarea on mount (avoids Windows focus loss after session delete + native dialog)
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

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
      const response = await gatewayRpc<{ models?: unknown[] }>('models.list', {});
      const nextModels = Array.isArray(response?.models)
        ? response.models.map(normalizeChatModelOption).filter((model): model is ChatModelOption => Boolean(model))
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
        "chat-im-font mx-auto w-full p-4 pb-5 transition-all duration-300",
        isEmpty ? "max-w-3xl" : "max-w-4xl"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        <div className={cn('app-panel-surface-elevated app-chat-composer-dock relative rounded-[26px] p-1.5 transition-all', dragOver ? 'border-primary/40 ring-2 ring-primary/15' : '')}>
          {selectedTarget && (
            <div className="px-2.5 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setTargetAgentId(null)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-primary/10"
                title={t('composer.clearTarget')}
              >
                <span>{t('composer.targetChip', { agent: selectedTarget.name })}</span>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1 px-1">
            {/* Attach Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={pickFiles}
              disabled={disabled || sending}
              title={t('composer.attachFiles')}
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {showAgentPicker && (
              <div ref={pickerRef} className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9 rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    (pickerOpen || selectedTarget) && 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                  onClick={() => {
                    setModelPickerOpen(false);
                    setPickerOpen((open) => !open);
                  }}
                  disabled={disabled || sending}
                  title={t('composer.pickAgent')}
                >
                  <AtSign className="h-4 w-4" />
                </Button>
                {pickerOpen && (
                  <div className="app-panel-surface-elevated absolute left-0 bottom-full z-20 mb-2 w-72 overflow-hidden rounded-2xl p-1.5">
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

            {/* Textarea */}
            <div className="flex-1 relative">
              <Textarea
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
                className="min-h-[36px] max-h-[180px] resize-none border-0 bg-transparent px-1.5 py-1.5 text-[15px] leading-[1.62] placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                style={!input ? { height: '36px' } : undefined}
                rows={1}
              />
            </div>

            <div ref={modelPickerRef} className="relative shrink-0 flex items-center gap-1.5">
              <div className="hidden h-6 w-px bg-border/70 sm:block" />
              <Button
                data-testid="chat-model-trigger"
                variant="ghost"
                size="sm"
                className={cn(
                  'app-field-surface h-[34px] max-w-[220px] rounded-full px-3 text-foreground/80 shadow-none transition-[background-color,border-color,color,box-shadow] duration-200 hover:bg-accent/70 hover:text-foreground',
                  modelPickerOpen && 'border-primary/20 bg-primary/10 text-foreground shadow-sm',
                )}
                onClick={() => {
                  setPickerOpen(false);
                  setModelPickerOpen((open) => !open);
                }}
                disabled={disabled || sending || switchingModel}
                title={t('composer.pickModel')}
              >
                {switchingModel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Box className="h-4 w-4 shrink-0" />
                )}
                <span className="max-w-[140px] truncate text-[13px]">{currentModelLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
              {modelPickerOpen && (
                <div className="app-panel-surface-elevated absolute right-0 bottom-full z-20 mb-2 w-64 overflow-hidden rounded-[22px] p-1.5">
                  <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground/80">
                    {t('composer.modelPickerTitle')}
                  </div>
                  <div className="px-2 pb-2">
                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
                      <Input
                        aria-label={t('composer.modelPickerSearchLabel')}
                        value={modelSearchQuery}
                        placeholder={t('composer.modelPickerSearchPlaceholder')}
                        onChange={(event) => setModelSearchQuery(event.target.value)}
                        className="h-8 rounded-full pl-9 pr-3 text-[12px] shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-ring/20 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  <div
                    className={cn(
                      'max-h-72 overflow-y-auto pr-0.5',
                      isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleModelSelect(null);
                      }}
                      className="flex w-full flex-col items-start rounded-2xl px-3 py-2.5 text-left transition-[background-color,color,box-shadow] hover:bg-accent/70"
                    >
                      <span className="text-[14px] font-medium text-foreground">{t('composer.modelPickerDefault')}</span>
                      <span className="text-[11px] text-muted-foreground">{t('composer.modelPickerDefaultHint')}</span>
                    </button>
                    {modelsLoading && (
                      <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                        {t('composer.modelPickerLoading')}
                      </div>
                    )}
                    {!modelsLoading && filteredModels.map((model) => (
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
                    {!modelsLoading && !!models.length && !filteredModels.length && !modelsLoadError && (
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

            <div className="ml-1 flex shrink-0 items-center gap-1">
              <Button
                onClick={sending ? handleStop : handleSend}
                disabled={sending ? !canStop : !canSend}
                size="icon"
                className={`h-9 w-9 shrink-0 rounded-full transition-[background-color,color,box-shadow] ${
                  sending
                    ? 'app-field-surface text-foreground hover:bg-accent'
                    : canSend
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md'
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
        <div className="app-field-surface flex max-w-[200px] items-center gap-2 px-3 py-2">
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
        <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--chrome))/0.64] backdrop-blur-sm">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
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
        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
        'flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition-colors',
        selected ? 'bg-primary/10 text-foreground' : 'hover:bg-accent/70'
      )}
    >
      <span className="text-[14px] font-medium text-foreground">{agent.name}</span>
      <span className="text-[11px] text-muted-foreground">
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
        'flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-[background-color,color,box-shadow]',
        selected
          ? 'bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]'
          : 'hover:bg-accent/70'
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-foreground">{getModelLabel(model)}</span>
        {hint && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />}
    </button>
  );
}
