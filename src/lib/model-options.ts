export interface ModelOption {
  ref: string;
  modelId?: string;
  name?: string;
  vendorId?: string;
  providerLabel?: string;
}

export function normalizeModelOption(
  raw: unknown,
  providerLabelMap: Map<string, string>,
): ModelOption | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const model = raw as Record<string, unknown>;
  const vendorId = typeof model.vendorId === 'string'
    ? model.vendorId
    : (typeof model.provider === 'string' ? model.provider : undefined);
  const rawModelId = typeof model.id === 'string'
    ? model.id
    : (typeof model.model === 'string' ? model.model : '');
  const ref = (() => {
    if (typeof model.key === 'string' && model.key.trim()) {
      return model.key.trim();
    }
    if (typeof model.ref === 'string' && model.ref.trim()) {
      return model.ref.trim();
    }
    if (typeof model.modelRef === 'string' && model.modelRef.trim()) {
      return model.modelRef.trim();
    }
    const trimmedModelId = rawModelId.trim();
    if (!trimmedModelId) {
      return '';
    }
    if (trimmedModelId.includes('/')) {
      return trimmedModelId;
    }
    const trimmedVendorId = vendorId?.trim();
    return trimmedVendorId ? `${trimmedVendorId}/${trimmedModelId}` : trimmedModelId;
  })();

  if (!ref) {
    return null;
  }

  const name = typeof model.name === 'string'
    ? model.name
    : (typeof model.label === 'string' ? model.label : undefined);
  const trimmedModelId = rawModelId.trim();
  const refProvider = ref.includes('/') ? ref.split('/')[0]?.trim() : undefined;
  const refModelId = ref.includes('/') ? ref.slice(ref.indexOf('/') + 1).trim() : undefined;
  const normalizedVendorId = vendorId?.trim() || refProvider || undefined;
  const normalizedModelId = (
    trimmedModelId.includes('/')
      ? trimmedModelId.slice(trimmedModelId.indexOf('/') + 1).trim()
      : trimmedModelId
  ) || refModelId || undefined;

  return {
    ref,
    modelId: normalizedModelId,
    name: name?.trim() || undefined,
    vendorId: normalizedVendorId,
    providerLabel: providerLabelMap.get(normalizedVendorId || '')?.trim() || undefined,
  };
}

export function getModelOptionLabel(model: ModelOption): string {
  return model.name || model.modelId || model.ref;
}

function getModelHintBase(model: ModelOption): string {
  if (model.modelId && model.modelId !== model.ref) {
    return model.modelId;
  }
  if (model.name && model.name !== model.ref) {
    return model.name;
  }
  return model.ref;
}

export function getModelOptionHint(model: ModelOption): string | null {
  if (model.providerLabel) {
    const hintBase = getModelHintBase(model);
    if (!hintBase) {
      return model.providerLabel;
    }
    const providerPrefix = `${model.providerLabel}/`;
    if (hintBase.startsWith(providerPrefix)) {
      return model.providerLabel;
    }
    if (hintBase === model.providerLabel) {
      return null;
    }
    return `${model.providerLabel} · ${hintBase}`;
  }

  if (model.name && model.name !== model.ref) {
    return model.ref;
  }

  if (model.modelId && model.modelId !== model.ref) {
    return model.ref;
  }

  return null;
}
