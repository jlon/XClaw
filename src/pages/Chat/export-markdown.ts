import type { RawMessage } from '@/stores/chat';
import {
  extractText,
  extractThinking,
  extractToolUse,
  isSystemRuntimeMessage,
} from './message-utils';

type BuildChatMarkdownOptions = {
  assistantName: string;
  messages: RawMessage[];
  title: string;
};

const sanitizeMarkdownText = (value: string) => value.replace(/\r\n?/g, '\n').trim();

export function buildChatMarkdown({
  assistantName,
  messages,
  title,
}: BuildChatMarkdownOptions): string {
  const lines = [`# ${title}`, '', `Exported: ${new Date().toISOString()}`, ''];

  for (const message of messages) {
    if (isSystemRuntimeMessage(message)) {
      continue;
    }
    const role = typeof message.role === 'string' ? message.role.toLowerCase() : '';
    if (role === 'toolresult' || role === 'tool_result') {
      continue;
    }
    const label = role === 'user' ? 'User' : assistantName || 'Assistant';
    const text = sanitizeMarkdownText(extractText(message));
    const thinking = sanitizeMarkdownText(extractThinking(message) ?? '');
    const tools = extractToolUse(message);

    if (!text && !thinking && tools.length === 0) {
      continue;
    }

    lines.push(`## ${label}`);
    lines.push('');

    if (text) {
      lines.push(text);
      lines.push('');
    }

    if (thinking) {
      lines.push('### Thinking');
      lines.push('');
      lines.push(thinking);
      lines.push('');
    }

    if (tools.length > 0) {
      lines.push('### Tools');
      lines.push('');
      for (const tool of tools) {
        lines.push(`- ${tool.name}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

export function buildChatExportFileName(title: string): string {
  const normalized = [...title.trim()]
    .map((char) => {
      const code = char.charCodeAt(0);
      if ('<>:"/\\|?*'.includes(char) || code < 32) {
        return '-';
      }
      return char;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return `${normalized || 'chat-export'}.md`;
}
