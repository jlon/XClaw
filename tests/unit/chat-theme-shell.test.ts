import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('chat desktop shell theme', () => {
  it('marks chat page with a dedicated desktop workspace shell and branded welcome hero', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const wordmarkSource = readFileSync(resolve(process.cwd(), 'src/components/common/XClawWelcomeWordmark.tsx'), 'utf8');

    expect(source).toContain('app-chat-shell');
    expect(source).toContain('app-chat-welcome-hero');
    expect(source).toContain('app-chat-welcome-stage');
    expect(source).toContain('app-chat-welcome-logo-shell');
    expect(source).toContain('XClawWelcomeWordmark');
    expect(source).toContain('data-testid="chat-welcome-wordmark"');
    expect(wordmarkSource).toContain('xclaw-wordmark-mask.png');
    expect(wordmarkSource).toContain('app-chat-welcome-wordmark-mark');
    expect(source).toContain('app-chat-welcome-tagline');
    expect(source).toContain('app-chat-welcome-actions');
    expect(source).toContain('app-chat-welcome-card');
    expect(source).toContain('app-chat-welcome-card-art');
    expect(source).toContain('app-chat-welcome-card--execution');
    expect(source).toContain('app-chat-welcome-card--integration');
    expect(source).toContain('app-chat-openclaw-atmosphere');
    expect(source).toContain('app-chat-openclaw-stars');
    expect(source).toContain('app-chat-openclaw-nebula');
    expect(source).toContain('app-chat-openclaw-lobster-icon');
    expect(source).toContain('app-chat-openclaw-claw-left');
    expect(source).toContain('app-chat-openclaw-claw-right');
    expect(source).toContain('app-chat-openclaw-eye-glow');
    expect(source).toContain('app-chat-openclaw-antenna');
    expect(source).toContain('data-testid="chat-welcome-hero"');
  });

  it('keeps the header minimal and limits desktop-grade surfaces to tools and composer', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const toolbarSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatToolbar.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');

    expect(pageSource).toContain('app-chat-header-meta');
    expect(pageSource).not.toContain('app-chat-welcome-agent');
    expect(pageSource).not.toContain('app-chat-meta-pill');
    expect(toolbarSource).toContain('app-chat-toolbar-group');
    expect(toolbarSource).toContain('app-chat-connection-indicator');
    expect(toolbarSource).toContain('app-chat-runtime-pill');
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
    expect(inputSource).toContain("min-h-[82px]");
    expect(inputSource).toContain("min-h-[68px]");
    expect(inputSource).not.toContain("'h-[52px] w-[52px]");
    expect(inputSource).toContain('absolute inset-x-4 bottom-3.5');
    expect(inputSource).toContain('app-chat-composer-tool-button');
    expect(inputSource).toContain('app-chat-picker-surface');
    expect(inputSource).toContain('app-chat-picker-search-input');
    expect(themeSource).toContain('.app-chat-composer-tool-button');
    expect(themeSource).toContain('.app-chat-picker-surface');
    expect(themeSource).toContain('.app-chat-picker-search');
    expect(themeSource).toContain('overflow: visible;');
    expect(themeSource).not.toContain('.app-chat-composer-tools {\n  display: flex;\n  min-width: 0;\n  flex-wrap: nowrap;\n  align-items: center;\n  gap: 0.375rem;\n  overflow: hidden;');
    expect(inputSource).not.toContain("import { Input } from '@/components/ui/input';");
  });

  it('defines dedicated chat shell classes in the global theme layer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(source).toContain('.app-chat-shell');
    expect(source).toContain('.app-chat-welcome-hero');
    expect(source).toContain('.app-chat-welcome-stage');
    expect(source).toContain('.app-chat-welcome-logo-shell');
    expect(source).toContain('.app-chat-welcome-title');
    expect(source).toContain('.app-chat-welcome-wordmark-mark');
    expect(source).toContain('width: min(100%, clamp(10rem, 18vw, 12.2rem));');
    expect(source).toContain('.app-chat-welcome-tagline');
    expect(source).toContain('.app-chat-welcome-actions');
    expect(source).toContain('.app-chat-welcome-card');
    expect(source).toContain('.app-chat-welcome-card-art');
    expect(source).toContain('.app-chat-welcome-card--execution');
    expect(source).toContain('.app-chat-welcome-card--integration');
    expect(source).toContain('.app-chat-openclaw-atmosphere');
    expect(source).toContain('.app-chat-openclaw-stars');
    expect(source).toContain('.app-chat-openclaw-nebula');
    expect(source).toContain('.app-chat-openclaw-lobster-icon');
    expect(source).toContain('.app-chat-openclaw-lobster-svg');
    expect(source).toContain('.app-chat-openclaw-eye-glow');
    expect(source).toContain('.app-chat-openclaw-antenna');
    expect(source).toContain('.app-chat-openclaw-claw-left');
    expect(source).toContain('.app-chat-openclaw-claw-right');
    expect(source).toContain('.app-chat-openclaw-lobster-icon::after');
    expect(source).toContain('perspective: 720px;');
    expect(source).toContain('transform-style: preserve-3d;');
    expect(source).toContain('@keyframes app-chat-openclaw-float');
    expect(source).toContain('@keyframes app-chat-openclaw-performance');
    expect(source).toContain('@keyframes app-chat-openclaw-shadow-drift');
    expect(source).toContain('@keyframes app-chat-openclaw-blink');
    expect(source).toContain('@keyframes app-chat-openclaw-wiggle');
    expect(source).toContain('@keyframes app-chat-openclaw-claw-snap');
    expect(source).toContain('.app-chat-openclaw-atmosphere::before');
    expect(source).not.toContain('aspect-ratio: 718 / 285;');
    expect(source).toContain('gap: 0.82rem;');
    expect(source).toContain('gap: 1.18rem;');
    expect(source).toContain('gap: 0.84rem;');
    expect(source).toContain('font-family: var(--font-display);');
    expect(source).toContain('width: clamp(7.2rem, 13.4vw, 9.3rem);');
    expect(source).toContain('height: clamp(6rem, 10.2vw, 7.5rem);');
    expect(source).toContain('border-radius: 1.15rem;');
    expect(source).toContain('min-height: 12rem;');
    expect(source).toContain('height: 6rem;');
    expect(source).toContain('drop-shadow(0 0 20px rgb(255 77 77 / 0.4))');
    expect(source).toContain('drop-shadow(0 0 30px rgb(0 229 204 / 0.6))');
    expect(source).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(source).toContain('.app-chat-welcome-actions {\n  display: grid;');
    expect(source).toContain('.app-chat-header-meta');
    expect(source).toContain('.app-chat-toolbar-group');
    expect(source).toContain('.app-chat-composer-dock');
    expect(source).toContain('.app-chat-composer-editor');
    expect(source).toContain('.app-chat-composer-footer');
    expect(source).toContain('.app-chat-connection-indicator');
    expect(source).toContain('-webkit-mask:');
    expect(source).toContain('mask:');
    expect(source).toContain('aspect-ratio: 255 / 84;');
    expect(source).not.toContain('.app-chat-welcome-wordmark-svg');
    expect(source).not.toContain('.app-chat-welcome-wordmark-primary');
    expect(source).not.toContain('.app-chat-welcome-wordmark-highlight');
    expect(source).not.toContain('.app-chat-welcome-wordmark-stroke');
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

  it('keeps assistant messages document-like while user replies stay softly tinted', () => {
    const messageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatMessage.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(messageSource).toContain("data-testid={isUser ? 'chat-user-bubble' : 'chat-assistant-bubble'}");
    expect(themeSource).toContain('.app-chat-bubble-assistant {\n  background: transparent;');
    expect(themeSource).toContain('.app-chat-bubble-user {\n  background:\n    linear-gradient(180deg, hsl(var(--primary) / 0.082) 0%, hsl(var(--primary) / 0.06) 100%);');
    expect(themeSource).toContain('.app-chat-message-column--user {\n  align-items: flex-end;\n  margin-inline-start: auto;\n  max-width: min(78%, 31rem);');
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
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');

    expect(messageSource).toContain('app-chat-message-column');
    expect(messageSource).toContain('app-chat-message-secondary');
    expect(messageSource).not.toContain("max-w-[70%] md:max-w-[62%]");
    expect(messageSource).not.toContain("max-w-[min(76%,40rem)]");
    expect(pageSource).toContain('stackSpacingClass');
    expect(pageSource).toContain('isClusteredWithPrevious');
    expect(pageSource).toContain('nextAssistantSpacingClass');
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
