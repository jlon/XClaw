import './styles.css';
import { websiteContent } from './content';

const root = document.getElementById('app');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let revealObserver: IntersectionObserver | null = null;

if (!root) {
  throw new Error('Website mount container "#app" was not found.');
}

const createBrandWordmark = (className: string) => `
  <span class="${className}" aria-label="XClaw">
    <span class="${className}-lead">X</span><span class="${className}-accent">Claw</span>
  </span>
`;

const createHeroField = () => `
  <div class="site-hero-fx" aria-hidden="true">
    <span class="site-hero-nebula"></span>
    <span class="site-hero-aurora"></span>
    <span class="site-hero-beam"></span>
    <span class="site-hero-orbit site-hero-orbit-outer"></span>
    <span class="site-hero-orbit site-hero-orbit-inner"></span>
    <span class="site-hero-ring"></span>
    <span class="site-hero-scanline"></span>
    <span class="site-hero-comet is-a"></span>
    <span class="site-hero-comet is-b"></span>
    <span class="site-hero-node is-a"></span>
    <span class="site-hero-node is-b"></span>
    <span class="site-hero-node is-c"></span>
    <span class="site-hero-node is-d"></span>
  </div>
`;

const getScreenshot = (id: string) => websiteContent.screenshots.find((item) => item.id === id) ?? websiteContent.screenshots[0];

const downloadIcons = {
  apple: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.18 12.05c.02 2.18 1.92 2.9 1.94 2.91-.02.05-.3 1.06-.97 2.08-.58.88-1.18 1.76-2.13 1.78-.93.02-1.22-.54-2.29-.54-1.08 0-1.4.52-2.27.56-.91.03-1.6-.92-2.19-1.8-1.2-1.74-2.11-4.92-.88-7.03.61-1.05 1.72-1.71 2.92-1.73.89-.02 1.74.59 2.29.59.55 0 1.58-.73 2.67-.62.46.02 1.75.18 2.58 1.4-.07.04-1.54.9-1.53 2.4Zm-1.68-6.1c.49-.59.83-1.4.74-2.22-.71.03-1.57.46-2.09 1.05-.46.53-.86 1.35-.75 2.15.79.06 1.61-.39 2.1-.98Z"/>
    </svg>
  `,
  windows: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 4.72 10.65 3.67V11H3V4.72Zm8.56-1.18L21 2.25V11h-9.44V3.54ZM3 12.95h7.65v7.3L3 19.19v-6.24Zm8.56 0H21v8.79l-9.44-1.33v-7.46Z"/>
    </svg>
  `,
} as const;

const createDownloadButtons = (compact = false) =>
  websiteContent.downloads
    .map(
      ({ label, icon, width, href }) => `
        <a class="site-download-button${compact ? ' is-compact' : ''} is-${width}" href="${href}" target="_blank" rel="noreferrer">
          <span class="site-download-button-inner">
            <span class="site-download-icon">${downloadIcons[icon]}</span>
            <span class="site-download-label">${label}</span>
          </span>
        </a>
      `,
    )
    .join('');

const createStats = () =>
  websiteContent.stats
    .map(
      ({ value, label }, index) => `
        <article class="site-stat-card" data-reveal style="--reveal-delay: ${index * 80}ms">
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `,
    )
    .join('');

const createScreenshotTabs = (activeId: string) =>
  websiteContent.screenshots
    .map(
      ({ id, label }) => `
        <button class="site-screen-tab${id === activeId ? ' is-active' : ''}" data-screen-tab="${id}" type="button">
          ${label}
        </button>
      `,
    )
    .join('');

const createPreview = (activeId: string) => {
  const current = getScreenshot(activeId);

  return `
    <div class="site-preview-shell">
      <div class="site-preview-tabs">
        ${createScreenshotTabs(current.id)}
      </div>
      <div class="site-preview-panel">
        <div class="site-preview-frame">
          <img class="site-preview-image" src="${current.image}" alt="${current.alt}" />
          <div class="site-preview-copy">
            <strong>${current.title}</strong>
            <span>${current.description}</span>
          </div>
        </div>
      </div>
    </div>
  `;
};

const createScenarios = () =>
  websiteContent.scenarios
    .map(
      ({ tone, tag, title, description, chips, prompt, response }, index) => `
        <article class="site-scenario-card is-${tone}" data-reveal style="--reveal-delay: ${index * 90}ms">
          <div class="site-scenario-head">
            <span class="site-scenario-tag">${tag}</span>
            <h3>${title}</h3>
            <p>${description}</p>
          </div>
          <div class="site-scenario-chips">
            ${chips.map((chip) => `<span>${chip}</span>`).join('')}
          </div>
          <div class="site-scenario-dialog">
            <div class="site-scenario-bubble is-user">${prompt}</div>
            <div class="site-scenario-bubble is-agent">${response}</div>
          </div>
        </article>
      `,
    )
    .join('');

const createFeatures = () =>
  websiteContent.features
    .map(
      ({ eyebrow, title, description }, index) => `
        <article class="site-feature-card" data-reveal style="--reveal-delay: ${index * 70}ms">
          <span class="site-feature-eyebrow">${eyebrow}</span>
          <h3>${title}</h3>
          <p>${description}</p>
        </article>
      `,
    )
    .join('');

const createQuickStart = () =>
  websiteContent.quickStart
    .map(
      ({ step, title, description }, index) => `
        <article class="site-step-card" data-reveal style="--reveal-delay: ${index * 90}ms">
          <span class="site-step-index">${step}</span>
          <h3>${title}</h3>
          <p>${description}</p>
        </article>
      `,
    )
    .join('');

const createFooterLinks = () =>
  websiteContent.footer.links
    .map(({ label, href }) => `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`)
    .join('');

const bindReveal = (scope: ParentNode = root) => {
  const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]'));

  if (reduceMotion) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          revealObserver?.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    );
  }

  nodes.forEach((node) => {
    if (node.classList.contains('is-visible')) return;
    revealObserver?.observe(node);
  });
};

const bindHeroField = () => {
  const hero = root.querySelector<HTMLElement>('.site-hero');

  if (!hero || reduceMotion) return;

  const reset = () => {
    hero.style.setProperty('--hero-shift-x', '0px');
    hero.style.setProperty('--hero-shift-y', '0px');
    hero.style.setProperty('--hero-tilt-x', '0deg');
    hero.style.setProperty('--hero-tilt-y', '0deg');
  };

  const update = (event: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    const shiftX = offsetX * 0.045;
    const shiftY = offsetY * 0.028;
    const tiltX = (-offsetY / rect.height) * 3.4;
    const tiltY = (offsetX / rect.width) * 4.8;

    hero.style.setProperty('--hero-shift-x', `${shiftX}px`);
    hero.style.setProperty('--hero-shift-y', `${shiftY}px`);
    hero.style.setProperty('--hero-tilt-x', `${tiltX}deg`);
    hero.style.setProperty('--hero-tilt-y', `${tiltY}deg`);
  };

  reset();
  hero.addEventListener('pointermove', update);
  hero.addEventListener('pointerleave', reset);
};

const mountPreview = (activeId: string) => {
  const previewRoot = root.querySelector<HTMLElement>('[data-preview-root]');

  if (!previewRoot) return;

  previewRoot.innerHTML = createPreview(activeId);

  previewRoot.querySelectorAll<HTMLButtonElement>('[data-screen-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextId = button.dataset.screenTab;

      if (!nextId || nextId === activeId) return;

      mountPreview(nextId);
    });
  });
};

const render = (activeId: string) => {
  root.innerHTML = `
    <div class="site-shell">
      <header class="site-header">
        <a class="site-header-brand" href="#top">
          <img src="${websiteContent.logoUrl}" alt="XClaw Logo" />
          ${createBrandWordmark('site-brand-word')}
        </a>
        <nav class="site-nav" aria-label="官网导航">
          ${websiteContent.nav.map(({ label, href }) => `<a href="${href}">${label}</a>`).join('')}
        </nav>
        <div class="site-header-actions">
          <a class="site-secondary-cta" href="${websiteContent.repoUrl}" target="_blank" rel="noreferrer">${websiteContent.hero.secondaryCta}</a>
          <a class="site-header-cta" href="#download">${websiteContent.hero.primaryCta}</a>
        </div>
      </header>

      <main id="top">
        <section class="site-hero">
          <div class="site-hero-decor" aria-hidden="true">
            <span class="site-hero-glow"></span>
            <span class="site-hero-grid"></span>
            ${createHeroField()}
          </div>
          <div class="site-hero-kicker">
            <img class="site-hero-logo" src="${websiteContent.logoUrl}" alt="XClaw Logo" />
          </div>
          <span class="site-hero-badge">${websiteContent.hero.badge}</span>
          <h1 class="site-hero-name">${createBrandWordmark('site-hero-wordmark')}</h1>
          <p class="site-hero-brandline">${websiteContent.hero.brandline}</p>
          <p class="site-hero-title">${websiteContent.hero.subtitle}</p>
          <p class="site-hero-description">${websiteContent.hero.description}</p>
          <div class="site-download-row" id="download">
            ${createDownloadButtons()}
          </div>
          <div class="site-stat-grid">
            ${createStats()}
          </div>
        </section>

        <section class="site-showcase" data-reveal>
          <div class="site-section-head">
            <span>${websiteContent.hero.stageLabel}</span>
            <h2>${websiteContent.hero.stageTitle}</h2>
            <p>${websiteContent.hero.stageDescription}</p>
          </div>
          <div class="site-showcase-panel">
            <div data-preview-root></div>
          </div>
        </section>

        <section class="site-scenarios" id="scenarios">
          <div class="site-section-head" data-reveal>
            <span>使用场景</span>
            <h2>XClaw 能帮你做什么</h2>
            <p>从消息整理到定时提醒，从资料归类到任务切换，常用动作都能收进一个工作台。</p>
          </div>
          <div class="site-scenario-grid">
            ${createScenarios()}
          </div>
        </section>

        <section class="site-features" id="features">
          <div class="site-section-head" data-reveal>
            <span>核心能力</span>
            <h2>只讲你现在能直接用到的能力</h2>
            <p>不卖概念，不堆内部术语，页面里的每一项都对应现有产品能力。</p>
          </div>
          <div class="site-feature-grid">
            ${createFeatures()}
          </div>
        </section>

        <section class="site-quickstart" id="quickstart">
          <div class="site-section-head" data-reveal>
            <span>快速上手</span>
            <h2>两步开始</h2>
            <p>先下载，再完成基础设置，之后就直接进入工作台。</p>
          </div>
          <div class="site-step-grid">
            ${createQuickStart()}
          </div>
        </section>

        <section class="site-release">
          <div class="site-release-panel" data-reveal>
            <div class="site-release-copy">
              <span>下载与更新</span>
              <h2>${websiteContent.release.title}</h2>
              <p>${websiteContent.release.description}</p>
            </div>
            <div class="site-release-actions">
              <a class="site-header-cta" href="${websiteContent.releaseUrl}" target="_blank" rel="noreferrer">${websiteContent.release.primaryCta}</a>
              <a class="site-secondary-cta" href="${websiteContent.repoUrl}" target="_blank" rel="noreferrer">${websiteContent.release.secondaryCta}</a>
            </div>
            <div class="site-download-row is-compact">
              ${createDownloadButtons(true)}
            </div>
          </div>
        </section>
      </main>

      <footer class="site-footer" data-reveal>
        <div class="site-footer-top">
          <a class="site-footer-brand" href="#top">
            <img src="${websiteContent.logoUrl}" alt="XClaw Logo" />
            ${createBrandWordmark('site-footer-wordmark')}
          </a>
          <span class="site-footer-tagline">${websiteContent.footer.tagline}</span>
        </div>
        <p class="site-footer-description">${websiteContent.footer.description}</p>
        <div class="site-footer-links">
          ${createFooterLinks()}
        </div>
        <span class="site-footer-meta">${websiteContent.footer.copyright}</span>
      </footer>
    </div>
  `;

  mountPreview(activeId);
  bindReveal();
  bindHeroField();
};

render(websiteContent.screenshots[0].id);
