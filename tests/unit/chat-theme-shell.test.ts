import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat desktop shell theme', () => {
  it('marks chat page with a dedicated desktop workspace shell and branded welcome hero', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');

    expect(source).toContain('app-chat-shell');
    expect(source).toContain('app-chat-welcome-hero');
    expect(source).toContain('data-testid="chat-welcome-hero"');
  });

  it('keeps the header minimal and limits desktop-grade surfaces to tools and composer', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const toolbarSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatToolbar.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-header-meta');
    expect(pageSource).not.toContain('app-chat-meta-pill');
    expect(toolbarSource).toContain('app-chat-toolbar-group');
    expect(toolbarSource).toContain('app-chat-connection-indicator');
    expect(toolbarSource).toContain('status-indicator-glow');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).not.toContain('app-chat-connection-indicator');
  });

  it('defines dedicated chat shell classes in the global theme layer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(source).toContain('.app-chat-shell');
    expect(source).toContain('.app-chat-welcome-hero');
    expect(source).toContain('.app-chat-header-meta');
    expect(source).toContain('.app-chat-toolbar-group');
    expect(source).toContain('.app-chat-composer-dock');
    expect(source).toContain('.app-chat-connection-indicator');
  });

  it('moves the message plane onto dedicated desktop-grade thread and bubble surfaces', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(pageSource).toContain('app-chat-thread-stage');
    expect(messageSource).toContain('app-chat-bubble-assistant');
    expect(messageSource).toContain('app-chat-bubble-user');
    expect(messageSource).toContain('app-chat-thinking-card');
    expect(messageSource).toContain('app-chat-tool-card');
    expect(messageSource).toContain('app-chat-file-card');
    expect(themeSource).toContain('.app-chat-thread-stage');
    expect(themeSource).toContain('.app-chat-bubble-assistant');
    expect(themeSource).toContain('.app-chat-bubble-user');
    expect(themeSource).toContain('.app-chat-thinking-card');
    expect(themeSource).toContain('.app-chat-tool-card');
    expect(themeSource).toContain('.app-chat-file-card');
  });

  it('keeps chat message affordances inside existing i18n namespaces instead of hardcoded English copy', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');
    const zhLocale = readFileSync(resolve(process.cwd(), 'src/i18n/locales/zh/chat.json'), 'utf8');

    expect(pageSource).toContain("t('message.toolProcessing')");
    expect(messageSource).toContain("t('message.thinking')");
    expect(messageSource).toContain("t('message.showInFolder')");
    expect(messageSource).toContain("t('message.openFile')");
    expect(messageSource).toContain("t('message.file')");
    expect(inputSource).toContain("t('common:status.error')");
    expect(zhLocale).toContain('"message"');
    expect(zhLocale).toContain('"toolProcessing"');
  });
});
