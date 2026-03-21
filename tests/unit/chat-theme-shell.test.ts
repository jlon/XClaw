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

  it('keeps the composer aligned with the chat workbench width and uses a taller dock rhythm', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-workbench');
    expect(inputSource).toContain('app-chat-workbench');
    expect(themeSource).toContain('.app-chat-workbench');
    expect(inputSource).toContain('app-chat-composer-editor');
    expect(inputSource).toContain('app-chat-composer-footer');
    expect(themeSource).toContain('.app-chat-composer-editor');
    expect(themeSource).toContain('.app-chat-composer-footer');
    expect(inputSource).toContain("min-h-[88px]");
    expect(inputSource).toContain("min-h-[72px]");
    expect(inputSource).not.toContain("'h-[52px] w-[52px]");
    expect(inputSource).toContain('absolute inset-x-4 bottom-4');
    expect(inputSource).toContain('app-chat-composer-tool-button');
    expect(themeSource).toContain('.app-chat-composer-tool-button');
    expect(themeSource).toContain('overflow: visible;');
    expect(themeSource).not.toContain('.app-chat-composer-tools {\n  display: flex;\n  min-width: 0;\n  flex-wrap: nowrap;\n  align-items: center;\n  gap: 0.375rem;\n  overflow: hidden;');
  });

  it('defines dedicated chat shell classes in the global theme layer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(source).toContain('.app-chat-shell');
    expect(source).toContain('.app-chat-welcome-hero');
    expect(source).toContain('.app-chat-header-meta');
    expect(source).toContain('.app-chat-toolbar-group');
    expect(source).toContain('.app-chat-composer-dock');
    expect(source).toContain('.app-chat-composer-editor');
    expect(source).toContain('.app-chat-composer-footer');
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

  it('keeps runtime typing pills separate from tool status rails so loading bubbles stay visually complete', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(pageSource).toContain('app-chat-runtime-pill');
    expect(themeSource).toContain('.app-chat-runtime-pill');
    expect(pageSource).not.toContain('app-chat-tool-status w-fit rounded-[14px] px-3 py-2 text-foreground');
  });

  it('uses a lighter first-paint scroll strategy instead of hiding the chat scroller before reveal', () => {
    const hookSource = readFileSync(resolve(process.cwd(), 'src/hooks/use-stick-to-bottom-instant.ts'), 'utf8');

    expect(hookSource).toContain('initial: "instant"');
    expect(hookSource).toContain('resize: "instant"');
    expect(hookSource).not.toContain('style.visibility = "hidden"');
    expect(hookSource).not.toContain('requestAnimationFrame(() => {\n      requestAnimationFrame(() => {');
  });

  it('moves chat rows onto a unified message column and secondary rail instead of hardcoded split widths', () => {
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(messageSource).toContain('app-chat-message-column');
    expect(messageSource).toContain('app-chat-message-secondary');
    expect(messageSource).not.toContain("max-w-[70%] md:max-w-[62%]");
    expect(messageSource).not.toContain("max-w-[min(76%,40rem)]");
    expect(themeSource).toContain('.app-chat-message-column');
    expect(themeSource).toContain('.app-chat-message-secondary');
  });

  it('isolates heavy chat secondary blocks and code blocks with content visibility hints', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain('.app-chat-message-secondary');
    expect(themeSource).toContain('.app-chat-secondary-block');
    expect(themeSource).toContain('.app-chat-media-card');
    expect(themeSource).toContain('.app-chat-file-card');
    expect(themeSource).toContain('.app-chat-code-block');
    expect(themeSource).toContain('content-visibility: auto;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 120px;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 144px;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 56px;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 140px;');
  });

  it('anchors chat errors near the composer instead of using a full-width destructive banner', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const zhLocale = readFileSync(resolve(process.cwd(), 'src/i18n/locales/zh/chat.json'), 'utf8');

    expect(pageSource).toContain('app-chat-composer-error');
    expect(themeSource).toContain('.app-chat-composer-error');
    expect(pageSource).not.toContain("px-4 py-2 bg-destructive/10 border-t border-destructive/20");
    expect(zhLocale).toContain('"errors"');
    expect(zhLocale).toContain('"requestTimeout"');
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
