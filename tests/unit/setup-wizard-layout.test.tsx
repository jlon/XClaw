import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SetupFooter } from '@/components/setup/SetupFooter';
import { SetupShell } from '@/components/setup/SetupShell';
import { SetupStartStage } from '@/components/setup/SetupStartStage';
import { SetupStepRail } from '@/components/setup/SetupStepRail';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => ({
      'wizard.rail.title': '引导流程',
      'wizard.rail.aria': '引导步骤',
      'wizard.footer.start.title': '开始引导',
      'wizard.footer.start.body': '先确认怎么开始，再继续后面的准备和接入。',
      'wizard.footer.start.primary': '下一步',
      'wizard.footer.start.secondary': '退出引导',
      'wizard.footer.preparation.title': '准备环境',
      'wizard.footer.preparation.body': '先完成本地环境确认，再进入模型与接入。',
      'wizard.footer.preparation.primary': '下一步',
      'wizard.footer.preparation.secondary': '返回',
      'wizard.footer.provider.title': '模型与接入',
      'wizard.footer.provider.body': '先选接入方式，再继续下一步。',
      'wizard.footer.provider.primary': '下一步',
      'wizard.footer.provider.secondary': '返回',
      'wizard.footer.complete.title': '完成',
      'wizard.footer.complete.body': '确认变更并进入应用。',
      'wizard.footer.complete.primary': '进入 XClaw',
      'wizard.footer.complete.secondary': '返回',
      'wizard.footer.applying.title': '正在应用变更',
      'wizard.footer.applying.body': '请保持窗口打开，完成后会自动进入摘要。',
      'welcome.title': '欢迎使用',
      'welcome.description': '一套更像桌面应用的浅色引导体验。',
      'welcome.features.noCommand': '不用命令行也能完成接入',
      'welcome.features.modernUI': '统一的桌面级视觉层级',
      'welcome.features.bundles': '常用能力默认就绪',
      'welcome.features.crossPlatform': '兼容 mac 与 Windows',
    }[key] ?? key),
  }),
}));

describe('setup wizard shell', () => {
  it('renders a passive rail, content region, and footer actions', () => {
    const { container } = render(
      <SetupShell
        rail={<div data-testid="setup-rail" />}
        footer={<div data-testid="setup-footer" />}
      >
        <div data-testid="setup-content" />
      </SetupShell>,
    );

    expect(screen.getByTestId('setup-rail')).toBeInTheDocument();
    expect(screen.getByTestId('setup-content')).toBeInTheDocument();
    expect(screen.getByTestId('setup-footer')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('app-setup-shell');
    expect(container.querySelector('aside')).toHaveClass('app-setup-rail');
    expect(container.querySelector('main')).toHaveClass('app-setup-content');
  });

  it('keeps the stage rail passive instead of supporting jump navigation', async () => {
    const onSelect = vi.fn();

    render(
      <SetupStepRail
        stages={[
          { id: 'start', label: '开始', status: 'complete' },
          { id: 'preparation', label: '准备', status: 'current' },
          { id: 'provider', label: '模型与接入', status: 'upcoming' },
          { id: 'complete', label: '完成', status: 'upcoming' },
        ]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByText('模型与接入'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('changes footer semantics when completion is still applying changes', () => {
    render(
      <SetupFooter
        stage="complete"
        completePhase="applying"
        canProceed={false}
        onBack={vi.fn()}
        onPrimary={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '进入 XClaw' })).not.toBeInTheDocument();
    expect(screen.getByText('正在应用变更')).toBeInTheDocument();
  });

  it('renders the welcome stage as a branded desktop-style hero instead of a plain utility card', () => {
    render(
      <SetupStartStage
        inspection={null}
        activePlan={null}
        mode="fresh"
        onModeChange={vi.fn()}
        status={null}
        submitting={false}
      />,
    );

    expect(screen.getByText('欢迎使用')).toBeInTheDocument();
    expect(screen.getByTestId('setup-start-hero')).toHaveClass('app-setup-hero');
  });
});
