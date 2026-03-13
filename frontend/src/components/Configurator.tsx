import { useState, useEffect } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { formatNumber } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  RotateCcw,
  Package,
  Save,
  PenLine,
  X,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Layers,
  Monitor,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  FolderOpen,
  Database,
  AlertTriangle,
} from 'lucide-react';
import PricePanel from './PricePanel';
import { isSuperCategoryPriced, isSuperCategoryReadOnly, supportsCustomInput, canShowHiddenItems, formatModelDisplayName } from '@/lib/cpq-data';
import type { OptionItem, SeriesInfo } from '@/lib/cpq-data';
import { useI18n } from '@/lib/i18n';

const SAVE_PRIMARY_CLASS = 'h-8 px-3 text-xs gap-1.5 rounded-full shadow-sm';
const SAVE_SECONDARY_CLASS = 'h-8 px-3 text-xs gap-1.5 rounded-full border-slate-300 bg-white';

function buildSeriesPath(seriesList: SeriesInfo[], leafSeriesId: string): SeriesInfo[] {
  if (!leafSeriesId) return [];

  const byId = new Map(seriesList.map((series) => [series.series_id, series]));
  const path: SeriesInfo[] = [];
  let cursor = byId.get(leafSeriesId);

  while (cursor) {
    path.unshift(cursor);
    const parentId = cursor.parent_series;
    if (!parentId || parentId === 'null') break;
    cursor = byId.get(parentId);
  }

  return path;
}

// Step 1: Series Selection - Folder navigation style
function SeriesSelector() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const {
    seriesList,
    selectSeries,
    getModelsForSeries,
    saveConfiguration,
    selectedSeriesId,
    editingConfigId,
    savedConfigurations,
    setActiveTab,
  } = useCPQStore();

  const [saveSuccess, setSaveSuccess] = useState(false);
  // Track the current navigation path (like folder path)
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  // Initialize currentPath based on selectedSeriesId when component mounts
  useEffect(() => {
    if (selectedSeriesId && seriesList.length > 0) {
      // Build path from root to selected series (excluding the leaf itself)
      const path: string[] = [];
      let current = seriesList.find(s => s.series_id === selectedSeriesId);
      
      while (current) {
        const parentId = current.parent_series === 'null' || !current.parent_series 
          ? undefined 
          : current.parent_series;
        
        if (parentId) {
          // Insert at beginning to build root-to-leaf path
          path.unshift(parentId);
          current = seriesList.find(s => s.series_id === parentId);
        } else {
          break;
        }
      }
      
      setCurrentPath(path);
    }
  }, [selectedSeriesId, seriesList]);

  // Build tree: top-level series (parent_series === "null" or empty)
  const topLevel = seriesList.filter(s => s.parent_series === 'null' || !s.parent_series);
  const getChildren = (parentId: string): SeriesInfo[] =>
    seriesList.filter(s => s.parent_series === parentId);

  // Get series by ID
  const getSeries = (id: string): SeriesInfo | undefined =>
    seriesList.find(s => s.series_id === id);

  // Navigate into a series (like double-clicking a folder)
  const navigateInto = (seriesId: string) => {
    const series = getSeries(seriesId);
    if (!series) return;

    const children = getChildren(seriesId);
    if (children.length === 0) {
      const availableModels = getModelsForSeries(seriesId);
      if (availableModels.length === 0) {
        alert(isZh
          ? `产品线「${series.series_name}」暂无可用销售机型，请先在“销售机型”中发布或关联后再试。`
          : `No available market model for series "${series.series_name}". Please publish or link one in Market Models first.`);
        return;
      }
      // Leaf node with models - select and proceed
      selectSeries(seriesId);
    } else {
      // Has children - navigate into it, hiding siblings
      setCurrentPath(prev => [...prev, seriesId]);
    }
  };

  // Navigate back to parent level
  const navigateBack = () => {
    setCurrentPath(prev => prev.slice(0, -1));
  };

  // Navigate to specific level in path
  const navigateToLevel = (level: number) => {
    setCurrentPath(prev => prev.slice(0, level));
  };

  // Get current level's series to display
  const getCurrentLevelSeries = (): SeriesInfo[] => {
    if (currentPath.length === 0) {
      return topLevel;
    }
    const currentParentId = currentPath[currentPath.length - 1];
    return getChildren(currentParentId);
  };

  // Get breadcrumb path names
  const getBreadcrumbs = (): SeriesInfo[] => {
    return currentPath.map(id => getSeries(id)).filter(Boolean) as SeriesInfo[];
  };

  const handleSaveIntermediate = (mode: 'new' | 'overwrite' = 'new') => {
    if (currentPath.length === 0) return;
    const currentId = currentPath[currentPath.length - 1];
    useCPQStore.setState({ selectedSeriesId: currentId });
    saveConfiguration(mode);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      // 跳转到选配历史界面
      setActiveTab('saved');
    }, 800);
  };

  const breadcrumbs = getBreadcrumbs();
  const currentLevelSeries = getCurrentLevelSeries();
  const editingConfig = editingConfigId ? savedConfigurations.find(cfg => cfg.id === editingConfigId) : null;
  const overwriteLabel = isZh ? '保存(覆盖)' : 'Save (Overwrite)';
  const overwriteDoneLabel = editingConfig?.source_config_id ? (isZh ? '已覆盖' : 'Overwritten') : (isZh ? '已保存' : 'Saved');

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{isZh ? '产品选配器' : 'Product Configurator'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isZh ? '第一步：选择产品线' : 'Step 1: Select Series'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end rounded-xl border border-slate-200 bg-white/80 px-2 py-1 shadow-sm">
          {currentPath.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={navigateBack}
              >
                <ArrowLeft className="w-3 h-3" />
                {isZh ? '返回上级' : 'Back'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={SAVE_SECONDARY_CLASS}
                onClick={() => handleSaveIntermediate('new')}
                disabled={saveSuccess}
              >
                {saveSuccess ? <><CheckCircle2 className="w-3 h-3" />{isZh ? '已保存' : 'Saved'}</> : <><Save className="w-3 h-3" />{isZh ? '保存(新增)' : 'Save (New)'}</>}
              </Button>
              {editingConfigId && (
                <Button
                  size="sm"
                  className={SAVE_PRIMARY_CLASS}
                  onClick={() => handleSaveIntermediate('overwrite')}
                  disabled={saveSuccess}
                >
                  {saveSuccess ? <><CheckCircle2 className="w-3 h-3" />{overwriteDoneLabel}</> : <><Save className="w-3 h-3" />{overwriteLabel}</>}
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab('saved')}
          >
            {isZh ? '查看选配历史' : 'View Saved Configs'}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2">
        <div className="flex items-center gap-1 text-blue-600 font-semibold">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</div>
          {isZh ? '选择产品线' : 'Select Series'}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-slate-400">
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">2</div>
          {isZh ? '选择机型' : 'Select Model'}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-slate-400">
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">3</div>
          {isZh ? '配置选项' : 'Configure Options'}
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div className="h-10 overflow-x-auto">
        <div className="inline-flex min-w-full items-center gap-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-2 whitespace-nowrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => navigateToLevel(0)}
          >
            root
          </Button>
          {breadcrumbs.map((series, idx) => (
            <div key={series.series_id} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 text-xs px-2 ${idx === breadcrumbs.length - 1 ? 'font-semibold text-blue-600' : ''}`}
                onClick={() => navigateToLevel(idx + 1)}
              >
                {series.series_name}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Current level series list */}
      <div className="space-y-1.5">
        {/* Series items */}
        {currentLevelSeries.map(series => {
          const children = getChildren(series.series_id);
          const hasChildren = children.length > 0;
          const availableModelCount = hasChildren ? 0 : getModelsForSeries(series.series_id).length;
          const isLeafUnavailable = !hasChildren && availableModelCount === 0;

          return (
            <div
              key={series.series_id}
              className={`flex h-11 items-center gap-2 px-3 transition-colors rounded-md border ${
                isLeafUnavailable
                  ? 'cursor-not-allowed bg-slate-50 border-slate-200 hover:bg-slate-100'
                  : 'cursor-pointer border-transparent hover:bg-blue-50 hover:border-blue-200'
              }`}
              onClick={() => navigateInto(series.series_id)}
            >
              {currentPath.length === 0 ? (
                <Layers className="w-4 h-4 text-blue-600" />
              ) : currentPath.length === 1 ? (
                <FolderOpen className="w-4 h-4 text-emerald-600" />
              ) : (
                <Monitor className="w-4 h-4 text-slate-500" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{series.series_name}</div>
              </div>
              {hasChildren && (
                <>
                  <Badge variant="secondary" className="text-[9px] h-5 shrink-0">{children.length} {isZh ? '子系列' : 'subseries'}</Badge>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </>
              )}
              {!hasChildren && (
                <Badge
                  variant={availableModelCount > 0 ? 'secondary' : 'destructive'}
                  className="text-[9px] h-5 shrink-0"
                >
                  {availableModelCount} {isZh ? '机型' : 'models'}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Step 2: Model Selection - Shows engineer model + linked sales models in one card
function ModelSelector() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const {
    selectedSeriesId,
    getModelsForSeries,
    getSelectedSeries,
    confirmSeriesAndPickModel,
    backToSeriesSelection,
    saveConfiguration,
    editingConfigId,
    savedConfigurations,
    marketModels,
    engineerModels,
    seriesList,
    setActiveTab,
  } = useCPQStore();

  const [saveSuccess, setSaveSuccess] = useState(false);
  const editingConfig = editingConfigId ? savedConfigurations.find(cfg => cfg.id === editingConfigId) : null;
  const overwriteLabel = isZh ? '保存(覆盖)' : 'Save (Overwrite)';
  const overwriteDoneLabel = editingConfig?.source_config_id ? (isZh ? '已覆盖' : 'Overwritten') : (isZh ? '已保存' : 'Saved');

  const series = getSelectedSeries();
  const modelsForSeries = getModelsForSeries(selectedSeriesId);

  // Get engineer models for the selected series
  const getEngineerModelsForSeries = (): typeof engineerModels => {
    const targetIds = new Set<string>();
    const findChildren = (parentId: string) => {
      targetIds.add(parentId);
      for (const s of seriesList) {
        if (s.parent_series === parentId) {
          findChildren(s.series_id);
        }
      }
    };
    findChildren(selectedSeriesId);

    const seriesNames = new Set<string>();
    for (const s of seriesList) {
      if (targetIds.has(s.series_id)) {
        seriesNames.add(s.series_name);
      }
    }

    return engineerModels.filter(m =>
      seriesNames.has(m.product_series) || targetIds.has(m.series_info.series_id)
    );
  };

  const engineerModelsForSeries = getEngineerModelsForSeries();
  const seriesPath = buildSeriesPath(seriesList, selectedSeriesId);

  const jumpToSeriesNode = (seriesId: string) => {
    useCPQStore.setState({ selectedSeriesId: seriesId });
    backToSeriesSelection();
  };

  // Find market models linked to a specific engineer model
  const getLinkedMarketModels = (engineerModelId: string) => {
    return modelsForSeries.filter(m => m.engineer_model_id === engineerModelId);
  };

  // Get market models that are NOT linked to any engineer model in this series
  const unlinkedMarketModels = modelsForSeries.filter(m => {
    if (!m.engineer_model_id) return true;
    return !engineerModelsForSeries.some(e => e.model_id === m.engineer_model_id);
  });

  const hasNoModels = engineerModelsForSeries.length === 0 && modelsForSeries.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{isZh ? '产品选配器' : 'Product Configurator'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isZh ? '第二步：选择机型' : 'Step 2: Select Model'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end rounded-xl border border-slate-200 bg-white/80 px-2 py-1 shadow-sm">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={backToSeriesSelection}
          >
            <ArrowLeft className="w-3 h-3" />
            {isZh ? '返回产品线' : 'Back to Series'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={SAVE_SECONDARY_CLASS}
            onClick={() => {
              saveConfiguration('new');
              setSaveSuccess(true);
              setTimeout(() => {
                setSaveSuccess(false);
                setActiveTab('saved');
              }, 800);
            }}
            disabled={saveSuccess}
          >
            {saveSuccess ? <><CheckCircle2 className="w-3 h-3" />{isZh ? '已保存' : 'Saved'}</> : <><Save className="w-3 h-3" />{isZh ? '保存(新增)' : 'Save (New)'}</>}
          </Button>
          {editingConfigId && (
            <Button
              size="sm"
              className={SAVE_PRIMARY_CLASS}
              onClick={() => {
                saveConfiguration('overwrite');
                setSaveSuccess(true);
                setTimeout(() => {
                  setSaveSuccess(false);
                  setActiveTab('saved');
                }, 800);
              }}
              disabled={saveSuccess}
            >
              {saveSuccess ? <><CheckCircle2 className="w-3 h-3" />{overwriteDoneLabel}</> : <><Save className="w-3 h-3" />{overwriteLabel}</>}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setActiveTab('saved')}
          >
            {isZh ? '查看选配历史' : 'View Saved Configs'}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1 text-emerald-600">
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</div>
          {isZh ? '产品线已选' : 'Series Selected'}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-blue-600 font-semibold">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</div>
          {isZh ? '选择机型' : 'Select Model'}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-slate-400">
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">3</div>
          {isZh ? '配置选项' : 'Configure Options'}
        </div>
      </div>

      <div className="h-10 overflow-x-auto">
        <div className="inline-flex min-w-full items-center gap-1.5 text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-2 whitespace-nowrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={backToSeriesSelection}
          >
            root
          </Button>
          {seriesPath.map((node) => (
            <div key={node.series_id} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => jumpToSeriesNode(node.series_id)}
              >
                {node.series_name}
              </Button>
            </div>
          ))}
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-blue-600 font-semibold">{isZh ? '机型选择' : 'Model Selection'}</span>
        </div>
      </div>

      {hasNoModels ? (
        <div className="text-center py-10 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">{isZh ? '该产品线下暂无可用的机型' : 'No available models under this series'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Engineer model with linked sales models displayed as "工程机型(销售机型)" */}
          {engineerModelsForSeries.map((engModel) => {
            const linkedMarkets = getLinkedMarketModels(engModel.model_id);
            const engGroupCount = engModel.configuration_groups.filter(g => !g.hide).length;

            if (linkedMarkets.length > 0) {
              return linkedMarkets.map((mModel) => {
                const globalIdx = marketModels.indexOf(mModel);
                return (
                  <div
                    key={mModel.model_id}
                    className="border rounded-md h-11 px-3 flex items-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    onClick={() => confirmSeriesAndPickModel(globalIdx)}
                  >
                    <div className="flex items-center gap-2.5 w-full">
                      <Package className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {engModel.model_name}
                          <span className="text-blue-600">({mModel.model_name})</span>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              });
            }

            // Engineer model without linked sales model
            return (
              <div key={engModel.model_id} className="border rounded-md h-11 px-3 flex items-center border-dashed border-slate-300">
                <div className="flex items-center gap-2.5 w-full">
                  <Database className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-800 truncate">{engModel.model_name}</div>
                    <Badge variant="outline" className="text-[9px] h-5 border-indigo-300 text-indigo-600 shrink-0">{isZh ? '工程机型' : 'Engineer Model'}</Badge>
                    <Badge variant="secondary" className="text-[9px] h-5 shrink-0">{engGroupCount} {isZh ? '配置组' : 'groups'}</Badge>
                    <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{isZh ? '未关联销售机型' : 'No linked market model'}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Unlinked Market Models */}
          {unlinkedMarketModels.map((model) => {
            const globalIdx = marketModels.indexOf(model);
            return (
              <div
                key={model.model_id}
                className="border rounded-md h-11 px-3 flex items-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={() => confirmSeriesAndPickModel(globalIdx)}
              >
                <div className="flex items-center gap-2.5 w-full">
                  <Package className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="text-xs font-semibold text-slate-800 truncate">{model.model_name}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// Step 3: Options Configuration
function OptionsConfigurator() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const {
    marketModels,
    activeMarketModelIndex,
    selections,
    priceMap,
    customEntries,
    priceTables,
    setSelection,
    resetSelections,
    addCustomEntry,
    removeCustomEntry,
    saveConfiguration,
    editingConfigId,
    savedConfigurations,
    getCurrency,
    setActiveTab,
    backToModelSelection,
    backToSeriesSelection,
    selectedSeriesId,
    seriesList,
    getSelectedSeries,
    changePriceTableInConfig,
    getPriceTablesForEngineerModel,
    toggleSelection,
    getActiveModelDisplayName,
    constraintAnalysis,
    isOptionAvailable,
    getOptionDisableReasons,
  } = useCPQStore();

  const [customInputVisible, setCustomInputVisible] = useState<Record<string, boolean>>({});
  const [customInputText, setCustomInputText] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Toggle states for showing hidden items per super_category_id
  const [showHiddenGroups, setShowHiddenGroups] = useState<Record<number, boolean>>({});
  // Track which category is showing hidden options hint
  const [showHiddenHintFor, setShowHiddenHintFor] = useState<string | null>(null);
  // Track which specific categories should show hidden options (per category_code)
  const [showHiddenOptionsForCategory, setShowHiddenOptionsForCategory] = useState<Record<string, boolean>>({});

  const model = marketModels[activeMarketModelIndex];
  if (!model) return null;

  const seriesPath = buildSeriesPath(seriesList, selectedSeriesId || model.series_info.series_id);

  const jumpToSeriesNode = (seriesId: string) => {
    useCPQStore.setState({ selectedSeriesId: seriesId });
    backToSeriesSelection();
  };

  const editingConfig = editingConfigId ? savedConfigurations.find(cfg => cfg.id === editingConfigId) : null;
  const overwriteLabel = isZh ? '保存(覆盖)' : 'Save (Overwrite)';
  const overwriteDoneLabel = editingConfig?.source_config_id ? (isZh ? '已覆盖' : 'Overwritten') : (isZh ? '已保存' : 'Saved');

  const currency = getCurrency();
  const series = getSelectedSeries();
  const modelDisplayName = getActiveModelDisplayName();

  const formatPrice = (price: number): string => {
    return price > 0 ? `+${currency}${formatNumber(price)}` : `${currency}0`;
  };

  const toggleCustomInput = (categoryCode: string, hasHiddenOptions: boolean = false) => {
    const isVisible = customInputVisible[categoryCode];
    if (isVisible) {
      setCustomInputVisible(prev => ({ ...prev, [categoryCode]: false }));
      setCustomInputText(prev => ({ ...prev, [categoryCode]: '' }));
      removeCustomEntry(categoryCode);
    } else {
      // If there are hidden options, show them directly and show hint
      if (hasHiddenOptions) {
        setShowHiddenOptionsForCategory(prev => ({ ...prev, [categoryCode]: true }));
        setShowHiddenHintFor(categoryCode);
      }
      setCustomInputVisible(prev => ({ ...prev, [categoryCode]: true }));
    }
  };

  const confirmCustomInput = (categoryCode: string, categoryName: string, superCategoryId: number) => {
    const text = customInputText[categoryCode]?.trim();
    if (!text) return;
    addCustomEntry({
      category_code: categoryCode,
      category_name: categoryName,
      custom_text: text,
      super_category_id: superCategoryId,
    });
    setCustomInputVisible(prev => ({ ...prev, [categoryCode]: false }));
  };

  const isCustomActive = (categoryCode: string) => {
    return customEntries.some(e => e.category_code === categoryCode);
  };

  const handleSelectOption = (categoryCode: string, optionCode: string, isReadOnly: boolean, superCategoryId: number) => {
    // Read-only categories cannot be changed
    if (isReadOnly) return;
    if (!isOptionAvailable(categoryCode, optionCode)) return;
    // For 配置选择 (id:2) and 制造属性 (id:3), allow deselection (toggle)
    if (isSuperCategoryPriced(superCategoryId)) {
      toggleSelection(categoryCode, optionCode);
    } else {
      setSelection(categoryCode, optionCode);
    }
    setCustomInputVisible(prev => ({ ...prev, [categoryCode]: false }));
    setCustomInputText(prev => ({ ...prev, [categoryCode]: '' }));
  };

  const handleSave = (mode: 'new' | 'overwrite' = 'new') => {
    saveConfiguration(mode);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      // 跳转到选配历史界面
      setActiveTab('saved');
    }, 800);
  };

  const handleSaveOnly = (mode: 'new' | 'overwrite' = 'new') => {
    saveConfiguration(mode);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      // 跳转到选配历史界面
      setActiveTab('saved');
    }, 800);
  };

  const handlePriceTableChange = (priceTableId: string) => {
    changePriceTableInConfig(priceTableId);
  };

  const toggleShowHidden = (superCategoryId: number) => {
    setShowHiddenGroups(prev => ({
      ...prev,
      [superCategoryId]: !prev[superCategoryId],
    }));
  };

  const renderOptions = (
    options: OptionItem[],
    categoryCode: string,
    selectedCode: string,
    hasPricing: boolean,
    isReadOnly: boolean,
    superCategoryId: number
  ) => {
    return (
      <div className="space-y-1">
        {options.map((opt) => {
          const price = priceMap[opt.option_code] || 0;
          const isSelected = selectedCode === opt.option_code;
          const available = isOptionAvailable(categoryCode, opt.option_code);
          const disableReasons = getOptionDisableReasons(categoryCode, opt.option_code);
          const shouldDisable = !isReadOnly && !available;
          return (
            <div
              key={opt.option_code}
              className={`flex items-center gap-2 rounded px-2 py-1 transition-colors ${
                isReadOnly
                  ? isSelected ? 'bg-slate-200 border border-slate-400 shadow-sm' : 'border border-transparent opacity-60'
                  : shouldDisable
                    ? 'bg-slate-100 border border-slate-200 opacity-55 cursor-not-allowed'
                    : isSelected ? 'bg-blue-100 border border-blue-500 shadow-sm cursor-pointer' : 'hover:bg-slate-100 border border-transparent cursor-pointer'
              }`}
              onClick={() => handleSelectOption(categoryCode, opt.option_code, isReadOnly, superCategoryId)}
              title={disableReasons[0] || ''}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isReadOnly
                  ? isSelected ? 'border-slate-500' : 'border-slate-300'
                  : shouldDisable ? 'border-slate-300' : isSelected ? 'border-blue-600' : 'border-slate-300'
              }`}>
                {isSelected && <div className={`w-2 h-2 rounded-full ${isReadOnly || shouldDisable ? 'bg-slate-500' : 'bg-blue-600'}`} />}
              </div>
              {isReadOnly && <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
              {shouldDisable && <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
              <span className="text-[11px] truncate text-slate-600 flex-1">{opt.description}</span>
              {opt.is_default && <Badge variant="secondary" className="text-[9px] h-4 shrink-0">{isZh ? '默认' : 'Default'}</Badge>}
              {hasPricing && <span className="text-emerald-600 text-[10px] whitespace-nowrap ml-auto">{formatPrice(price)}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  // Determine which groups to show
  const getVisibleGroups = () => {
    return model.configuration_groups.filter(g => {
      // Always show non-hidden groups
      if (!g.hide) return true;
      // Show hidden groups if user toggled "show hidden" for that super_category_id
      if (canShowHiddenItems(g.super_category_id) && showHiddenGroups[g.super_category_id]) return true;
      return false;
    });
  };

  const visibleGroups = getVisibleGroups();

  // Check if there are any hidden groups for toggleable super categories
  const hiddenConfigGroups = model.configuration_groups.filter(
    g => g.hide && canShowHiddenItems(g.super_category_id)
  );
  // Group hidden counts by super_category_id
  const hiddenCountBySuper: Record<number, { name: string; count: number }> = {};
  for (const g of model.configuration_groups) {
    if (!canShowHiddenItems(g.super_category_id)) continue;
    const hiddenCats = g.categories.filter(c => c.hide).length;
    const hiddenOpts = g.categories.reduce((sum, c) => sum + c.options.filter(o => o.hide).length, 0);
    if (g.hide || hiddenCats > 0 || hiddenOpts > 0) {
      if (!hiddenCountBySuper[g.super_category_id]) {
        hiddenCountBySuper[g.super_category_id] = { name: g.super_category_name, count: 0 };
      }
      hiddenCountBySuper[g.super_category_id].count += (g.hide ? g.categories.length : hiddenCats) + hiddenOpts;
    }
  }

  const linkedPT = priceTables.find(t => t.id === model.price_table_id);
  // Only show price tables linked to the same engineer model
  const availablePriceTables = getPriceTablesForEngineerModel(model.engineer_model_id);

  return (
    <div className="space-y-3 h-[calc(100vh-120px)] flex flex-col">
      {/* Sticky header with title and action buttons */}
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{isZh ? '产品选配器' : 'Product Configurator'}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{isZh ? '第三步：配置选项' : 'Step 3: Configure Options'} - {modelDisplayName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={backToModelSelection}>
            <ArrowLeft className="w-3 h-3" />
            {isZh ? '返回机型' : 'Back to Model'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={resetSelections}>
            <RotateCcw className="w-3 h-3" />
            {isZh ? '重置' : 'Reset'}
          </Button>
          <Button 
            size="sm" 
            variant={editingConfigId ? 'outline' : 'default'}
            className={`${editingConfigId ? SAVE_SECONDARY_CLASS : SAVE_PRIMARY_CLASS}`}
            onClick={() => handleSaveOnly('new')} 
            disabled={saveSuccess}
          >
            {saveSuccess ? (
              <><CheckCircle2 className="w-3 h-3" />{isZh ? '已保存' : 'Saved'}</>
            ) : (
              <><Save className="w-3 h-3" />{isZh ? '保存(新增)' : 'Save (New)'}</>
            )}
          </Button>
          {editingConfigId && (
            <Button
              size="sm"
              className={SAVE_PRIMARY_CLASS}
              onClick={() => handleSaveOnly('overwrite')}
              disabled={saveSuccess}
            >
              {saveSuccess ? (
                <><CheckCircle2 className="w-3 h-3" />{overwriteDoneLabel}</>
              ) : (
                <><Save className="w-3 h-3" />{overwriteLabel}</>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveTab('saved')}>
            {isZh ? '查看选配历史' : 'View Saved Configs'}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2 shrink-0">
        <div className="flex items-center gap-1 text-emerald-600">
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</div>
          {series?.series_name || model.product_series}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-emerald-600">
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</div>
          {modelDisplayName}
        </div>
        <ChevronRight className="w-3 h-3 text-slate-300" />
        <div className="flex items-center gap-1 text-blue-600 font-semibold">
          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</div>
          {isZh ? '配置选项' : 'Configure Options'}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-2 shrink-0 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={backToSeriesSelection}
        >
          {isZh ? '根目录' : 'Root'}
        </Button>
        {seriesPath.map((node) => (
          <div key={node.series_id} className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => jumpToSeriesNode(node.series_id)}
            >
              {node.series_name}
            </Button>
          </div>
        ))}
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={backToModelSelection}
        >
          {isZh ? '机型选择' : 'Model Selection'}
        </Button>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-blue-600 font-semibold">{modelDisplayName}</span>
      </div>

      <div className="flex gap-4 overflow-hidden flex-1">
        <div className="flex-1 min-w-0 overflow-y-auto pr-2">
          {/* Model info bar with price table selector */}
          <div className="bg-white border rounded-lg p-3 mb-2 flex items-center gap-3 flex-wrap shrink-0">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium">{modelDisplayName}</span>
            <span className="text-[10px] text-slate-500">{model.series_info.series_description}</span>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-slate-500 whitespace-nowrap flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {isZh ? '价格表' : 'Price Table'}:
              </Label>
              <Select
                value={model.price_table_id || ''}
                onValueChange={handlePriceTableChange}
              >
                <SelectTrigger className="h-7 text-[10px] w-[160px]">
                  <SelectValue placeholder={isZh ? '选择价格表' : 'Select Price Table'} />
                </SelectTrigger>
                <SelectContent>
                  {availablePriceTables.length === 0 ? (
                    <div className="px-2 py-1.5 text-[10px] text-slate-400">
                      {isZh ? '无可用价格表' : 'No available price table'}
                    </div>
                  ) : (
                    availablePriceTables.map(pt => (
                      <SelectItem key={pt.id} value={pt.id} className="text-[10px]">
                        {pt.name} ({pt.currency})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(constraintAnalysis.conflicts.length > 0 || constraintAnalysis.repairSuggestions.length > 0 || constraintAnalysis.activeEnableRuleIds.length > 0) && (
            <div className="border rounded-lg p-3 mb-2 bg-amber-50/60 border-amber-200">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isZh ? '规则引擎提示' : 'Rule Engine Notice'}
              </div>
              {constraintAnalysis.activeEnableRuleIds.length > 0 && (
                <p className="text-[11px] text-amber-700">
                  {isZh
                    ? `已触发 ${constraintAnalysis.activeEnableRuleIds.length} 条启用规则，部分选项范围已自动收敛。`
                    : `${constraintAnalysis.activeEnableRuleIds.length} enable rules are active; some option ranges were auto-constrained.`}
                </p>
              )}
              {constraintAnalysis.conflicts.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  {isZh
                    ? `检测到 ${constraintAnalysis.conflicts.length} 组排除冲突，系统已尝试自动修复，请确认当前配置。`
                    : `${constraintAnalysis.conflicts.length} exclusion conflicts detected. Auto-repair has been applied; please verify current configuration.`}
                </p>
              )}
              {constraintAnalysis.repairSuggestions.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-800 space-y-0.5">
                  {constraintAnalysis.repairSuggestions.slice(0, 3).map((suggestion, idx) => (
                    <div key={`${suggestion.category_code}-${idx}`}>
                      {isZh ? '建议' : 'Suggestion'}: {suggestion.category_code} {isZh ? '从' : 'from'} {suggestion.from_option_code}
                      {suggestion.to_option_code ? (isZh ? ` 调整为 ${suggestion.to_option_code}` : ` -> ${suggestion.to_option_code}`) : (isZh ? ' 取消当前值' : ' clear current value')} ({suggestion.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toggle buttons for showing hidden items - 暂时注释掉
          {Object.keys(hiddenCountBySuper).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(hiddenCountBySuper).map(([scId, info]) => {
                const id = Number(scId);
                const isShowing = showHiddenGroups[id] || false;
                return (
                  <Button
                    key={id}
                    variant={isShowing ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => toggleShowHidden(id)}
                  >
                    {isShowing ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isShowing ? `隐藏` : `显示`}隐藏的{info.name}
                    <Badge variant="secondary" className="text-[8px] h-3.5 ml-1">{info.count}</Badge>
                  </Button>
                );
              })}
            </div>
          )} */}

          <Accordion type="multiple" defaultValue={visibleGroups.map((_, i) => `cg-${i}`)} className="space-y-2">
            {visibleGroups.map((group, groupIdx) => {
              const isReadOnly = isSuperCategoryReadOnly(group.super_category_id);
              const isGroupHidden = group.hide;
              const showHidden = showHiddenGroups[group.super_category_id] || false;

              // Determine visible categories
              const visibleCats = group.categories.filter(c => {
                if (!c.hide) return true;
                // Show hidden categories if toggle is on for this super category
                if (showHidden && canShowHiddenItems(group.super_category_id)) return true;
                return false;
              });
              if (visibleCats.length === 0) return null;

              const hasPricing = isSuperCategoryPriced(group.super_category_id);
              const canCustom = supportsCustomInput(group.super_category_id);

              return (
                <AccordionItem key={`${group.super_category_id}-${groupIdx}`} value={`cg-${groupIdx}`} className={`border rounded-lg ${isGroupHidden ? 'border-dashed border-amber-300 bg-amber-50/30' : ''}`}>
                  <AccordionTrigger className="px-3 py-2 text-xs font-semibold hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      {isReadOnly && <Lock className="w-3 h-3 text-slate-400" />}
                      <span className={isGroupHidden ? 'text-amber-600' : ''}>
                        {group.super_category_name}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4">{visibleCats.length} {isZh ? '项' : 'items'}</Badge>
                      {isReadOnly && (
                        <Badge variant="outline" className="text-[10px] h-4 text-slate-500 border-slate-300">{isZh ? '只读' : 'Read-only'}</Badge>
                      )}
                      {isGroupHidden && (
                        <Badge variant="outline" className="text-[10px] h-4 text-amber-600 border-amber-300">{isZh ? '已隐藏' : 'Hidden'}</Badge>
                      )}
                      {canCustom && (
                        <Badge variant="outline" className="text-[10px] h-4 text-blue-500 border-blue-300">{isZh ? '支持自定义' : 'Customizable'}</Badge>
                      )}
                      <div className="flex-1" />
                      {/* Category visibility toggle button at super category level - 暂时注释掉
                      {canShowHiddenItems(group.super_category_id) && group.categories.some(c => c.hide) && (
                        <div className="flex items-center gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={showHidden ? 'default' : 'outline'}
                            size="sm"
                            className="h-5 text-[9px] px-1.5 text-amber-600 border-amber-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleShowHidden(group.super_category_id);
                            }}
                          >
                            {showHidden ? <EyeOff className="w-3 h-3 mr-0.5" /> : <Eye className="w-3 h-3 mr-0.5" />}
                            {showHidden ? '隐藏' : '显示'}配置项({group.categories.filter(c => c.hide).length})
                          </Button>
                        </div>
                      )} */}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="space-y-3">
                      {visibleCats.map((cat) => {
                        const isCatHidden = cat.hide;
                        // For 基础参数 and 标准化版本, only show the selected (default) option
                        const isCompactSingle = group.super_category_name === '基础参数' || group.super_category_name === '标准化版本';
                        // Show all options if "show hidden" is on for this category or super category, otherwise only visible
                        const shouldShowHidden = showHiddenOptionsForCategory[cat.category_code] || 
                          (showHidden && canShowHiddenItems(group.super_category_id));
                        let displayOptions = shouldShowHidden
                          ? cat.options
                          : cat.options.filter(o => !o.hide);
                        // For 基础参数 and 标准化版本, only show the default/selected option
                        if (isCompactSingle) {
                          const selectedOpt = displayOptions.find(o => o.is_default) || displayOptions[0];
                          displayOptions = selectedOpt ? [selectedOpt] : [];
                        }
                        if (displayOptions.length === 0) return null;

                        const selectedCode = selections[cat.category_code] || '';
                        const hasCustom = isCustomActive(cat.category_code);
                        const customEntry = customEntries.find(e => e.category_code === cat.category_code);
                        const showingCustomInput = customInputVisible[cat.category_code];
                        const disabledOptionCount = Object.keys(constraintAnalysis.disabledReasons[cat.category_code] || {}).length;

                        return (
                          <div key={cat.category_id} className={`border rounded p-2 ${
                            isCatHidden ? 'bg-amber-50/50 border-dashed border-amber-200' :
                            hasCustom ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50'
                          }`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              {isReadOnly && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                              <span className="text-[11px] font-medium text-slate-700">{cat.category_name}</span>
                              {isCatHidden && (
                                <Badge variant="outline" className="text-[9px] h-4 text-amber-500 border-amber-300">{isZh ? '隐藏项' : 'Hidden Item'}</Badge>
                              )}
                              {!selectedCode && !hasCustom && !isReadOnly && (
                                <Badge variant="outline" className="text-[9px] h-4 text-orange-500 border-orange-300">{isZh ? '未选择' : 'Not Selected'}</Badge>
                              )}
                              <div className="flex-1" />
                              {/* Option visibility toggle button at category level - 暂时注释掉
                              {canShowHiddenItems(group.super_category_id) && cat.options.some(o => o.hide) && (
                                <Button
                                  variant={showHidden ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-5 text-[9px] px-1.5 text-amber-600 border-amber-300"
                                  onClick={() => toggleShowHidden(group.super_category_id)}
                                >
                                  {showHidden ? <EyeOff className="w-3 h-3 mr-0.5" /> : <Eye className="w-3 h-3 mr-0.5" />}
                                  {showHidden ? '隐藏' : '显示'}选项({cat.options.filter(o => o.hide).length})
                                </Button>
                              )} */}
                              {canCustom && !isReadOnly && !hasCustom && !showingCustomInput && (
                                <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 text-blue-600 hover:text-blue-700" onClick={() => toggleCustomInput(cat.category_code, cat.options.some(o => o.hide))}>
                                  <PenLine className="w-2.5 h-2.5" />{isZh ? '自定义' : 'Custom'}
                                </Button>
                              )}
                              {hasCustom && !isReadOnly && (
                                <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 text-amber-600 hover:text-amber-700" onClick={() => toggleCustomInput(cat.category_code)}>
                                  <X className="w-2.5 h-2.5" />{isZh ? '取消自定义' : 'Cancel Custom'}
                                </Button>
                              )}
                            </div>

                            {hasCustom && customEntry && (
                              <div className="bg-amber-100/50 border border-amber-200 rounded p-2 mb-1.5">
                                <div className="flex items-center gap-2 text-[11px]">
                                  <Badge variant="outline" className="text-[9px] h-4 border-amber-400 text-amber-700">{isZh ? '自定义' : 'Custom'}</Badge>
                                  <span className="text-amber-800">{customEntry.custom_text}</span>
                                  <span className="text-amber-600 text-[10px] ml-auto font-medium">{isZh ? '价格' : 'Price'}: ?</span>
                                </div>
                              </div>
                            )}

                            {/* Options list - always show first */}
                            {!hasCustom && (
                              <div className="mb-2">
                                {renderOptions(
                                  displayOptions.map(o => ({
                                    ...o,
                                    description: o.description + (o.hide ? (isZh ? ' (隐藏项)' : ' (Hidden)') : ''),
                                  })),
                                  cat.category_code,
                                  selectedCode,
                                  hasPricing,
                                  isReadOnly,
                                  group.super_category_id
                                )}
                              </div>
                            )}

                            {!hasCustom && disabledOptionCount > 0 && (
                              <div className="text-[10px] text-amber-700 mb-1">
                                {isZh
                                  ? `该特征有 ${disabledOptionCount} 个选项被规则限制，鼠标悬停可查看原因。`
                                  : `${disabledOptionCount} options are restricted by rules. Hover to see reasons.`}
                              </div>
                            )}

                            {/* Hidden options hint - shown after options when there are hidden options */}
                            {showHiddenHintFor === cat.category_code && (
                              <div className="bg-amber-50/50 border border-amber-200 rounded p-2 mb-2">
                                <div className="flex items-center gap-2 text-[11px] text-amber-700">
                                  <Eye className="w-3 h-3" />
                                  <span>{isZh
                                    ? `该配置项隐藏的 ${cat.options.filter(o => o.hide).length} 个选项已显示，若仍不满足要求，请输入自定义配置`
                                    : `${cat.options.filter(o => o.hide).length} hidden options are shown. If still not suitable, please enter a custom requirement.`}</span>
                                </div>
                              </div>
                            )}

                            {/* Custom input - always shown at the end when enabled */}
                            {showingCustomInput && !hasCustom && (
                              <div className="bg-blue-50/50 border border-blue-200 rounded p-2">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] text-blue-700">{isZh ? '输入特殊要求：' : 'Enter custom requirement:'}</Label>
                                  <Textarea
                                    value={customInputText[cat.category_code] || ''}
                                    onChange={(e) => setCustomInputText(prev => ({ ...prev, [cat.category_code]: e.target.value }))}
                                    className="h-16 text-[11px] resize-none"
                                    placeholder={isZh ? '请描述您的特殊配置需求...' : 'Describe your custom configuration needs...'}
                                  />
                                  <div className="flex gap-1 justify-end">
                                    <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => {
                                      setCustomInputVisible(prev => ({ ...prev, [cat.category_code]: false }));
                                      setCustomInputText(prev => ({ ...prev, [cat.category_code]: '' }));
                                    }}>{isZh ? '取消' : 'Cancel'}</Button>
                                    <Button size="sm" className="h-6 text-[10px]" onClick={() => confirmCustomInput(cat.category_code, cat.category_name, group.super_category_id)} disabled={!customInputText[cat.category_code]?.trim()}>{isZh ? '确认' : 'Confirm'}</Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        <div className="w-[280px] shrink-0 overflow-y-auto">
          <PricePanel />
        </div>
      </div>
    </div>
  );
}

export default function Configurator() {
  const { configStage } = useCPQStore();

  if (configStage === 'series') {
    return <SeriesSelector />;
  }

  if (configStage === 'model') {
    return <ModelSelector />;
  }

  return <OptionsConfigurator />;
}