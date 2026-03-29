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
    expect(messageSource).toContain('app-chat-process-row');
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
    expect(messageSource).toContain('app-chat-process-row');
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
    expect(messageSource).toContain('app-chat-process-timeline');
    expect(messageSource).toContain('app-chat-process-row');
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
    expect(messageSource).toContain('app-chat-process-row');
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
    const titlebarSource = readFileSync(resolve(process.cwd(), 'src/components/layout/TitleBar.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(layoutSource).toContain('--app-global-chat-stage-opacity');
    expect(layoutSource).toContain('--app-global-chat-composer-opacity');
    expect(layoutSource).toContain("data-shell-route={isChatSurfaceRoute ? 'chat' : 'workspace'}");
    expect(titlebarSource).toContain('desktop-app-titlebar-main-surface');
    expect(titlebarSource).toContain('desktop-app-titlebar-sidebar-slot--chat');
    expect(themeSource).toContain(".desktop-app-shell[data-shell-route='chat'] .desktop-app-shell-material-layer {");
    expect(themeSource).toContain('.desktop-app-shell .app-chat-main-stage::before {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-composer-surface,');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-message-meta {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-secondary-toggle {');
  });

  it('keeps the chat reading plane as a seamless veil instead of an inset glass card', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain('.desktop-app-shell .app-chat-main-stage::before {');
    expect(themeSource).not.toContain('inset: -3rem 0.4rem 0.32rem;');
    expect(themeSource).not.toContain('border-radius: 0 0 24px 24px;');
    expect(themeSource).not.toContain('backdrop-filter: saturate(124%) blur(18px);');
    expect(themeSource).not.toContain('-webkit-backdrop-filter: saturate(124%) blur(18px);');
  });

  it('keeps the main reading plane brighter than the source list without turning it into a white card', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain(".desktop-app-shell[data-shell-route='chat'] .desktop-app-chat-nav-shell,");
    expect(themeSource).toContain('linear-gradient(180deg, rgb(244 244 245 / 0.9) 0%, rgb(240 241 243 / 0.82) 100%)');
    expect(themeSource).toContain(".desktop-app-shell[data-shell-route='chat'] .desktop-app-titlebar-main-surface,");
    expect(themeSource).toContain('linear-gradient(180deg, rgb(255 255 255 / 0.92) 0%, rgb(250 250 251 / 0.84) 100%)');
    expect(themeSource).toContain(".desktop-app-shell[data-shell-route='chat'] .app-chat-main-stage::before {");
    expect(themeSource).toContain('linear-gradient(180deg, rgb(255 255 255 / 0.58) 0%, rgb(251 251 252 / 0.48) 100%)');
    expect(themeSource).not.toContain('rgb(255 176 177 / 0.03)');
    expect(themeSource).not.toContain('rgb(255 176 177 / 0.035)');
    expect(themeSource).not.toContain('rgb(255 251 249 / 0.82)');
    expect(themeSource).not.toContain('rgb(255 251 249 / 0.46)');
    expect(themeSource).not.toContain('background: hsl(var(--background) / 0.96);');
  });

  it('keeps wallpaper visibility alive on the chat route instead of covering it with fixed white slabs', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain(".desktop-app-shell--wallpaper[data-shell-route='chat'] .desktop-app-chat-nav-shell,");
    expect(themeSource).toContain(".desktop-app-shell--wallpaper[data-shell-route='chat'] .desktop-app-titlebar-main-surface,");
    expect(themeSource).toContain(".desktop-app-shell--wallpaper[data-shell-route='chat'] .app-chat-main-stage::before {");
    expect(themeSource).toContain(".desktop-app-shell--wallpaper[data-shell-route='chat'] .app-chat-composer-surface,");
  });

  it('keeps the composer closer to the reading flow instead of a heavy blurred console dock', () => {
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).toContain('dark:text-black');
    expect(inputSource).toContain('dark:caret-black');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-composer-surface,');
    expect(themeSource).not.toContain('backdrop-filter: saturate(132%) blur(22px);');
    expect(themeSource).not.toContain('-webkit-backdrop-filter: saturate(132%) blur(22px);');
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

  it('keeps heavy containment only on truly heavy media and code surfaces, not on the process rail itself', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain('.app-chat-message-secondary');
    expect(themeSource).toContain('.app-chat-secondary-block');
    expect(themeSource).toContain('.app-chat-media-card');
    expect(themeSource).toContain('.app-chat-file-card');
    expect(themeSource).toContain('.app-chat-code-block');
    expect(themeSource).toContain('contain-intrinsic-size: 0 144px;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 56px;');
    expect(themeSource).toContain('contain-intrinsic-size: 0 140px;');
    expect(themeSource).not.toContain('.app-chat-message-secondary {\n  display: flex;\n  min-width: 0;\n  width: 100%;\n  flex-direction: column;\n  gap: 0.34rem;\n  content-visibility: auto;');
    expect(themeSource).not.toContain('.app-chat-secondary-block {\n  width: 100%;\n  content-visibility: auto;');
  });

  it('keeps desktop process chrome lightweight instead of stacking glass blur on every message affordance', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(themeSource).toContain('.desktop-app-shell .app-chat-message-meta {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-secondary-toggle {');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-tool-chip,');
    expect(themeSource).not.toContain('.desktop-app-shell .app-chat-message-meta {\n  background:\n    linear-gradient(');
    expect(themeSource).not.toContain('.desktop-app-shell .app-chat-secondary-toggle {\n  border-color: hsl(var(--chrome-divider) / 0.46);\n  background:\n    linear-gradient(');
    expect(themeSource).not.toContain('.desktop-app-shell .app-chat-message-meta {\n  background:\n    linear-gradient(\n      180deg,');
    expect(themeSource).not.toContain('backdrop-filter: saturate(124%) blur(14px);');
    expect(themeSource).not.toContain('-webkit-backdrop-filter: saturate(124%) blur(14px);');
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
