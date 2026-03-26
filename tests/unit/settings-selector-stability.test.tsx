import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Switch } from '@/components/ui/switch';
import { useSettingsStore } from '@/stores/settings';

function UnstableSettingsSelectorSwitch() {
  const { launchAtStartup, setLaunchAtStartup } = useSettingsStore((state) => ({
    launchAtStartup: state.launchAtStartup,
    setLaunchAtStartup: state.setLaunchAtStartup,
  }));

  return <Switch checked={launchAtStartup} onCheckedChange={setLaunchAtStartup} />;
}

describe('settings selector stability', () => {
  beforeEach(() => {
    useSettingsStore.setState({ launchAtStartup: false });
  });

  it('renders a controlled settings switch without triggering recursive updates', () => {
    expect(() => render(<UnstableSettingsSelectorSwitch />)).not.toThrow();
  });
