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
const MODELS_PROVIDER_BOARD_CARD_MIN_WIDTH_PX = 224;
const MODELS_PROVIDER_BOARD_COLUMN_GAP_PX = 12;
const MODELS_PROVIDER_BOARD_MAX_COLUMNS = 6;
const MODELS_PROVIDER_BOARD_PINNED_MAX_COLUMNS = 3;
const MODELS_PROVIDER_INSPECTOR_PANE_MIN_WIDTH = 1600;
export const MODELS_PROVIDER_BOARD_GRID_TEMPLATE = 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))';

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
}: Pick<ModelsWorkbenchLayoutInput, 'contentWidth' | 'inspectorPinned'>): number =>
  Math.max(
    1,
    Math.min(
      inspectorPinned ? MODELS_PROVIDER_BOARD_PINNED_MAX_COLUMNS : MODELS_PROVIDER_BOARD_MAX_COLUMNS,
      Math.floor(
        (Math.max(contentWidth, MODELS_PROVIDER_BOARD_CARD_MIN_WIDTH_PX) + MODELS_PROVIDER_BOARD_COLUMN_GAP_PX)
          / (MODELS_PROVIDER_BOARD_CARD_MIN_WIDTH_PX + MODELS_PROVIDER_BOARD_COLUMN_GAP_PX),
      ),
    ),
  );

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
