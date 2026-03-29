import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat desktop shell theme', () => {
  it('marks chat page with a single main scroll layer and docked footer editor', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');

    expect(source).toContain('app-chat-workspace-shell');
    expect(source).toContain('app-chat-main-stage');
    expect(source).toContain('app-chat-thread-flow');
    expect(source).toContain('app-chat-workspace-frame');
    expect(source).not.toContain('app-chat-thread-stage');
    expect(source).not.toContain('app-chat-workbench');
    expect(source).not.toContain('app-chat-thread-canvas');
    expect(source).not.toContain('mx-auto');
    expect(source).not.toContain('max-w-[1000px]');
    expect(inputSource).toContain('app-chat-composer-shell');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).toContain('app-chat-composer-editor');
    expect(inputSource).toContain('app-chat-composer-footer');
    expect(inputSource).not.toContain('app-chat-composer-surface');
    expect(inputSource).not.toContain('absolute inset-x-4 bottom-3.5 pointer-events-none');
    expect(messageSource).toContain('app-chat-message-meta');
    expect(messageSource).toContain('app-chat-tool-chip');
    expect(messageSource).toContain('app-chat-bubble-user-v3');
    expect(messageSource).toContain('app-chat-bubble-assistant-v3');
  });

  it('keeps the header minimal and avoids centered workbench wrappers', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');

    expect(pageSource).not.toContain('app-chat-welcome-agent');
    expect(pageSource).toContain('app-chat-workspace-shell');
    expect(pageSource).toContain('app-chat-workspace-frame');
    expect(pageSource).not.toContain('app-chat-thread-stage');
    expect(inputSource).toContain('app-chat-composer-shell');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).not.toContain('app-chat-composer-surface');
  });

  it('uses a fluid workspace shell instead of a centered workbench and card dock rhythm', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-workspace-shell');
    expect(pageSource).toContain('app-chat-thread-flow');
    expect(inputSource).toContain('app-chat-composer-shell');
    expect(inputSource).toContain('app-chat-composer-editor');
    expect(inputSource).toContain('app-chat-composer-footer');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(pageSource).not.toContain('mx-auto');
    expect(pageSource).not.toContain('max-w-[1000px]');
    expect(pageSource).not.toContain('app-chat-workbench');
    expect(pageSource).not.toContain('app-chat-thread-canvas');
  });

  it('defines the desktop chat shell hooks in the source files', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-workspace-shell');
    expect(pageSource).toContain('app-chat-main-stage');
    expect(pageSource).toContain('app-chat-thread-flow');
    expect(inputSource).toContain('app-chat-composer-shell');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).toContain('app-chat-composer-editor');
    expect(inputSource).toContain('app-chat-composer-footer');
    expect(messageSource).toContain('app-chat-bubble-user-v3');
    expect(messageSource).toContain('app-chat-bubble-assistant-v3');
    expect(messageSource).toContain('app-chat-message-meta');
    expect(messageSource).toContain('app-chat-tool-chip');
    expect(pageSource).not.toContain('app-chat-workbench');
    expect(pageSource).not.toContain('app-chat-thread-canvas');
    expect(inputSource).not.toContain('app-chat-composer-surface');
    expect(messageSource).not.toContain('app-chat-bubble-user rounded');
    expect(messageSource).not.toContain('app-chat-bubble-assistant rounded');
  });

  it('moves the message plane onto dedicated desktop-grade thread and bubble surfaces', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-main-stage');
    expect(pageSource).toContain('app-chat-thread-flow');
    expect(messageSource).toContain('app-chat-bubble-assistant-v3');
    expect(messageSource).toContain('app-chat-bubble-user-v3');
    expect(messageSource).toContain('app-chat-message-meta');
    expect(messageSource).toContain('app-chat-tool-chip');
    expect(messageSource).toContain('app-chat-thinking-card');
    expect(messageSource).toContain('app-chat-message-primary');
    expect(messageSource).toContain('app-chat-message-secondary');
    expect(messageSource).toContain('app-chat-secondary-toggle');
  });

  it('keeps assistant messages document-like on a neutral reading plane while user replies stay softly tinted', () => {
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(messageSource).toContain("data-testid={isUser ? 'chat-user-bubble' : 'chat-assistant-bubble'}");
    expect(messageSource).toContain("app-chat-bubble-user-v3 rounded-[18px] rounded-tr-[4px]");
    expect(messageSource).toContain(": 'app-chat-bubble-assistant-v3 px-0 py-0 border-transparent bg-transparent text-foreground/96 shadow-none'");
    expect(messageSource).not.toContain("app-chat-bubble-assistant-v3 rounded-[18px] rounded-tl-[4px]");
    expect(themeSource).toContain('.desktop-app-shell .app-chat-main-stage::before {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-bubble-assistant-v3 {');
    expect(messageSource).not.toContain('app-chat-bubble-user rounded');
    expect(messageSource).not.toContain('app-chat-bubble-assistant rounded');
  });

  it('keeps runtime typing bubbles separate from tool status rails so loading rows stay visually complete', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-typing-bubble');
    expect(messageSource).toContain('app-chat-tool-chip');
    expect(messageSource).not.toContain('app-chat-tool-status w-fit rounded-md px-3 py-2 text-foreground');
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
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');

    expect(messageSource).toContain('app-chat-message-column');
    expect(messageSource).toContain('app-chat-message-primary');
    expect(messageSource).toContain('app-chat-message-secondary');
    expect(messageSource).not.toContain("max-w-[70%] md:max-w-[62%]");
    expect(messageSource).not.toContain("max-w-[min(76%,40rem)]");
    expect(pageSource).toContain('stackSpacingClass');
    expect(pageSource).toContain('isClusteredWithPrevious');
    expect(pageSource).toContain('nextAssistantSpacingClass');
    expect(themeSource).toContain('.app-chat-message-column');
    expect(themeSource).toContain('.app-chat-message-primary');
    expect(themeSource).toContain('.app-chat-message-secondary');
  });

  it('keeps chat media on QClaw-style natural previews instead of forcing square thumbnails', () => {
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');

    expect(messageSource).toContain("group/img app-chat-media-card relative max-h-[200px] max-w-[200px] cursor-zoom-in overflow-hidden rounded-md");
    expect(messageSource).toContain("className=\"block max-h-[200px] max-w-[200px] object-cover\"");
    expect(messageSource).not.toContain("group/img app-chat-media-card relative h-32 w-32");
  });

  it('adds a dedicated chat reading plane and calmer chrome instead of reusing workbench glass directly', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(layoutSource).toContain('--app-global-chat-stage-opacity');
    expect(layoutSource).toContain('--app-global-chat-composer-opacity');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-main-stage::before {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-composer-surface,');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-message-meta {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-secondary-toggle {');
  });

  it('keeps fallback typing and tool-processing indicators on assistant message rows instead of toolbar pills', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(pageSource).toContain('app-chat-typing-row');
    expect(pageSource).toContain('app-chat-typing-bubble');
    expect(themeSource).toContain('.app-chat-typing-bubble');
    expect(themeSource).toContain('.app-chat-typing-indicator');
    expect(themeSource).toContain('.app-chat-typing-status');
    expect(pageSource).not.toContain('app-chat-runtime-pill w-fit rounded-md px-3 py-2 text-foreground');
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
