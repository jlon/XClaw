export const MODELS_WORKBENCH_MODES = {
  default: 'default',
  focused: 'focused',
  ultrawide: 'ultrawide',
} as const;

export type ModelsWorkbenchMode = (typeof MODELS_WORKBENCH_MODES)[keyof typeof MODELS_WORKBENCH_MODES];
export type ProviderInspectorShell = 'modal' | 'pane';
export type ProviderBoardPresentation = 'board' | 'header' | 'rail';

export interface ModelsWorkbenchLayoutInput {
  contentWidth: number;
  hasSelection: boolean;
  inspectorPinned: boolean;
}

const MODELS_WORKBENCH_ULTRAWIDE_MIN_WIDTH = 1600;
const MODELS_WORKBENCH_ULTRAWIDE_PINNED_MIN_WIDTH = 1680;

const MODELS_PROVIDER_BOARD_COLUMN_BREAKPOINTS = {
  1: 0,
  2: 760,
  3: 1160,
  4: 1520,
} as const satisfies Record<1 | 2 | 3 | 4, number>;

const MODELS_PROVIDER_BOARD_COLUMNS_DESC = [4, 3, 2, 1] as const;
const MODELS_PROVIDER_INSPECTOR_PANE_MIN_WIDTH = 1600;

const getWorkbenchMinWidth = (inspectorPinned: boolean): number =>
  inspectorPinned ? MODELS_WORKBENCH_ULTRAWIDE_PINNED_MIN_WIDTH : MODELS_WORKBENCH_ULTRAWIDE_MIN_WIDTH;

export const getModelsWorkbenchMode = ({
  contentWidth,
  hasSelection,
  inspectorPinned,
}: ModelsWorkbenchLayoutInput): ModelsWorkbenchMode =>
  !hasSelection
    ? MODELS_WORKBENCH_MODES.default
    : contentWidth >= getWorkbenchMinWidth(inspectorPinned)
      ? MODELS_WORKBENCH_MODES.ultrawide
      : MODELS_WORKBENCH_MODES.focused;

export const getProviderBoardColumns = ({
  contentWidth,
  inspectorPinned,
}: Pick<ModelsWorkbenchLayoutInput, 'contentWidth' | 'inspectorPinned'>): 1 | 2 | 3 | 4 => {
  const columnCount = MODELS_PROVIDER_BOARD_COLUMNS_DESC.find((candidate) => {
    if (candidate === 4 && inspectorPinned) {
      return false;
    }
    return contentWidth >= MODELS_PROVIDER_BOARD_COLUMN_BREAKPOINTS[candidate];
  });

  return columnCount ?? 1;
};

export const getTokenIntelligenceLayout = ({
  contentWidth,
  inspectorPinned,
}: Pick<ModelsWorkbenchLayoutInput, 'contentWidth' | 'inspectorPinned'>): 'stack' | 'split' =>
  contentWidth >= getWorkbenchMinWidth(inspectorPinned) ? 'split' : 'stack';

export const getProviderInspectorShell = ({
  contentWidth,
}: Pick<ModelsWorkbenchLayoutInput, 'contentWidth'>): ProviderInspectorShell =>
  contentWidth >= MODELS_PROVIDER_INSPECTOR_PANE_MIN_WIDTH
    ? 'pane'
    : 'modal';

export const getProviderBoardPresentation = ({
  contentWidth,
  hasSelection,
  inspectorPinned,
}: ModelsWorkbenchLayoutInput): ProviderBoardPresentation => {
  if (!hasSelection) {
    return 'board';
  }

  return getModelsWorkbenchMode({ contentWidth, hasSelection, inspectorPinned }) === MODELS_WORKBENCH_MODES.ultrawide
    ? 'rail'
    : 'header';
};
