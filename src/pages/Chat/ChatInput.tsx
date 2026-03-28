/**
 * Chat Input Component
 * Textarea with send button and universal file upload support.
 * Enter to send, Shift+Enter for new line.
 * Supports: native file picker, clipboard paste, drag & drop.
 * Files are staged to disk via IPC — only lightweight path references
 * are sent with the message (no base64 over WebSocket).
 */
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  SendHorizontal,
  Square,
  X,
  Paperclip,
  FileText,
  Film,
  Music,
  FileArchive,
  File,
  Loader2,
  AtSign,
  Box,
  Check,
  Search,
  ChevronDown,
  Plus,
  RotateCcw,
  Trash2,
  Eye,
  Brain,
  TerminalSquare,
  BookOpen,
  BarChart3,
  Download,
  Monitor,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { generateUuid } from '@/lib/uuid';
import { invokeIpc } from '@/lib/api-client';
import { getModelOptionHint, getModelOptionLabel, normalizeModelOption, type ModelOption } from '@/lib/model-options';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { getProviderAccountRuntimeKey } from '@/lib/provider-accounts';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import {
  CATEGORY_LABELS,
  getSlashCommandCompletions,
  SLASH_COMMANDS,
  type SlashCommandDef,
  type SlashCommandIcon,
} from '@/stores/chat/slash-commands';
import { resolveGatewayUi } from './gateway-ui';
import type { ProviderAccount } from '@/lib/providers';
import type { SkillChatDraft } from '@/types/skill';

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
  onSendSkillDraft?: (draft: SkillChatDraft, text: string) => Promise<boolean> | boolean;
  onStop?: () => void;
  disabled?: boolean;
  sending?: boolean;
  isEmpty?: boolean;
  draftSeed?: string;
  draftSeedVersion?: number;
  pendingSkillDraft?: SkillChatDraft | null;
  showScrollToLatest?: boolean;
  hasPendingLatest?: boolean;
  onScrollToLatest?: () => void;
}

type SlashMenuMode = 'command' | 'args';

const slashCommandIconMap: Record<SlashCommandIcon, LucideIcon> = {
  plus: Plus,
  refresh: RotateCcw,
  loader: Loader2,
  stop: Square,
  trash: Trash2,
  eye: Eye,
  brain: Brain,
  terminal: TerminalSquare,
  zap: Zap,
  book: BookOpen,
  barChart: BarChart3,
  download: Download,
  monitor: Monitor,
  x: X,
  send: SendHorizontal,
};

// ── Helpers ──────────────────────────────────────────────────────

function pickRandomIdlePrompt(prompts: string[], currentPrompt?: string | null): string {
  if (!prompts.length) {
    return '';
  }
  if (!currentPrompt || prompts.length === 1) {
    return prompts[Math.floor(Math.random() * prompts.length)] ?? prompts[0] ?? '';
  }
  const nextPrompts = prompts.filter((prompt) => prompt !== currentPrompt);
  return nextPrompts[Math.floor(Math.random() * nextPrompts.length)] ?? prompts[0] ?? '';
}

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

function SlashCommandGlyph({ icon, name }: { icon?: SlashCommandIcon; name: string }) {
  if (!icon) {
    return null;
  }
  const Icon = slashCommandIconMap[icon];
  return (
    <span
      data-testid={`slash-command-icon-${name}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--foreground)/0.06)] text-foreground/72"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
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

export const ChatInput = memo(function ChatInput({
  onSend,
  onSendSkillDraft,
  onStop,
  disabled = false,
  sending = false,
  isEmpty = false,
  draftSeed,
  draftSeedVersion = 0,
  pendingSkillDraft = null,
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
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);
  const [switchingModel, setSwitchingModel] = useState(false);
  const [idlePrompt, setIdlePrompt] = useState('');
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuItems, setSlashMenuItems] = useState<SlashCommandDef[]>([]);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [slashMenuMode, setSlashMenuMode] = useState<SlashMenuMode>('command');
  const [slashMenuCommand, setSlashMenuCommand] = useState<SlashCommandDef | null>(null);
  const [slashMenuArgItems, setSlashMenuArgItems] = useState<string[]>([]);
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
      getModelOptionLabel(model),
      getModelOptionHint(model) ?? '',
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
    ? getModelOptionLabel(selectedModel)
    : (currentAgent?.modelDisplay || currentModelId || t('composer.modelPickerDefault'));
  const composerTextareaMinHeight = isEmpty ? 68 : 56;
  const idlePrompts = useMemo(() => {
    const translated = t('composer.idlePrompts', { returnObjects: true });
    return Array.isArray(translated)
      ? translated.filter((prompt): prompt is string => typeof prompt === 'string' && prompt.trim().length > 0)
      : [];
  }, [t]);
  const groupedSlashMenuItems = useMemo(() => {
    return slashMenuItems.reduce<Array<{ category: string; items: SlashCommandDef[] }>>((groups, command) => {
      const category = command.category ?? 'session';
      const lastGroup = groups.at(-1);
      if (!lastGroup || lastGroup.category !== category) {
        groups.push({ category, items: [command] });
        return groups;
      }
      lastGroup.items.push(command);
      return groups;
    }, []);
  }, [slashMenuItems]);

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
    if (!isEmpty || disabled || input || !idlePrompts.length) {
      setIdlePrompt('');
      return;
    }
    setIdlePrompt((currentPrompt) => currentPrompt || pickRandomIdlePrompt(idlePrompts));
  }, [disabled, idlePrompts, input, isEmpty]);

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
            model: normalizeModelOption(model, providerLabelMap),
            index,
          }))
          .filter((entry): entry is { model: ModelOption; index: number } => Boolean(entry.model))
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
        const tempId = generateUuid();
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
      const tempId = generateUuid();
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

  const resetSlashMenu = useCallback(() => {
    setSlashMenuMode('command');
    setSlashMenuCommand(null);
    setSlashMenuArgItems([]);
    setSlashMenuItems([]);
    setSlashMenuIndex(0);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenuOpen(false);
    resetSlashMenu();
  }, [resetSlashMenu]);

  const updateSlashMenu = useCallback((value: string) => {
    const argMatch = value.match(/^\/(\S+)\s(.*)$/u);
    if (argMatch) {
      const commandName = argMatch[1]?.toLowerCase() ?? '';
      const argFilter = argMatch[2]?.toLowerCase() ?? '';
      const command = SLASH_COMMANDS.find((entry) => entry.name === commandName);
      if (command?.argOptions?.length) {
        const filtered = argFilter
          ? command.argOptions.filter((option) => option.toLowerCase().startsWith(argFilter))
          : command.argOptions;
        if (filtered.length > 0) {
          setSlashMenuMode('args');
          setSlashMenuCommand(command);
          setSlashMenuArgItems(filtered);
          setSlashMenuItems([]);
          setSlashMenuIndex(0);
          setSlashMenuOpen(true);
          return;
        }
      }
      closeSlashMenu();
      return;
    }

    const commandMatch = value.match(/^\/(\S*)$/u);
    if (commandMatch) {
      const items = getSlashCommandCompletions(commandMatch[1] ?? '');
      setSlashMenuItems(items);
      setSlashMenuMode('command');
      setSlashMenuCommand(null);
      setSlashMenuArgItems([]);
      setSlashMenuIndex(0);
      setSlashMenuOpen(items.length > 0);
      return;
    }

    closeSlashMenu();
  }, [closeSlashMenu]);

  const clearComposer = useCallback(() => {
    setInput('');
    setAttachments([]);
    setTargetAgentId(null);
    setPickerOpen(false);
    setSlashMenuOpen(false);
    resetSlashMenu();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [resetSlashMenu]);

  const dispatchMessage = useCallback(async (textToSend: string, attachmentsToSend?: FileAttachment[]) => {
    if (
      !attachmentsToSend?.length
      && pendingSkillDraft
      && textToSend.trim() === pendingSkillDraft.message.trim()
      && onSendSkillDraft
    ) {
      const handled = await onSendSkillDraft(pendingSkillDraft, textToSend);
      if (handled) {
        clearComposer();
        return;
      }
    }
    const nextAttachments = attachmentsToSend?.length ? attachmentsToSend : undefined;
    const nextTargetAgentId = targetAgentId;
    clearComposer();
    queueMicrotask(() => {
      onSend(textToSend, nextAttachments, nextTargetAgentId);
    });
  }, [clearComposer, onSend, onSendSkillDraft, pendingSkillDraft, targetAgentId]);

  const selectSlashArg = useCallback((arg: string, execute: boolean) => {
    const commandName = slashMenuCommand?.name ?? '';
    if (!commandName) {
      closeSlashMenu();
      return;
    }
    const nextValue = `/${commandName} ${arg}`;
    setInput(nextValue);
    closeSlashMenu();
    if (execute) {
      dispatchMessage(nextValue);
    } else {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [closeSlashMenu, dispatchMessage, slashMenuCommand]);

  const selectSlashCommand = useCallback((command: SlashCommandDef, executeDirect: boolean) => {
    if (command.argOptions?.length) {
      const nextValue = `/${command.name} `;
      setInput(nextValue);
      setSlashMenuMode('args');
      setSlashMenuCommand(command);
      setSlashMenuArgItems(command.argOptions);
      setSlashMenuItems([]);
      setSlashMenuIndex(0);
      setSlashMenuOpen(true);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    const nextValue = command.args ? `/${command.name} ` : `/${command.name}`;
    setInput(nextValue);
    closeSlashMenu();
    if (executeDirect && command.executeLocal && !command.args) {
      dispatchMessage(nextValue);
      return;
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [closeSlashMenu, dispatchMessage]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const readyAttachments = attachments.filter(a => a.status === 'ready');
    const textToSend = input.trim();
    const attachmentsToSend = readyAttachments.length > 0 ? readyAttachments : undefined;
    dispatchMessage(textToSend, attachmentsToSend);
  }, [attachments, canSend, dispatchMessage, input]);

  const handleStop = useCallback(() => {
    if (!canStop) return;
    onStop?.();
  }, [canStop, onStop]);

  const rotateIdlePrompt = useCallback(() => {
    if (!isEmpty || disabled || input || !idlePrompts.length) {
      return;
    }
    setIdlePrompt((currentPrompt) => pickRandomIdlePrompt(idlePrompts, currentPrompt));
  }, [disabled, idlePrompts, input, isEmpty]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (slashMenuOpen && slashMenuMode === 'args' && slashMenuArgItems.length > 0) {
        const itemCount = slashMenuArgItems.length;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSlashMenuIndex((currentIndex) => (currentIndex + 1) % itemCount);
            return;
          case 'ArrowUp':
            e.preventDefault();
            setSlashMenuIndex((currentIndex) => (currentIndex - 1 + itemCount) % itemCount);
            return;
          case 'Tab':
            e.preventDefault();
            selectSlashArg(slashMenuArgItems[slashMenuIndex] ?? slashMenuArgItems[0] ?? '', false);
            return;
          case 'Enter':
            e.preventDefault();
            selectSlashArg(slashMenuArgItems[slashMenuIndex] ?? slashMenuArgItems[0] ?? '', true);
            return;
          case 'Escape':
            e.preventDefault();
            closeSlashMenu();
            return;
        }
      }
      if (slashMenuOpen && slashMenuMode === 'command' && slashMenuItems.length > 0) {
        const itemCount = slashMenuItems.length;
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSlashMenuIndex((currentIndex) => (currentIndex + 1) % itemCount);
            return;
          case 'ArrowUp':
            e.preventDefault();
            setSlashMenuIndex((currentIndex) => (currentIndex - 1 + itemCount) % itemCount);
            return;
          case 'Tab':
            e.preventDefault();
            selectSlashCommand(slashMenuItems[slashMenuIndex] ?? slashMenuItems[0]!, false);
            return;
          case 'Enter':
            e.preventDefault();
            selectSlashCommand(slashMenuItems[slashMenuIndex] ?? slashMenuItems[0]!, true);
            return;
          case 'Escape':
            e.preventDefault();
            closeSlashMenu();
            return;
        }
      }
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
    [closeSlashMenu, handleSend, input, selectSlashArg, selectSlashCommand, slashMenuArgItems, slashMenuIndex, slashMenuItems, slashMenuMode, slashMenuOpen, targetAgentId],
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
  const resolvedPlaceholder = !disabled && !input && isEmpty && idlePrompt
    ? idlePrompt
    : (disabled && gatewayUi.placeholderKey ? t(gatewayUi.placeholderKey) : '');

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
        'chat-im-font app-chat-composer-shell app-chat-content-inset relative px-3 pb-4 md:px-4',
        isEmpty ? 'pt-4.5' : 'pt-3.5',
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
        <div className={cn(
          'app-chat-composer-dock relative rounded-[14px] border border-[hsl(var(--border-subtle)/0.68)] bg-[hsl(var(--surface-elevated)/0.985)] px-4 py-2.5 shadow-none',
          dragOver ? 'border-primary/30 ring-2 ring-primary/12' : '',
        )}>
          <div className="app-chat-composer-editor">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const nextValue = e.target.value;
                setInput(nextValue);
                updateSlashMenu(nextValue);
              }}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onPaste={handlePaste}
              onClick={rotateIdlePrompt}
              placeholder={resolvedPlaceholder}
              disabled={disabled}
              className={cn(
                'w-full max-h-[180px] resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-[1.6] text-foreground outline-none caret-foreground placeholder:text-[#c8c8c8] dark:placeholder:text-[hsl(var(--foreground)/0.32)]',
                isEmpty ? 'min-h-[74px]' : 'min-h-[60px]',
              )}
              style={!input ? { height: `${composerTextareaMinHeight}px` } : undefined}
              rows={1}
            />
          </div>

          {slashMenuOpen && (
            <div className="pointer-events-auto absolute bottom-full left-4 z-20 mb-3 w-[min(100%-2rem,24rem)] overflow-hidden rounded-[12px] border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-[0_14px_32px_hsl(var(--foreground)/0.08)] backdrop-blur-md">
              {slashMenuMode === 'args' && slashMenuCommand && slashMenuArgItems.length > 0 ? (
                <div className="p-2">
                  <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground/80">
                    /{slashMenuCommand.name} {slashMenuCommand.description}
                  </div>
                  <div className="space-y-1">
                    {slashMenuArgItems.map((arg, index) => (
                      <button
                        key={arg}
                        type="button"
                        onMouseEnter={() => setSlashMenuIndex(index)}
                        onClick={() => selectSlashArg(arg, true)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                          index === slashMenuIndex
                            ? 'bg-[hsl(var(--foreground)/0.06)] text-foreground'
                            : 'text-foreground/88 hover:bg-[hsl(var(--foreground)/0.032)]',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <SlashCommandGlyph icon={slashMenuCommand.icon} name={slashMenuCommand.name} />
                          <span className="text-[13px] font-medium">{arg}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground/72">/{slashMenuCommand.name} {arg}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] text-muted-foreground/70">
                    <span>↑↓ navigate</span>
                    <span>Tab fill</span>
                    <span>Enter run</span>
                    <span>Esc close</span>
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  {groupedSlashMenuItems.map((group) => (
                    <div key={group.category} className="pb-1 last:pb-0">
                      <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground/80">
                        {CATEGORY_LABELS[group.category as keyof typeof CATEGORY_LABELS]}
                      </div>
                      <div className="space-y-1">
                        {group.items.map((command) => {
                          const globalIndex = slashMenuItems.indexOf(command);
                          return (
                            <button
                              key={command.name}
                              type="button"
                              onMouseEnter={() => setSlashMenuIndex(globalIndex)}
                              onClick={() => selectSlashCommand(command, true)}
                              className={cn(
                                'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                                globalIndex === slashMenuIndex
                                  ? 'bg-[hsl(var(--foreground)/0.06)] text-foreground'
                                  : 'text-foreground/88 hover:bg-[hsl(var(--foreground)/0.032)]',
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <SlashCommandGlyph icon={command.icon} name={command.name} />
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium">/{command.name}</span>
                                  <span className="block text-[11px] text-muted-foreground/72">{command.description}</span>
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                {command.args ? (
                                  <span className="block text-[10px] text-muted-foreground/68">{command.args}</span>
                                ) : null}
                                {command.argOptions?.length ? (
                                  <span className="mt-1 inline-flex rounded-full bg-[hsl(var(--foreground)/0.05)] px-2 py-0.5 text-[10px] text-muted-foreground/78">
                                    {command.argOptions.length} options
                                  </span>
                                ) : command.executeLocal && !command.args ? (
                                  <span className="mt-1 inline-flex rounded-full bg-[hsl(var(--foreground)/0.05)] px-2 py-0.5 text-[10px] text-muted-foreground/78">
                                    instant
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] text-muted-foreground/70">
                    <span>↑↓ navigate</span>
                    <span>Tab fill</span>
                    <span>Enter select</span>
                    <span>Esc close</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="app-chat-composer-footer mt-2.5">
            <div className="app-chat-composer-tools">
              <Button
                variant="ghost"
                size="icon"
                className="app-chat-composer-tool-button shrink-0"
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
                    <AtSign className="h-4 w-4" />
                  </Button>
                  {pickerOpen && (
                    <div className="app-chat-picker-surface absolute left-0 bottom-full z-20 mb-2 w-72 overflow-hidden rounded-md p-1.5">
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
                  className="app-chat-composer-target-chip inline-flex h-6 items-center gap-1.5 rounded-sm px-1.5 text-[11px] font-medium text-foreground/74 transition-colors hover:text-foreground"
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Box className="h-4 w-4 shrink-0" />
                  )}
                </Button>
                {modelPickerOpen && (
                  <div className="app-chat-picker-surface absolute left-0 bottom-full z-20 mb-2 w-64 overflow-hidden rounded-md p-1.5">
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
                        className="flex w-full flex-col items-start rounded-sm px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]"
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
              className={`h-7 w-7 shrink-0 rounded-md transition-colors ${
                sending
                  ? 'border border-border/70 bg-[hsl(var(--surface-elevated))] text-foreground hover:bg-[hsl(var(--surface-hover))]'
                  : canSend
                    ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                    : 'bg-transparent text-muted-foreground/45 hover:bg-transparent'
              }`}
              variant="ghost"
              title={sending ? t('composer.stop') : t('composer.send')}
            >
              {sending ? (
                <Square className="h-4 w-4" fill="currentColor" />
              ) : (
                <SendHorizontal className="h-[17px] w-[17px] -rotate-90" strokeWidth={2} />
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
});

ChatInput.displayName = 'ChatInput';

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
    <div className="group relative overflow-hidden rounded-lg border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.96)] shadow-sm">
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
        <div className="flex max-w-[200px] items-center gap-2 rounded-md px-3 py-2.5">
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
        className="absolute -right-1 -top-1 rounded-sm border border-border/60 bg-[hsl(var(--surface-elevated)/0.98)] p-1 text-muted-foreground/78 opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
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
        'flex w-full flex-col items-start rounded-md border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow]',
        selected
          ? 'border-[hsl(var(--border-subtle)/1)] bg-[hsl(var(--surface-elevated)/1)] text-foreground shadow-[0_4px_12px_hsl(var(--foreground)/0.03)]'
          : 'border-transparent hover:border-[hsl(var(--border-subtle)/0.72)] hover:bg-[hsl(var(--foreground)/0.032)]'
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
  model: ModelOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const hint = getModelOptionHint(model);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-[background-color,color,border-color,box-shadow]',
        selected
          ? 'border-[hsl(var(--border-subtle)/1)] bg-[hsl(var(--surface-elevated)/1)] text-foreground shadow-[0_4px_12px_hsl(var(--foreground)/0.03)]'
          : 'border-transparent hover:border-[hsl(var(--border-subtle)/0.72)] hover:bg-[hsl(var(--foreground)/0.032)]'
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">{getModelOptionLabel(model)}</span>
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
