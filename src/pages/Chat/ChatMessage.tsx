/**
 * Chat Message Component
 * Renders user / assistant / system / toolresult messages
 * with markdown, thinking sections, images, and tool cards.
 */
import { useState, useCallback, useEffect, memo } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, FileText, Film, Music, FileArchive, File, X, FolderOpen, Loader2, CheckCircle2, AlertCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);

  // Never render tool result messages in chat UI
  if (isToolResult || isSystemRuntime) return null;

  const hasStreamingToolStatus = isStreaming && streamingTools.length > 0;
  if (!hasText && !visibleThinking && images.length === 0 && visibleTools.length === 0 && attachedFiles.length === 0 && !hasStreamingToolStatus) return null;
  const hasSecondaryContent = images.length > 0 || attachedFiles.length > 0;
  const hasProcessContent = !isUser && (hasStreamingToolStatus || !!visibleThinking || visibleTools.length > 0);

  return (
    <div
      className={cn(
        'app-chat-message-row chat-im-font group flex w-full min-w-0 gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {!isUser && (
        showAvatar ? (
          <AgentAvatar
            agentId={assistantAvatar?.id ?? 'main'}
            profile={assistantAvatar?.avatarProfile}
            size={34}
            className="mt-0.5"
          />
        ) : (
          <div data-testid="chat-assistant-avatar-placeholder" aria-hidden="true" className="mt-0.5 h-[34px] w-[34px] shrink-0" />
        )
      )}

      <div
        className={cn(
          'app-chat-message-column',
          isUser ? 'app-chat-message-column--user' : 'app-chat-message-column--assistant',
        )}
      >
        {hasProcessContent && (
          <div className="app-chat-message-process">
            {isStreaming && streamingTools.length > 0 && (
              <ToolStatusBar tools={streamingTools} />
            )}

            {visibleThinking && (
              <ThinkingBlock content={visibleThinking} />
            )}

            {visibleTools.length > 0 && (
              <div className="space-y-1">
                {visibleTools.map((tool, i) => (
                  <ToolCard key={tool.id || i} name={tool.name} input={tool.input} />
                ))}
              </div>
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
            <MessageMetaBar
              text={text}
              timestamp={message.timestamp}
              align={isUser ? 'end' : 'start'}
            />
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

            {!isUser && attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, i) => {
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
                        onPreview={() => setLightboxImg({ src: file.preview!, fileName: file.fileName, filePath: file.filePath, mimeType: file.mimeType })}
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
            )}
          </div>
        )}

        {!isUser && hasText && (
          <AssistantFeedbackRail
            value={feedback}
            onChange={setFeedback}
          />
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
    <div className="app-chat-process-rail app-chat-secondary-block w-full">
      {tools.map((tool) => {
        const duration = formatDuration(tool.durationMs);
        const isRunning = tool.status === 'running';
        const isError = tool.status === 'error';
        return (
          <div
            key={tool.toolCallId || tool.id || tool.name}
            data-state={tool.status}
            className={cn(
              'app-chat-process-node app-chat-tool-status flex items-center gap-1.5 rounded-[12px] px-2 py-1 text-xs transition-colors',
              isRunning && 'text-foreground',
              !isRunning && !isError && 'text-muted-foreground',
              isError && 'text-destructive',
            )}
          >
            <span className="app-chat-process-dot shrink-0" aria-hidden="true" />
            {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
            {!isRunning && !isError && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />}
            {isError && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <span className="text-[11.5px] font-medium">{tool.name}</span>
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

function MessageMetaBar({ text, timestamp, align }: { text: string; timestamp?: number; align: 'start' | 'end' }) {
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
        'app-chat-hoverbar app-chat-hoverbar--floating pointer-events-none relative z-[1] mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 opacity-0 transition-[opacity,transform] duration-200 translate-y-1 select-none group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100',
        align === 'end' ? 'self-end' : 'self-start',
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
        'relative max-w-full text-[14px] leading-[1.6]',
        isUser
          ? 'app-chat-bubble-user rounded-[12px] rounded-br-[4px] border px-4 py-3'
          : 'app-chat-bubble-assistant rounded-[12px] rounded-bl-[4px] px-0 py-0 text-foreground',
      )}
      data-testid={isUser ? 'chat-user-bubble' : 'chat-assistant-bubble'}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.6]">{text}</p>
      ) : (
        <div className={cn(
          'prose prose-sm max-w-none break-words text-[14px] leading-[1.6] text-foreground/94 prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/88 prose-ul:text-foreground/88 prose-ol:text-foreground/88 prose-code:text-foreground prose-p:my-2 prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-pre:my-2.5 prose-headings:mb-2 prose-headings:mt-4',
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
                    <code className="app-chat-inline-code rounded-[8px] px-1.5 py-0.5 text-[13px] font-mono break-words" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="app-chat-code-block overflow-x-auto rounded-[14px] px-3.5 py-2.5">
                    <code className={cn('text-[13px] font-mono leading-6', className)} {...props}>
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

function AssistantFeedbackRail({
  value,
  onChange,
}: {
  value: 'helpful' | 'not_helpful' | null;
  onChange: (next: 'helpful' | 'not_helpful' | null) => void;
}) {
  const { t } = useTranslation(['chat', 'common']);
  const [draft, setDraft] = useState('');
  const isPanelOpen = value === 'not_helpful';

  return (
    <div className="app-chat-feedback">
      <div className="app-chat-feedback-actions">
        <button
          type="button"
          className="app-chat-feedback-button"
          aria-label={t('message.feedbackHelpful')}
          title={t('message.feedbackHelpful')}
          aria-pressed={value === 'helpful'}
          data-active={value === 'helpful'}
          onClick={() => {
            setDraft('');
            onChange(value === 'helpful' ? null : 'helpful');
          }}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="app-chat-feedback-button"
          aria-label={t('message.feedbackNotHelpful')}
          title={t('message.feedbackNotHelpful')}
          aria-pressed={value === 'not_helpful'}
          data-active={value === 'not_helpful'}
          onClick={() => {
            if (value === 'not_helpful') setDraft('');
            onChange(value === 'not_helpful' ? null : 'not_helpful');
          }}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {isPanelOpen && (
        <div className="app-chat-feedback-panel">
          <div className="app-chat-feedback-panel-header">
            <p className="app-chat-feedback-panel-title">{t('message.feedbackPanelTitle')}</p>
            <button
              type="button"
              className="app-chat-feedback-panel-close"
              aria-label={t('common:actions.close')}
              title={t('common:actions.close')}
              onClick={() => {
                setDraft('');
                onChange(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="app-chat-feedback-input-row">
            <label className="app-chat-feedback-input-wrapper">
              <input
                type="text"
                className="app-chat-feedback-input"
                placeholder={t('message.feedbackPlaceholder')}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="app-chat-feedback-submit"
              disabled={!draft.trim()}
              onClick={() => {
                if (!draft.trim()) return;
                setDraft('');
                onChange(null);
              }}
            >
              {t('message.feedbackSubmit')}
            </button>
          </div>
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
    <div className="app-chat-thinking-card app-chat-process-rail app-chat-secondary-block w-full text-[14px]">
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
        'app-chat-file-card flex max-w-[220px] items-center gap-2 rounded-[11px] px-3 py-2',
        file.filePath && 'cursor-pointer transition-colors hover:bg-[hsl(var(--foreground)/0.045)]'
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
      className="group/img app-chat-media-card relative max-h-[200px] max-w-[200px] cursor-zoom-in overflow-hidden rounded-[8px]"
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
      className="group/img app-chat-media-card relative max-h-[200px] max-w-[200px] cursor-zoom-in overflow-hidden rounded-[8px]"
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
          className="max-h-[85vh] max-w-[90vw] rounded-[18px] border border-border/60 bg-background/96 object-contain shadow-2xl"
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
    <div className="app-chat-tool-card app-chat-secondary-block text-[14px]">
      <button
        className="app-chat-secondary-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
        <span className="text-xs font-medium">{name}</span>
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>
      {expanded && input != null && (
        <pre className="app-chat-secondary-body overflow-x-auto text-xs text-muted-foreground">
          {typeof input === 'string' ? input : JSON.stringify(input, null, 2) as string}
        </pre>
      )}
    </div>
  );
}
