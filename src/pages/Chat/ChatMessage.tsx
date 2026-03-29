/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with markdown, thinking sections, images, and tool cards.
 */
import { useState, useCallback, useEffect, memo } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileText, Film, Music, FileArchive, File, X, FolderOpen, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createPortal } from 'react-dom';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import type { RawMessage, AttachedFileMeta } from '@/stores/chat';
import type { AgentSummary } from '@/types/agent';
import { extractText, extractThinking, extractImages, extractToolUse, formatTimestamp, isSystemRuntimeMessage } from './message-utils';
import { useTranslation } from 'react-i18next';

interface ChatMessageProps {
  message: RawMessage;
  showThinking: boolean;
  assistantAvatar?: Pick<AgentSummary, 'id' | 'name' | 'avatarProfile'> | null;
  showAvatar?: boolean;
  isStreaming?: boolean;
  streamingTools?: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
}

interface ExtractedImage { url?: string; data?: string; mimeType: string; }

/** Resolve an ExtractedImage to a displayable src string, or null if not possible. */
function imageSrc(img: ExtractedImage): string | null {
  if (img.url) return img.url;
  if (img.data) return `data:${img.mimeType};base64,${img.data}`;
  return null;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showThinking,
  assistantAvatar,
  showAvatar = true,
  isStreaming = false,
  streamingTools = [],
}: ChatMessageProps) {
  const { t } = useTranslation('chat');
  const isUser = message.role === 'user';
  const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
  const isToolResult = role === 'toolresult' || role === 'tool_result';
  const isSystemRuntime = isSystemRuntimeMessage(message);
  const text = extractText(message);
  const hasText = text.trim().length > 0;
  const thinking = extractThinking(message);
  const images = extractImages(message);
  const tools = extractToolUse(message);
  const visibleThinking = showThinking ? thinking : null;
  const visibleTools = tools;

  const attachedFiles = message._attachedFiles || [];
  const [lightboxImg, setLightboxImg] = useState<{ src: string; fileName: string; filePath?: string; base64?: string; mimeType?: string } | null>(null);

  // Never render tool result messages in chat UI
  if (isToolResult || isSystemRuntime) return null;

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;
  if (!hasText && !visibleThinking && images.length === 0 && visibleTools.length === 0 && attachedFiles.length === 0 && !hasStreamingToolStatus) return null;
  const hasSecondaryContent = images.length > 0 || attachedFiles.length > 0;
  const hasProcessContent = !isUser && (hasStreamingToolStatus || !!visibleThinking || visibleTools.length > 0);
  const inlineAssistantAttachments = !isUser && attachedFiles.length > 0 && images.length === 0;

  return (
    <div
      className={cn(
        'app-chat-message-row chat-im-font group flex w-full min-w-0 gap-2',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {!isUser && (
        showAvatar ? (
          <AgentAvatar
            agentId={assistantAvatar?.id ?? 'main'}
            profile={assistantAvatar?.avatarProfile}
            size={32}
            className="mt-0.5"
          />
        ) : (
          <div data-testid="chat-assistant-avatar-placeholder" aria-hidden="true" className="mt-0.5 h-8 w-8 shrink-0" />
        )
      )}

      <div
        className={cn(
          'app-chat-message-column',
          isUser ? 'app-chat-message-column--user' : 'app-chat-message-column--assistant',
        )}
      >
        {!isUser && showAvatar && assistantAvatar?.name ? (
          <div className="app-chat-assistant-name mb-1 pl-0.5 text-[11px] font-medium tracking-[0.01em] text-muted-foreground/62">
            {assistantAvatar.name}
          </div>
        ) : null}

        {hasProcessContent && (
          <div className="app-chat-message-process">
            {isStreaming && streamingTools.length > 0 && (
              <ToolStatusBar tools={streamingTools} />
            )}

            {visibleThinking && (
              <ThinkingBlock content={visibleThinking} />
            )}

            {visibleTools.length > 0 && (
              <ToolCallGroup tools={visibleTools} />
            )}
          </div>
        )}

        {hasText && (
          <div
            className={cn(
              'app-chat-message-primary',
              isUser ? 'app-chat-message-primary--user' : 'app-chat-message-primary--assistant',
            )}
          >
            <MessageBubble
              text={text}
              isUser={isUser}
              isStreaming={isStreaming}
            />
            {inlineAssistantAttachments ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <MessageMetaBar
                  text={text}
                  timestamp={message.timestamp}
                  align="start"
                  className="mt-0 self-auto"
                />
                <AssistantAttachmentGroup
                  files={attachedFiles}
                  images={images}
                  compact
                  onPreview={({ src, fileName, filePath, mimeType }) => setLightboxImg({ src, fileName, filePath, mimeType })}
                />
              </div>
            ) : (
              <MessageMetaBar
                text={text}
                timestamp={message.timestamp}
                align={isUser ? 'end' : 'start'}
              />
            )}
          </div>
        )}

        {hasSecondaryContent && (
          <div
            className={cn(
              'app-chat-message-secondary',
              isUser ? 'app-chat-message-secondary--user' : 'app-chat-message-secondary--assistant',
            )}
          >
            {isUser && images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => {
                  const src = imageSrc(img);
                  if (!src) return null;
                  return (
                    <ImageThumbnail
                      key={`content-${i}`}
                      src={src}
                      fileName={t('message.image')}
                      base64={img.data}
                      mimeType={img.mimeType}
                      onPreview={() => setLightboxImg({ src, fileName: t('message.image'), base64: img.data, mimeType: img.mimeType })}
                    />
                  );
                })}
              </div>
            )}

            {isUser && attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, i) => {
                  const isImage = file.mimeType.startsWith('image/');
                  if (isImage && images.length > 0) return null;
                  if (isImage) {
                    return file.preview ? (
                      <ImageThumbnail
                        key={`local-${i}`}
                        src={file.preview}
                        fileName={file.fileName}
                        filePath={file.filePath}
                        mimeType={file.mimeType}
                        onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                      />
                    ) : (
                      <div
                        key={`local-${i}`}
                        className="app-field-surface flex h-36 w-36 items-center justify-center rounded-xl text-muted-foreground"
                      >
                        <File className="h-8 w-8" />
                      </div>
                    );
                  }
                  return <FileCard key={`local-${i}`} file={file} />;
                })}
              </div>
            )}

            {!isUser && images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => {
                  const src = imageSrc(img);
                  if (!src) return null;
                  return (
                    <ImagePreviewCard
                      key={`content-${i}`}
                      src={src}
                      fileName={t('message.image')}
                      base64={img.data}
                      mimeType={img.mimeType}
                      onPreview={() => setLightboxImg({ src, fileName: t('message.image'), base64: img.data, mimeType: img.mimeType })}
                    />
                  );
                })}
              </div>
            )}

            {!isUser && attachedFiles.length > 0 && !inlineAssistantAttachments && (
              <AssistantAttachmentGroup
                files={attachedFiles}
                images={images}
                onPreview={({ src, fileName, filePath, mimeType }) => setLightboxImg({ src, fileName, filePath, mimeType })}
              />
            )}
          </div>
        )}

      </div>

      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          fileName={lightboxImg.fileName}
          filePath={lightboxImg.filePath}
          base64={lightboxImg.base64}
          mimeType={lightboxImg.mimeType}
          onClose={() => setLightboxImg(null)}
        />
      )}
    </div>
  );
});

function formatDuration(durationMs?: number): string | null {
  if (!durationMs || !Number.isFinite(durationMs)) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function ToolStatusBar({
  tools,
}: {
  tools: Array<{
    id?: string;
    toolCallId?: string;
    name: string;
    status: 'running' | 'completed' | 'error';
    durationMs?: number;
    summary?: string;
  }>;
}) {
  return (
    <div className="app-chat-tool-chip-stack app-chat-secondary-block w-fit max-w-full flex flex-col gap-1.5">
      {tools.map((tool) => {
        const duration = formatDuration(tool.durationMs);
        const isRunning = tool.status === 'running';
        const isError = tool.status === 'error';
        return (
          <div
            key={tool.toolCallId || tool.id || tool.name}
            data-state={tool.status}
            className={cn(
              'app-chat-process-node app-chat-tool-chip inline-flex max-w-full items-center gap-1.5 rounded-full border border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--surface-elevated)/0.78)] px-2.5 py-1 text-[12px] leading-none shadow-none',
              isRunning && 'text-foreground',
              !isRunning && !isError && 'text-muted-foreground',
              isError && 'text-destructive',
            )}
          >
            {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
            {!isRunning && !isError && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />}
            {isError && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <span className="text-[13px] font-medium">{tool.name}</span>
            {duration && <span className="text-[11px] opacity-55">{tool.summary ? `(${duration})` : duration}</span>}
            {tool.summary && (
              <span className="app-chat-process-summary truncate text-[11px] opacity-70">{tool.summary}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Assistant hover bar (timestamp + copy, shown on group hover) ─

function MessageMetaBar({ text, timestamp, align, className }: { text: string; timestamp?: number; align: 'start' | 'end'; className?: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation(['chat', 'common']);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div
      className={cn(
        'app-chat-message-meta pointer-events-none relative z-[1] mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-[hsl(var(--border-subtle)/0.3)] bg-[hsl(var(--surface-base)/0.82)] px-2 py-0.5 opacity-0 transition-opacity duration-150 select-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        align === 'end' ? 'self-end' : 'self-start',
        className,
      )}
    >
      <span className="app-chat-meta-row text-[11px]">
        {timestamp ? formatTimestamp(timestamp) : ''}
      </span>
      {timestamp && <span className="app-chat-meta-divider" aria-hidden="true" />}
      <button
        type="button"
        className="app-chat-meta-action"
        onClick={copyContent}
        title={t('common:actions.copy')}
        aria-label={t('common:actions.copy')}
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────

function MessageBubble({
  text,
  isUser,
  isStreaming,
}: {
  text: string;
  isUser: boolean;
  isStreaming: boolean;
}) {
  return (
    <div
      className={cn(
        'relative inline-block w-fit max-w-full text-[14px] leading-[1.6]',
        isUser
          ? 'app-chat-bubble-user-v3 rounded-[18px] rounded-tr-[4px] border border-[hsl(var(--primary)/0.14)] bg-[hsl(var(--primary)/0.08)] px-[14px] py-[10px] text-foreground shadow-[0_8px_20px_rgba(15,23,42,0.04)] dark:border-[hsl(var(--primary)/0.24)] dark:bg-[hsl(var(--primary)/0.16)]'
          : 'app-chat-bubble-assistant-v3 px-0 py-0 border-transparent bg-transparent text-foreground/96 shadow-none',
      )}
      data-testid={isUser ? 'chat-user-bubble' : 'chat-assistant-bubble'}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.6]">{text}</p>
      ) : (
        <div className={cn(
          'app-chat-assistant-markdown chat-markdown prose prose-sm max-w-none break-words text-[14px] leading-[1.6] text-foreground/94 prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/88 prose-ul:text-foreground/88 prose-ol:text-foreground/88 prose-code:text-foreground prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-1 prose-pre:my-2 prose-headings:mb-2 prose-headings:mt-4',
          isStreaming && 'app-chat-streaming-content',
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match && !className;
                if (isInline) {
                  return (
                    <code className="app-chat-inline-code rounded-[4px] px-1.5 py-0.5 text-[0.9em] font-mono break-words tabular-nums" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="app-chat-code-block overflow-x-auto rounded-lg px-4 py-3 !text-[#cdd6f4]">
                    <code className={cn('text-[13px] font-mono leading-[1.6] tabular-nums', className)} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              a({ href, children }) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-primary hover:underline">
                    {children}
                  </a>
                );
              },
            }}
          >
            {text}
          </ReactMarkdown>
          {isStreaming && (
            <span data-testid="chat-streaming-indicator" className="app-chat-streaming-indicator" aria-hidden="true">
              <span className="app-chat-streaming-dot" style={{ animationDelay: '0ms' }} />
              <span className="app-chat-streaming-dot" style={{ animationDelay: '140ms' }} />
              <span className="app-chat-streaming-dot" style={{ animationDelay: '280ms' }} />
            </span>
          )}
        </div>
      )}

    </div>
  );
}

// ── Thinking Block ──────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="app-chat-thinking-card app-chat-process-rail app-chat-secondary-block w-fit max-w-full text-[14px]">
      <button
        className="app-chat-secondary-toggle app-chat-process-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="app-chat-process-dot shrink-0" aria-hidden="true" />
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium">{t('message.thinking')}</span>
      </button>
      {expanded && (
        <div className="app-chat-secondary-body">
          <div className="prose prose-sm max-w-none opacity-75 prose-headings:text-foreground prose-p:text-foreground/78 prose-strong:text-foreground prose-li:text-foreground/74 prose-ul:text-foreground/74 prose-ol:text-foreground/74 prose-code:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCallGroup({
  tools,
}: {
  tools: Array<{ id: string; name: string; input: unknown }>;
}) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="app-chat-secondary-block w-fit max-w-full">
      <button
        type="button"
        className="app-chat-secondary-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
        <span className="font-medium">
          {t('message.toolCalls', { count: tools.length })}
        </span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="app-chat-secondary-body space-y-1">
          {tools.map((tool, i) => (
            <ToolCard key={tool.id || i} name={tool.name} input={tool.input} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantAttachmentGroup({
  files,
  images,
  compact = false,
  onPreview,
}: {
  files: AttachedFileMeta[];
  images: ExtractedImage[];
  compact?: boolean;
  onPreview: (payload: { src: string; fileName: string; filePath?: string; mimeType?: string }) => void;
}) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('app-chat-secondary-block max-w-full', compact ? 'w-fit shrink-0' : 'w-fit')}>
      <button
        type="button"
        className="app-chat-secondary-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium">
          {t('message.generatedFiles', { count: files.length })}
        </span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="app-chat-secondary-body">
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => {
              const isImage = file.mimeType.startsWith('image/');
              if (isImage && images.length > 0) return null;
              if (isImage && file.preview) {
                return (
                  <ImagePreviewCard
                    key={`local-${i}`}
                    src={file.preview}
                    fileName={file.fileName}
                    filePath={file.filePath}
                    mimeType={file.mimeType}
                    onPreview={() => onPreview({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
                  />
                );
              }
              if (isImage && !file.preview) {
                return (
                  <div key={`local-${i}`} className="app-field-surface flex h-36 w-36 items-center justify-center rounded-xl text-muted-foreground">
                    <File className="h-8 w-8" />
                  </div>
                );
              }
              return <FileCard key={`local-${i}`} file={file} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Card (for user-uploaded non-image files) ───────────────

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

function FileCard({ file }: { file: AttachedFileMeta }) {
  const { t } = useTranslation('chat');
  const handleOpen = useCallback(() => {
    if (file.filePath) {
      invokeIpc('shell:openPath', file.filePath);
    }
  }, [file.filePath]);

  return (
    <div
      className={cn(
        'app-chat-file-card flex max-w-[220px] items-center gap-2 rounded-md px-3 py-2',
        file.filePath && 'cursor-default transition-colors hover:bg-[hsl(var(--foreground)/0.045)]'
      )}
      onClick={handleOpen}
      title={file.filePath ? t('message.openFile') : undefined}
    >
      <FileIcon mimeType={file.mimeType} className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-[11px] font-medium">{file.fileName}</p>
        <p className="text-[10px] text-muted-foreground/78">
          {file.fileSize > 0 ? formatFileSize(file.fileSize) : t('message.file')}
        </p>
      </div>
    </div>
  );
}

// ── Image Thumbnail (user bubble — square crop with zoom hint) ──

function ImageThumbnail({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="group/img app-chat-media-card relative max-h-[200px] max-w-[200px] cursor-zoom-in overflow-hidden rounded-md"
      onClick={onPreview}
    >
      <img
        src={src}
        alt={fileName}
        loading="lazy"
        decoding="async"
        className="block max-h-[200px] max-w-[200px] object-cover"
      />
    </div>
  );
}

// ── Image Preview Card (assistant bubble — natural size with overlay actions) ──

function ImagePreviewCard({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onPreview,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onPreview: () => void;
}) {
  void filePath; void base64; void mimeType;
  return (
    <div
      className="group/img app-chat-media-card relative max-h-[200px] max-w-[200px] cursor-zoom-in overflow-hidden rounded-md"
      onClick={onPreview}
    >
      <img src={src} alt={fileName} loading="lazy" decoding="async" className="block max-h-[200px] max-w-[200px] object-cover" />
    </div>
  );
}

// ── Image Lightbox ───────────────────────────────────────────────

function ImageLightbox({
  src,
  fileName,
  filePath,
  base64,
  mimeType,
  onClose,
}: {
  src: string;
  fileName: string;
  filePath?: string;
  base64?: string;
  mimeType?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(['chat', 'common']);
  void src; void base64; void mimeType; void fileName;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleShowInFolder = useCallback(() => {
    if (filePath) {
      invokeIpc('shell:showItemInFolder', filePath);
    }
  }, [filePath]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/78"
      onClick={onClose}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={fileName}
          className="max-h-[85vh] max-w-[90vw] rounded-xl border border-border/60 bg-background/96 object-contain shadow-2xl"
        />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {filePath && (
            <Button
              variant="ghost"
              size="icon"
              className="app-chat-image-action h-8 w-8 text-foreground"
              onClick={handleShowInFolder}
              title={t('message.showInFolder')}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="app-chat-image-action h-8 w-8 text-foreground"
            onClick={onClose}
            title={t('common:actions.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Tool Card ───────────────────────────────────────────────────

function ToolCard({ name, input }: { name: string; input: unknown }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="app-chat-tool-card app-chat-secondary-block w-fit max-w-full text-[14px]">
      <button
        className="app-chat-secondary-toggle flex items-center gap-1.5 rounded-full px-2.5 h-7 bg-[hsl(var(--surface-hover))] transition-colors w-fit border-transparent shadow-none"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
        <span className="text-[12.5px] font-medium">{name}</span>
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {expanded && input != null && (
        <pre className="app-chat-secondary-body overflow-x-auto rounded-lg border border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-base))] p-3 text-[12px] text-muted-foreground font-mono tabular-nums">
          {typeof input === 'string' ? input : JSON.stringify(input, null, 2) as string}
        </pre>
      )}
    </div>
  );
}
