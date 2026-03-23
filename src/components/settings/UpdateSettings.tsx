/**
 * Update Settings Component
 * Displays version info while built-in auto-updates are disabled
 */
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useUpdateStore } from '@/stores/update';
import { useTranslation } from 'react-i18next';

const updatePanelClass = 'space-y-4';
const neutralPanelClass =
  'rounded-[14px] border border-border/60 bg-[hsl(var(--surface-base)/0.92)] p-4 text-[13px] leading-6 text-muted-foreground';

export function UpdateSettings() {
  const { t } = useTranslation('settings');
  const {
    status,
    currentVersion,
    isInitialized,
    init,
  } = useUpdateStore();

  useEffect(() => {
    init();
  }, [init]);

  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('common:status.loading')}</span>
      </div>
    );
  }

  return (
    <div className={updatePanelClass}>
      <div className="space-y-2">
        <p className="text-[13px] font-medium text-foreground/86">
          {status === 'disabled' ? t('updates.status.disabled') : t('updates.status.disabled')}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span>{t('updates.currentVersion')}: {currentVersion}</span>
        </div>
      </div>
      <div className={neutralPanelClass}>
        <p>{t('updates.disabledDetail')}</p>
      </div>
    </div>
  );
}

export default UpdateSettings;
