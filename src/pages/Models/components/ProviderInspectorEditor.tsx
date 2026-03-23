import { ProviderAccountFormSections, type ProviderAccountFormSavePayload, type ProviderAccountValidateFn } from '@/components/settings/providers/ProviderAccountFormSections';
import type { ProviderListItem } from '@/lib/provider-accounts';

interface ProviderInspectorEditorProps {
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  devModeUnlocked: boolean;
  onSave: (payload: ProviderAccountFormSavePayload) => Promise<void>;
  onCancel: () => void;
  onValidateKey: ProviderAccountValidateFn;
}

export function ProviderInspectorEditor({
  item,
  allProviders,
  devModeUnlocked,
  onSave,
  onCancel,
  onValidateKey,
}: ProviderInspectorEditorProps) {
  return (
    <ProviderAccountFormSections
      mode="edit"
      item={item}
      allProviders={allProviders}
      devModeUnlocked={devModeUnlocked}
      density="compact"
      footerTestId="models-provider-inspector-footer"
      onSave={onSave}
      onCancel={onCancel}
      onValidateKey={onValidateKey}
    />
  );
}
