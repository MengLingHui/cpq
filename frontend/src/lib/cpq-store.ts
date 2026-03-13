import { create } from 'zustand';
import type {
  MarketModel,
  EngineerModel,
  PriceTable,
  SavedConfiguration,
  ConfigDetailsByNumberTable,
  ConfigDetailByNumber,
  ConfigDetailItem,
  PureProductQuoteSheet,
  PureProductQuoteItem,
  PureProductQuotePrintableDetail,
  CustomConfigEntry,
  SeriesInfo,
  ConfigStage,
  ConfigStatus,
} from './cpq-data';
import {
  loadMarketModels,
  loadPriceTables,
  loadSeriesData,
  loadEngineerModels,
  loadSavedConfigurations,
  loadConfigDetailsByNumber,
  loadPureProductQuoteSheets,
  saveDataToFile,
  cloneMarketModel,
  generatePriceMapFromTable,
  generateDefaultPriceTable,
  generateConfigFingerprint,
  generateConfigNumber,
  generateConfigSerial,
  generateOrderNumber,
  MODEL_BASE_PRICE,
  isSuperCategoryPriced,
  isConfigComplete,
  formatModelDisplayName,
} from './cpq-data';
import type { ConstraintAnalysis } from './cpq-rules';
import { analyzeConstraints, repairSelectionsByRules } from './cpq-rules';
import { formatDateTime, formatNumber, getActiveLocale } from './i18n';

interface ConfigSelection {
  [categoryCode: string]: string;
}

const EMPTY_CONSTRAINT_ANALYSIS: ConstraintAnalysis = {
  availableOptions: {},
  disabledReasons: {},
  activeEnableRuleIds: [],
  conflicts: [],
  invalidSelectedCategories: [],
  repairSuggestions: [],
};

function toCustomCategorySet(entries: CustomConfigEntry[]): Set<string> {
  return new Set(entries.map(entry => entry.category_code));
}

function applyConstraintResolution(
  model: MarketModel,
  selections: ConfigSelection,
  customEntries: CustomConfigEntry[],
  preferredCategoryCode?: string
): { selections: ConfigSelection; analysis: ConstraintAnalysis } {
  return repairSelectionsByRules(model, selections, toCustomCategorySet(customEntries), preferredCategoryCode);
}

function enforceMarketRulesInheritance(market: MarketModel, engineer?: EngineerModel): MarketModel {
  if (!engineer) {
    return market;
  }
  return {
    ...market,
    rules: [...engineer.rules],
  };
}

function ensureCategoryDefaultOption(market: MarketModel): MarketModel {
  return {
    ...market,
    configuration_groups: market.configuration_groups.map((group) => ({
      ...group,
      categories: group.categories.map((category) => {
        if (!category.options || category.options.length === 0) {
          return category;
        }

        let defaultIndex = category.options.findIndex((option) => option.is_default);
        if (defaultIndex < 0) {
          defaultIndex = 0;
        }

        return {
          ...category,
          options: category.options.map((option, index) => ({
            ...option,
            is_default: index === defaultIndex,
          })),
        };
      }),
    })),
  };
}

function isConfigSnapshotNewer(left: SavedConfiguration, right: SavedConfiguration): boolean {
  const leftVersion = left.version ?? 0;
  const rightVersion = right.version ?? 0;
  if (leftVersion !== rightVersion) {
    return leftVersion > rightVersion;
  }
  const leftTs = new Date(left.updated_at || left.saved_at || 0).getTime();
  const rightTs = new Date(right.updated_at || right.saved_at || 0).getTime();
  return leftTs > rightTs;
}

function buildConfigDetailEntry(config: SavedConfiguration, model: MarketModel): ConfigDetailByNumber {
  const customMap = new Map(config.custom_entries.map((entry) => [entry.category_code, entry]));
  const details: ConfigDetailItem[] = [];

  for (const group of model.configuration_groups) {
    for (const category of group.categories) {
      const customEntry = customMap.get(category.category_code);
      if (customEntry) {
        details.push({
          super_category_id: group.super_category_id,
          super_category_name: group.super_category_name,
          category_code: category.category_code,
          category_name: category.category_name,
          value_type: 'custom',
          custom_text: customEntry.custom_text || '',
        });
        continue;
      }

      const selectedCode = config.selections[category.category_code]
        || category.options.find((opt) => opt.is_default)?.option_code
        || category.options[0]?.option_code
        || '';
      const selectedOption = category.options.find((opt) => opt.option_code === selectedCode);

      if (selectedOption) {
        details.push({
          super_category_id: group.super_category_id,
          super_category_name: group.super_category_name,
          category_code: category.category_code,
          category_name: category.category_name,
          value_type: 'option',
          option_code: selectedOption.option_code,
          option_description: selectedOption.description,
        });
      } else {
        details.push({
          super_category_id: group.super_category_id,
          super_category_name: group.super_category_name,
          category_code: category.category_code,
          category_name: category.category_name,
          value_type: 'empty',
        });
      }
    }
  }

  return {
    config_number: config.config_number,
    engineer_model_name: config.engineer_model_name || config.model_name || '-',
    series_name: config.series_name || '-',
    series_description: config.series_description || config.series_name || '-',
    details,
  };
}

function buildConfigDetailsByNumberTable(
  savedConfigurations: SavedConfiguration[],
  marketModels: MarketModel[],
  fallback: ConfigDetailsByNumberTable = {}
): ConfigDetailsByNumberTable {
  const latestByNumber = new Map<string, SavedConfiguration>();

  for (const cfg of savedConfigurations) {
    const key = (cfg.config_number || '').trim();
    if (!key || key === '-') continue;

    const current = latestByNumber.get(key);
    if (!current || isConfigSnapshotNewer(cfg, current)) {
      latestByNumber.set(key, cfg);
    }
  }

  const nextTable: ConfigDetailsByNumberTable = {};
  for (const [configNumber, snapshot] of latestByNumber.entries()) {
    const model = marketModels.find((item) => item.model_id === snapshot.model_id);
    if (model) {
      nextTable[configNumber] = buildConfigDetailEntry(snapshot, model);
      continue;
    }
    if (fallback[configNumber]) {
      nextTable[configNumber] = fallback[configNumber];
    }
  }

  return nextTable;
}

interface CPQState {
  // Data
  engineerModels: EngineerModel[];
  marketModels: MarketModel[];
  priceTables: PriceTable[];
  priceMap: Record<string, number>;
  savedConfigurations: SavedConfiguration[];
  configDetailsByNumber: ConfigDetailsByNumberTable;
  pureProductQuoteSheets: PureProductQuoteSheet[];
  seriesList: SeriesInfo[];

  // Editing state
  editingMarketModel: MarketModel | null;
  editingModelIndex: number;

  // Configuration state - staged flow
  configStage: ConfigStage;
  selectedSeriesId: string;
  activeMarketModelIndex: number;
  selections: ConfigSelection;
  customEntries: CustomConfigEntry[];
  constraintAnalysis: ConstraintAnalysis;
  editingConfigId: string | null;

  // Navigation
  activeTab: string;
  editingNewModelIndex: number | null;

  // Loading
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  setEditingModel: (index: number) => void;
  updateEditingModel: (model: MarketModel) => void;
  saveEditingModel: () => void;
  cancelEditing: () => void;
  createMarketModelFromEngineer: (engineerIndex: number) => void;
  deleteMarketModel: (index: number) => void;
  clearEditingNewModelIndex: () => void;

  // Staged configuration flow
  selectSeries: (seriesId: string) => void;
  confirmSeriesAndPickModel: (modelIndex: number) => void;
  backToSeriesSelection: () => void;
  backToModelSelection: () => void;

  setActiveMarketModel: (index: number) => void;
  setSelection: (categoryCode: string, optionCode: string) => void;
  toggleSelection: (categoryCode: string, optionCode: string) => void;
  resetSelections: () => void;
  initializeDefaultSelections: () => void;

  // Custom entries
  addCustomEntry: (entry: CustomConfigEntry) => void;
  removeCustomEntry: (categoryCode: string) => void;
  updateCustomEntry: (categoryCode: string, text: string) => void;

  // Price tables
  addPriceTable: (table: PriceTable) => void;
  updatePriceTable: (table: PriceTable) => void;
  deletePriceTable: (id: string) => void;
  linkPriceTable: (modelIndex: number, priceTableId: string) => void;
  refreshPriceMap: () => void;
  changePriceTableInConfig: (priceTableId: string) => void;

  // Save configuration
  saveConfiguration: (mode?: 'new' | 'overwrite') => void;
  deleteConfiguration: (id: string) => void;
  confirmEtoFeasible: (id: string) => void;
  loadConfiguration: (config: SavedConfiguration) => void;
  clearEditingConfigContext: () => void;
  createPureProductQuoteSheetFromConfigs: (configIds: string[], name?: string) => PureProductQuoteSheet | null;
  deletePureProductQuoteSheet: (sheetId: string) => void;

  // Price calculation
  getBasePrice: () => number;
  getOptionsPrice: () => number;
  getTotalPrice: () => string;
  getCurrency: () => string;
  hasCustomEntries: () => boolean;
  isComplete: () => boolean;

  // Helpers
  getModelsForSeries: (seriesId: string) => MarketModel[];
  getSelectedSeries: () => SeriesInfo | undefined;
  getPriceTablesForEngineerModel: (engineerModelId: string | undefined) => PriceTable[];
  getEngineerModelName: (engineerModelId: string | undefined) => string;
  getActiveModelDisplayName: () => string;
  isOptionAvailable: (categoryCode: string, optionCode: string) => boolean;
  getOptionDisableReasons: (categoryCode: string, optionCode: string) => string[];
}

export const useCPQStore = create<CPQState>((set, get) => ({
  engineerModels: [],
  marketModels: [],
  priceTables: [],
  priceMap: {},
  savedConfigurations: [],
  configDetailsByNumber: {},
  pureProductQuoteSheets: [],
  seriesList: [],
  editingMarketModel: null,
  editingModelIndex: -1,
  configStage: 'series',
  selectedSeriesId: '',
  activeMarketModelIndex: -1,
  selections: {},
  customEntries: [],
  constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
  editingConfigId: null,
  activeTab: 'configurator',
  editingNewModelIndex: null,
  isLoading: true,

  initialize: async () => {
    try {
      const [marketModels, priceTables, seriesList, engineerModels, savedConfigurations, loadedConfigDetailsByNumber, pureProductQuoteSheets] = await Promise.all([
        loadMarketModels(),
        loadPriceTables(),
        loadSeriesData(),
        loadEngineerModels(),
        loadSavedConfigurations(),
        loadConfigDetailsByNumber(),
        loadPureProductQuoteSheets(),
      ]);

      // Use engineer models as-is (IDs should already be prefixed in JSON if needed)
      const allEngineers = engineerModels;

      // Use price tables as-is (engineer_model_id should match engineer model IDs)
      let allPriceTables: PriceTable[] = priceTables;

      // Process all market models and link with price tables
      const allMarkets: MarketModel[] = [];

      for (const marketModel of marketModels) {
        // Find the engineer model by ID (marketModel.engineer_model_id should match)
        const matchingEngineer = allEngineers.find(e => e.model_id === marketModel.engineer_model_id);
        const syncedMarket = enforceMarketRulesInheritance(marketModel, matchingEngineer);
        if (matchingEngineer) {
          // Ensure engineer_model_id is set correctly
          syncedMarket.engineer_model_id = matchingEngineer.model_id;
        }

        // Find matching price table by engineer_model_id
        const matchingPriceTableIndex = allPriceTables.findIndex(pt => 
          pt.engineer_model_id === syncedMarket.engineer_model_id
        );
        
        if (matchingPriceTableIndex >= 0) {
          const matchingPriceTable = allPriceTables[matchingPriceTableIndex];
          syncedMarket.price_table_id = matchingPriceTable.id;
        } else {
          // Fallback: generate default price table if no matching JSON price table
          const pt = generateDefaultPriceTable(syncedMarket, `${syncedMarket.model_name}默认价格表`, `${syncedMarket.model_name}默认配置价格`);
          if (matchingEngineer) {
            pt.engineer_model_id = matchingEngineer.model_id;
          }
          syncedMarket.price_table_id = pt.id;
          allPriceTables = [...allPriceTables, pt];
        }

        allMarkets.push(syncedMarket);
      }

      // Use first market model for initial price map
      const priceMap = allMarkets.length > 0 ? generatePriceMapFromTable(allMarkets[0], allPriceTables[0]) : {};
      const configDetailsByNumber = buildConfigDetailsByNumberTable(savedConfigurations, allMarkets, loadedConfigDetailsByNumber);
      if (JSON.stringify(configDetailsByNumber) !== JSON.stringify(loadedConfigDetailsByNumber)) {
        saveDataToFile('config_details_by_number.json', configDetailsByNumber).catch(console.error);
      }

      set({
        engineerModels: allEngineers,
        marketModels: allMarkets,
        priceTables: allPriceTables,
        priceMap,
        seriesList,
        savedConfigurations,
        configDetailsByNumber,
        pureProductQuoteSheets,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load CPQ data:', error);
      set({ isLoading: false });
    }
  },

  setActiveTab: (tab: string) => {
    set({ activeTab: tab });
  },

  setEditingModel: (index: number) => {
    const { marketModels } = get();
    if (index >= 0 && index < marketModels.length) {
      set({
        editingMarketModel: cloneMarketModel(marketModels[index]),
        editingModelIndex: index,
      });
    }
  },

  updateEditingModel: (model: MarketModel) => {
    set({ editingMarketModel: model });
  },

  saveEditingModel: () => {
    const { editingMarketModel, editingModelIndex, marketModels, engineerModels } = get();
    if (editingMarketModel && editingModelIndex >= 0) {
      const newModels = [...marketModels];
      const matchingEngineer = engineerModels.find(e => e.model_id === editingMarketModel.engineer_model_id);
      const modelWithDefaultOption = ensureCategoryDefaultOption(editingMarketModel);
      newModels[editingModelIndex] = enforceMarketRulesInheritance(modelWithDefaultOption, matchingEngineer);
      set({
        marketModels: newModels,
        editingMarketModel: null,
        editingModelIndex: -1,
      });
      get().refreshPriceMap();
      // Auto-save to file
      saveDataToFile('market_model.json', newModels).catch(console.error);
    }
  },

  cancelEditing: () => {
    set({ editingMarketModel: null, editingModelIndex: -1 });
  },

  createMarketModelFromEngineer: (engineerIndex: number) => {
    const { engineerModels, marketModels, priceTables } = get();
    if (engineerIndex >= 0 && engineerIndex < engineerModels.length) {
      const eng = engineerModels[engineerIndex];
      // Find a price table linked to the same engineer model
      const matchingPT = priceTables.find(pt => pt.engineer_model_id === eng.model_id);
      const newMarket: MarketModel = {
        model_id: `market_${Date.now()}`,
        model_name: `${eng.model_name}-S`,
        product_series: eng.product_series,
        series_info: { ...eng.series_info },
        configuration_groups: JSON.parse(JSON.stringify(eng.configuration_groups)),
        rules: [...eng.rules],
        price_table_id: matchingPT?.id,
        engineer_model_id: eng.model_id,
      };
      const newModels = [...marketModels, ensureCategoryDefaultOption(newMarket)];
      const newIndex = newModels.length - 1;
      set({
        marketModels: newModels,
        activeTab: 'market',
        editingNewModelIndex: newIndex,
      });
      // Auto-save to file
      saveDataToFile('market_model.json', newModels).catch(console.error);
    }
  },

  deleteMarketModel: (index: number) => {
    const { marketModels, activeMarketModelIndex } = get();
    if (index < 0 || index >= marketModels.length) return;
    const newModels = marketModels.filter((_, i) => i !== index);
    let newActiveIndex = activeMarketModelIndex;
    if (newActiveIndex >= newModels.length) {
      newActiveIndex = Math.max(0, newModels.length - 1);
    }
    set({
      marketModels: newModels,
      activeMarketModelIndex: newActiveIndex,
    });
    // Auto-save to file
    saveDataToFile('market_model.json', newModels).catch(console.error);
  },

  clearEditingNewModelIndex: () => {
    set({ editingNewModelIndex: null });
  },

  // Staged configuration flow
  selectSeries: (seriesId: string) => {
    set({
      selectedSeriesId: seriesId,
      configStage: 'model',
      activeMarketModelIndex: -1,
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
    });
  },

  confirmSeriesAndPickModel: (modelIndex: number) => {
    set({
      activeMarketModelIndex: modelIndex,
      configStage: 'options',
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
    });
    get().initializeDefaultSelections();
    get().refreshPriceMap();
  },

  backToSeriesSelection: () => {
    set({
      configStage: 'series',
      // Keep selectedSeriesId to maintain the navigation path
      activeMarketModelIndex: -1,
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
    });
  },

  backToModelSelection: () => {
    set({
      configStage: 'model',
      activeMarketModelIndex: -1,
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
    });
  },

  setActiveMarketModel: (index: number) => {
    set({
      activeMarketModelIndex: index,
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
    });
    get().initializeDefaultSelections();
    get().refreshPriceMap();
  },

  setSelection: (categoryCode: string, optionCode: string) => {
    const { customEntries, marketModels, activeMarketModelIndex, selections } = get();
    const filtered = customEntries.filter(e => e.category_code !== categoryCode);
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    const nextSelections = { ...selections, [categoryCode]: optionCode };
    const resolved = applyConstraintResolution(model, nextSelections, filtered, categoryCode);

    set({
      selections: resolved.selections,
      customEntries: filtered,
      constraintAnalysis: resolved.analysis,
    });
  },

  toggleSelection: (categoryCode: string, optionCode: string) => {
    const { selections, customEntries, marketModels, activeMarketModelIndex } = get();
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    const currentSelection = selections[categoryCode];
    if (currentSelection === optionCode) {
      const newSelections = { ...selections };
      delete newSelections[categoryCode];
      const resolved = applyConstraintResolution(model, newSelections, customEntries, categoryCode);
      set({
        selections: resolved.selections,
        constraintAnalysis: resolved.analysis,
      });
    } else {
      const filtered = customEntries.filter(e => e.category_code !== categoryCode);
      const nextSelections = { ...selections, [categoryCode]: optionCode };
      const resolved = applyConstraintResolution(model, nextSelections, filtered, categoryCode);
      set({
        selections: resolved.selections,
        customEntries: filtered,
        constraintAnalysis: resolved.analysis,
      });
    }
  },

  resetSelections: () => {
    set({ selections: {}, customEntries: [], constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS });
    get().initializeDefaultSelections();
  },

  initializeDefaultSelections: () => {
    const { marketModels, activeMarketModelIndex } = get();
    if (marketModels.length === 0 || activeMarketModelIndex < 0) return;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    const defaults: ConfigSelection = {};
    for (const group of model.configuration_groups) {
      for (const category of group.categories) {
        if (category.hide) continue;
        const visibleOptions = category.options.filter(o => !o.hide);
        const defaultOption = visibleOptions.find(o => o.is_default);
        if (defaultOption) {
          defaults[category.category_code] = defaultOption.option_code;
        } else if (visibleOptions.length > 0) {
          defaults[category.category_code] = visibleOptions[0].option_code;
        }
      }
    }
    const resolved = applyConstraintResolution(model, defaults, []);
    set({
      selections: resolved.selections,
      customEntries: [],
      constraintAnalysis: resolved.analysis,
    });
  },

  addCustomEntry: (entry: CustomConfigEntry) => {
    const { customEntries, selections, marketModels, activeMarketModelIndex } = get();
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    const filtered = customEntries.filter(e => e.category_code !== entry.category_code);
    const newSelections = { ...selections };
    delete newSelections[entry.category_code];
    const updatedCustomEntries = [...filtered, entry];
    const analysis = analyzeConstraints(model, newSelections, toCustomCategorySet(updatedCustomEntries));
    set({
      customEntries: updatedCustomEntries,
      selections: newSelections,
      constraintAnalysis: analysis,
    });
  },

  removeCustomEntry: (categoryCode: string) => {
    const { customEntries, marketModels, activeMarketModelIndex, selections } = get();
    const updatedCustomEntries = customEntries.filter(e => e.category_code !== categoryCode);
    if (activeMarketModelIndex < 0) return;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    const nextSelections = { ...selections };
    for (const group of model.configuration_groups) {
      for (const cat of group.categories) {
        if (cat.category_code === categoryCode && !cat.hide) {
          const visibleOptions = cat.options.filter(o => !o.hide);
          const defaultOption = visibleOptions.find(o => o.is_default) || visibleOptions[0];
          if (defaultOption) {
            nextSelections[categoryCode] = defaultOption.option_code;
          }
        }
      }
    }

    const resolved = applyConstraintResolution(model, nextSelections, updatedCustomEntries, categoryCode);
    set({
      customEntries: updatedCustomEntries,
      selections: resolved.selections,
      constraintAnalysis: resolved.analysis,
    });
  },

  updateCustomEntry: (categoryCode: string, text: string) => {
    const { customEntries } = get();
    set({
      customEntries: customEntries.map(e =>
        e.category_code === categoryCode ? { ...e, custom_text: text } : e
      ),
    });
  },

  addPriceTable: (table: PriceTable) => {
    set((state) => ({ priceTables: [...state.priceTables, table] }));
    // Auto-save to file
    saveDataToFile('price_table.json', get().priceTables).catch(console.error);
  },

  updatePriceTable: (table: PriceTable) => {
    set((state) => ({
      priceTables: state.priceTables.map(t => t.id === table.id ? table : t),
    }));
    get().refreshPriceMap();
    // Auto-save to file
    saveDataToFile('price_table.json', get().priceTables).catch(console.error);
  },

  deletePriceTable: (id: string) => {
    set((state) => ({
      priceTables: state.priceTables.filter(t => t.id !== id),
    }));
    // Auto-save to file
    saveDataToFile('price_table.json', get().priceTables).catch(console.error);
  },

  linkPriceTable: (modelIndex: number, priceTableId: string) => {
    const { marketModels } = get();
    if (modelIndex >= 0 && modelIndex < marketModels.length) {
      const model = marketModels[modelIndex];
      const newModels = [...marketModels];
      newModels[modelIndex] = { ...model, price_table_id: priceTableId };
      set({ marketModels: newModels });
      get().refreshPriceMap();
      // Auto-save to file
      saveDataToFile('market_model.json', newModels).catch(console.error);
    }
  },

  refreshPriceMap: () => {
    const { marketModels, activeMarketModelIndex, priceTables } = get();
    if (activeMarketModelIndex < 0) return;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;
    const pt = priceTables.find(t => t.id === model.price_table_id) || null;
    const priceMap = generatePriceMapFromTable(model, pt);
    set({ priceMap });
  },

  changePriceTableInConfig: (priceTableId: string) => {
    const { marketModels, activeMarketModelIndex, priceTables } = get();
    if (activeMarketModelIndex < 0) return;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return;

    // Update the model's price_table_id
    const newModels = [...marketModels];
    newModels[activeMarketModelIndex] = { ...model, price_table_id: priceTableId };

    set({ marketModels: newModels });

    // Refresh price map with new table
    const pt = priceTables.find(t => t.id === priceTableId) || null;
    const priceMap = generatePriceMapFromTable(newModels[activeMarketModelIndex], pt);
    set({ priceMap });
    // Auto-save to file
    saveDataToFile('market_model.json', newModels).catch(console.error);
  },

  saveConfiguration: (mode = 'new') => {
    const {
      marketModels,
      activeMarketModelIndex,
      selections,
      customEntries,
      priceMap,
      priceTables,
      savedConfigurations,
      configStage,
      selectedSeriesId,
      seriesList,
      editingConfigId,
    } = get();

    const existingRecord = editingConfigId
      ? savedConfigurations.find((cfg) => cfg.id === editingConfigId)
      : undefined;
    const shouldOverwrite = mode === 'overwrite' && !!editingConfigId && !!existingRecord;
    const nextConfigId = shouldOverwrite ? editingConfigId! : `cfg_${Date.now()}`;

    const upsertConfigs = (config: SavedConfiguration): SavedConfiguration[] => {
      if (shouldOverwrite) {
        return savedConfigurations.map((item) => (item.id === config.id ? config : item));
      }
      return [...savedConfigurations, config];
    };

    console.log('[saveConfiguration] Called with configStage:', configStage, 'selectedSeriesId:', selectedSeriesId, 'activeMarketModelIndex:', activeMarketModelIndex);

    const selectedSeries = seriesList.find(s => s.series_id === selectedSeriesId);
    const seriesName = selectedSeries?.series_name || '';
    const seriesDescription = selectedSeries?.series_description || '';

    // Determine status based on current stage
    const getStatus = (stage: ConfigStage, complete: boolean): ConfigStatus => {
      if (complete) return 'completed';
      if (stage === 'series') return 'series_confirming';
      if (stage === 'model') return 'model_confirming';
      return 'options_incomplete';
    };

    // Save at series stage (selected a series but haven't picked a model yet)
    if (configStage === 'series' && selectedSeriesId) {
      console.log('[saveConfiguration] Saving at series stage');
      const config: SavedConfiguration = {
        id: nextConfigId,
        model_id: '',
        model_name: '',
        price_table_id: '',
        price_table_name: '',
        currency: '¥',
        selections: {},
        custom_entries: [],
        base_price: 0,
        options_price: 0,
        total_price: '-',
        has_custom: false,
        order_number: '-',
        saved_at: new Date().toISOString(),
        is_complete: false,
        config_number: '-',
        stage: 'series',
        series_id: selectedSeriesId,
        series_name: seriesName,
        series_description: seriesDescription,
        status: 'series_confirming',
        updated_at: new Date().toISOString(),
        source_config_id: shouldOverwrite ? existingRecord?.source_config_id : (editingConfigId || undefined),
        version: shouldOverwrite ? (existingRecord?.version ?? 1) + 1 : 1,
      };
      const newConfigs = upsertConfigs(config);
      const detailsTable = buildConfigDetailsByNumberTable(newConfigs, marketModels, get().configDetailsByNumber);
      set({
        savedConfigurations: newConfigs,
        configDetailsByNumber: detailsTable,
        // Jump back to initial page
        configStage: 'series',
        selectedSeriesId: '',
        activeMarketModelIndex: -1,
        selections: {},
        customEntries: [],
        constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
        editingConfigId: null,
      });
      // Auto-save to file
      saveDataToFile('saved_configurations.json', newConfigs).catch(console.error);
      saveDataToFile('config_details_by_number.json', detailsTable).catch(console.error);
      return;
    }

    if (configStage === 'model') {
      console.log('[saveConfiguration] Saving at model stage');
      // Saved at model selection stage - confirmed product line but not model
      const config: SavedConfiguration = {
        id: nextConfigId,
        model_id: '',
        model_name: '',
        price_table_id: '',
        price_table_name: '',
        currency: '¥',
        selections: {},
        custom_entries: [],
        base_price: 0,
        options_price: 0,
        total_price: '-',
        has_custom: false,
        order_number: '-',
        saved_at: new Date().toISOString(),
        is_complete: false,
        config_number: '-',
        stage: 'model',
        series_id: selectedSeriesId,
        series_name: seriesName,
        series_description: seriesDescription,
        status: 'model_confirming',
        updated_at: new Date().toISOString(),
        source_config_id: shouldOverwrite ? existingRecord?.source_config_id : (editingConfigId || undefined),
        version: shouldOverwrite ? (existingRecord?.version ?? 1) + 1 : 1,
      };
      const newConfigs = upsertConfigs(config);
      const detailsTable = buildConfigDetailsByNumberTable(newConfigs, marketModels, get().configDetailsByNumber);
      set({
        savedConfigurations: newConfigs,
        configDetailsByNumber: detailsTable,
        // Jump back to initial page
        configStage: 'series',
        selectedSeriesId: '',
        activeMarketModelIndex: -1,
        selections: {},
        customEntries: [],
        constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
        editingConfigId: null,
      });
      // Auto-save to file
      saveDataToFile('saved_configurations.json', newConfigs).then(() => {
        console.log('Saved configurations to file, count:', newConfigs.length);
      }).catch(err => {
        console.error('Failed to save configurations:', err);
      });
      saveDataToFile('config_details_by_number.json', detailsTable).catch(console.error);
      return;
    }

    // Stage: options (model selected)
    console.log('[saveConfiguration] Saving at options stage');
    const model = marketModels[activeMarketModelIndex];
    if (!model) {
      console.log('[saveConfiguration] No model found, returning');
      return;
    }

    const pt = priceTables.find(t => t.id === model.price_table_id);
    const currency = pt?.currency || '¥';
    const hasCustom = customEntries.length > 0;
    const complete = isConfigComplete(model, selections, customEntries);

    let optionsPrice = 0;
    for (const group of model.configuration_groups) {
      if (group.hide || !isSuperCategoryPriced(group.super_category_id)) continue;
      for (const cat of group.categories) {
        if (cat.hide) continue;
        const isCustom = customEntries.some(e => e.category_code === cat.category_code);
        if (isCustom) continue;
        const selectedCode = selections[cat.category_code];
        if (selectedCode) {
          optionsPrice += priceMap[selectedCode] || 0;
        }
      }
    }

    const basePrice = MODEL_BASE_PRICE;
    const knownTotal = basePrice + optionsPrice;
    const formattedTotal = `${currency}${formatNumber(knownTotal)}`;

    const readyForConfigNumber = complete && !hasCustom;
    const status = getStatus('options', complete);

    // Use model's series info for description
    const modelSeriesDesc = seriesList.find(s => s.series_id === model.series_info.series_id)?.series_description
      || model.series_info.series_description || '';

    // Get engineer model name for display
    const engName = model.engineer_model_name || get().getEngineerModelName(model.engineer_model_id);
    const existingOrderNumber = shouldOverwrite ? existingRecord?.order_number : undefined;
    const fingerprint = generateConfigFingerprint(
      engName || model.model_name,
      selections,
      customEntries,
    );

    const existingFingerprint = existingRecord
      ? generateConfigFingerprint(
        existingRecord.engineer_model_name || existingRecord.model_name || 'MODEL',
        existingRecord.selections || {},
        existingRecord.custom_entries || [],
      )
      : '';

    const reusedConfig = savedConfigurations.find((cfg) => {
      if (!cfg.is_complete) return false;
      if (shouldOverwrite && cfg.id === existingRecord?.id) return false;
      if (!cfg.config_number || cfg.config_number === '-') return false;
      const cfgFingerprint = generateConfigFingerprint(
        cfg.engineer_model_name || cfg.model_name || 'MODEL',
        cfg.selections || {},
        cfg.custom_entries || [],
      );
      return cfgFingerprint === fingerprint;
    });

    // Order number: always 6-digit increasing serial (overwrite keeps existing serial)
    const orderNumber = complete
      ? (
        existingOrderNumber
        || generateOrderNumber(savedConfigurations)
      )
      : existingOrderNumber;

    // Config number: reuse for same fingerprint, otherwise engineer model + independent config serial
    const configNumber = readyForConfigNumber
      ? (
        ((existingRecord?.config_number && existingRecord.config_number !== '-' && existingFingerprint === fingerprint)
          ? existingRecord.config_number
          : undefined)
        || reusedConfig?.config_number
        || generateConfigNumber(engName || model.model_name, generateConfigSerial(savedConfigurations))
      )
      : '-';

    const config: SavedConfiguration = {
      id: nextConfigId,
      model_id: model.model_id,
      model_name: model.model_name,
      engineer_model_name: engName,
      price_table_id: model.price_table_id || '',
      price_table_name: pt?.name || '未关联',
      currency,
      selections: { ...selections },
      custom_entries: [...customEntries],
      base_price: basePrice,
      options_price: optionsPrice,
      total_price: hasCustom ? `${formattedTotal} + ?` : formattedTotal,
      has_custom: hasCustom,
      order_number: orderNumber || '-',
      saved_at: new Date().toISOString(),
      is_complete: complete,
      config_number: configNumber,
      stage: 'options',
      series_id: model.series_info.series_id,
      series_name: model.series_info.series_name,
      series_description: modelSeriesDesc,
      status,
      updated_at: new Date().toISOString(),
      source_config_id: shouldOverwrite ? existingRecord?.source_config_id : (editingConfigId || undefined),
      version: shouldOverwrite ? (existingRecord?.version ?? 1) + 1 : 1,
    };

    const newConfigs = upsertConfigs(config);
    const detailsTable = buildConfigDetailsByNumberTable(newConfigs, marketModels, get().configDetailsByNumber);

    set({
      savedConfigurations: newConfigs,
      configDetailsByNumber: detailsTable,
      // Jump back to initial page
      configStage: 'series',
      selectedSeriesId: '',
      activeMarketModelIndex: -1,
      selections: {},
      customEntries: [],
      constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
      editingConfigId: null,
    });
    // Auto-save to file
    saveDataToFile('saved_configurations.json', newConfigs).then(() => {
      console.log('Saved configurations to file, count:', newConfigs.length);
    }).catch(err => {
      console.error('Failed to save configurations:', err);
    });
    saveDataToFile('config_details_by_number.json', detailsTable).catch(console.error);
  },

  deleteConfiguration: (id: string) => {
    set((state) => {
      const newConfigs = state.savedConfigurations.filter(c => c.id !== id);
      const detailsTable = buildConfigDetailsByNumberTable(newConfigs, state.marketModels, state.configDetailsByNumber);
      // Auto-save to file
      saveDataToFile('saved_configurations.json', newConfigs).catch(console.error);
      saveDataToFile('config_details_by_number.json', detailsTable).catch(console.error);
      return {
        savedConfigurations: newConfigs,
        configDetailsByNumber: detailsTable,
      };
    });
  },

  confirmEtoFeasible: (id: string) => {
    const { savedConfigurations } = get();
    const target = savedConfigurations.find((cfg) => cfg.id === id);
    if (!target) return;

    const engineerModelName = target.engineer_model_name || target.model_name || 'MODEL';
    const targetFingerprint = generateConfigFingerprint(
      engineerModelName,
      target.selections || {},
      target.custom_entries || [],
    );

    const reusedConfig = savedConfigurations.find((cfg) => {
      if (cfg.id === id) return false;
      if (!cfg.is_complete) return false;
      if (!cfg.config_number || cfg.config_number === '-') return false;
      const cfgFingerprint = generateConfigFingerprint(
        cfg.engineer_model_name || cfg.model_name || 'MODEL',
        cfg.selections || {},
        cfg.custom_entries || [],
      );
      return cfgFingerprint === targetFingerprint;
    });

    // Order number: independent 6-digit increasing serial
    const orderNumber = target.order_number || generateOrderNumber(savedConfigurations);
    // Config number: reuse by fingerprint, otherwise engineer model + independent config serial
    const configNumber = (target.config_number && target.config_number !== '-')
      ? target.config_number
      : (reusedConfig?.config_number || generateConfigNumber(engineerModelName, generateConfigSerial(savedConfigurations)));

    const nextConfigs = savedConfigurations.map((cfg) => {
      if (cfg.id !== id) return cfg;
      return {
        ...cfg,
        order_number: orderNumber,
        config_number: configNumber,
        updated_at: new Date().toISOString(),
      };
    });

    const detailsTable = buildConfigDetailsByNumberTable(nextConfigs, get().marketModels, get().configDetailsByNumber);

    set({
      savedConfigurations: nextConfigs,
      configDetailsByNumber: detailsTable,
    });
    saveDataToFile('saved_configurations.json', nextConfigs).catch(console.error);
    saveDataToFile('config_details_by_number.json', detailsTable).catch(console.error);
  },

  loadConfiguration: (config: SavedConfiguration) => {
    const { marketModels } = get();
    const status = config.status || (config.is_complete ? 'completed' : 'options_incomplete');

    if (status === 'series_confirming') {
      // Resume from series stage - go back to series selection with the series expanded
      set({
        selectedSeriesId: config.series_id,
        configStage: 'series',
        activeMarketModelIndex: -1,
        selections: {},
        customEntries: [],
        constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
        editingConfigId: config.id,
        activeTab: 'configurator',
      });
      return;
    }

    if (status === 'model_confirming') {
      // Resume from model selection stage
      set({
        selectedSeriesId: config.series_id,
        configStage: 'model',
        activeMarketModelIndex: -1,
        selections: {},
        customEntries: [],
        constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
        editingConfigId: config.id,
        activeTab: 'configurator',
      });
      return;
    }

    // Resume from options/completed stage
    const modelIndex = marketModels.findIndex(m => m.model_id === config.model_id);
    if (modelIndex < 0) {
      // Model not found, go to model selection
      set({
        selectedSeriesId: config.series_id,
        configStage: 'model',
        activeMarketModelIndex: -1,
        selections: {},
        customEntries: [],
        constraintAnalysis: EMPTY_CONSTRAINT_ANALYSIS,
        editingConfigId: config.id,
        activeTab: 'configurator',
      });
      return;
    }

    const model = marketModels[modelIndex];
    const resolved = applyConstraintResolution(
      model,
      { ...config.selections },
      [...config.custom_entries]
    );

    set({
      selectedSeriesId: config.series_id,
      activeMarketModelIndex: modelIndex,
      configStage: 'options',
      selections: resolved.selections,
      customEntries: [...config.custom_entries],
      constraintAnalysis: resolved.analysis,
      editingConfigId: config.id,
      activeTab: 'configurator',
    });
    get().refreshPriceMap();
  },

  clearEditingConfigContext: () => {
    set({ editingConfigId: null });
  },

  createPureProductQuoteSheetFromConfigs: (configIds: string[], name?: string) => {
    const { savedConfigurations, marketModels, pureProductQuoteSheets } = get();
    if (!configIds.length) return null;

    const selectedConfigs = savedConfigurations.filter(cfg => configIds.includes(cfg.id));
    if (!selectedConfigs.length) return null;

    const items: PureProductQuoteItem[] = selectedConfigs.map((cfg) => {
      const model = marketModels.find(m => m.model_id === cfg.model_id);
      const printableDetails: PureProductQuotePrintableDetail[] = [];

      if (model) {
        for (const [categoryCode, optionCode] of Object.entries(cfg.selections)) {
          let matchedCategory: typeof model.configuration_groups[number]['categories'][number] | undefined;
          for (const group of model.configuration_groups) {
            const found = group.categories.find(c => c.category_code === categoryCode);
            if (found) {
              matchedCategory = found;
              break;
            }
          }
          if (!matchedCategory) continue;
          if (matchedCategory.print_enabled === false) continue;

          const matchedOption = matchedCategory.options.find(o => o.option_code === optionCode);
          if (!matchedOption) continue;

          printableDetails.push({
            category_code: categoryCode,
            category_name: matchedCategory.category_name,
            option_code: optionCode,
            option_description: matchedOption.description,
          });
        }
      }

      return {
        saved_config_id: cfg.id,
        saved_at: cfg.saved_at,
        model_name: cfg.model_name,
        engineer_model_name: cfg.engineer_model_name,
        series_name: cfg.series_description || cfg.series_name || '-',
        price_table_name: cfg.price_table_name || '-',
        currency: cfg.currency || '¥',
        base_price: cfg.base_price,
        options_price: cfg.options_price,
        total_price: cfg.total_price,
        has_custom: cfg.has_custom,
        printable_details: printableDetails,
      };
    });

    const totalsByCurrency: Record<string, number> = {};
    for (const item of items) {
      totalsByCurrency[item.currency] = (totalsByCurrency[item.currency] || 0) + item.base_price + item.options_price;
    }

    const now = new Date().toISOString();
    const sheet: PureProductQuoteSheet = {
      id: `ppq_${Date.now()}`,
      name: name?.trim() || (getActiveLocale() === 'en-US'
        ? `Quote-${formatDateTime(new Date())}`
        : `纯产品报价单-${formatDateTime(new Date())}`),
      source_config_ids: selectedConfigs.map(cfg => cfg.id),
      item_count: items.length,
      totals_by_currency: totalsByCurrency,
      items,
      created_at: now,
      updated_at: now,
    };

    const nextSheets = [sheet, ...pureProductQuoteSheets];
    set({ pureProductQuoteSheets: nextSheets });
    saveDataToFile('pure_product_quote_sheets.json', nextSheets).catch(console.error);
    return sheet;
  },

  deletePureProductQuoteSheet: (sheetId: string) => {
    set((state) => {
      const nextSheets = state.pureProductQuoteSheets.filter(sheet => sheet.id !== sheetId);
      saveDataToFile('pure_product_quote_sheets.json', nextSheets).catch(console.error);
      return { pureProductQuoteSheets: nextSheets };
    });
  },

  getBasePrice: () => MODEL_BASE_PRICE,

  getCurrency: () => {
    const { marketModels, activeMarketModelIndex, priceTables } = get();
    if (activeMarketModelIndex < 0) return '¥';
    const model = marketModels[activeMarketModelIndex];
    if (!model) return '¥';
    const pt = priceTables.find(t => t.id === model.price_table_id);
    return pt?.currency || '¥';
  },

  getOptionsPrice: () => {
    const { selections, priceMap, customEntries, marketModels, activeMarketModelIndex } = get();
    if (activeMarketModelIndex < 0) return 0;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return 0;

    let total = 0;
    for (const group of model.configuration_groups) {
      if (group.hide || !isSuperCategoryPriced(group.super_category_id)) continue;
      for (const cat of group.categories) {
        if (cat.hide) continue;
        const isCustom = customEntries.some(e => e.category_code === cat.category_code);
        if (isCustom) continue;
        const optionCode = selections[cat.category_code];
        if (optionCode) {
          total += priceMap[optionCode] || 0;
        }
      }
    }
    return total;
  },

  getTotalPrice: () => {
    const { customEntries } = get();
    const base = get().getBasePrice();
    const options = get().getOptionsPrice();
    const currency = get().getCurrency();
    const known = base + options;
    const formatted = `${currency}${formatNumber(known)}`;
    if (customEntries.length > 0) {
      return `${formatted} + ?`;
    }
    return formatted;
  },

  hasCustomEntries: () => {
    return get().customEntries.length > 0;
  },

  isComplete: () => {
    const { marketModels, activeMarketModelIndex, selections, customEntries } = get();
    if (activeMarketModelIndex < 0) return false;
    const model = marketModels[activeMarketModelIndex];
    if (!model) return false;
    return isConfigComplete(model, selections, customEntries);
  },

  getModelsForSeries: (seriesId: string) => {
    const { marketModels, seriesList } = get();
    // Find all series that belong to this series (including children)
    const targetIds = new Set<string>();
    const findChildren = (parentId: string) => {
      targetIds.add(parentId);
      for (const s of seriesList) {
        if (s.parent_series === parentId) {
          findChildren(s.series_id);
        }
      }
    };
    findChildren(seriesId);

    // Find series names
    const seriesNames = new Set<string>();
    for (const s of seriesList) {
      if (targetIds.has(s.series_id)) {
        seriesNames.add(s.series_name);
      }
    }

    return marketModels.filter(m =>
      seriesNames.has(m.product_series) || targetIds.has(m.series_info.series_id)
    );
  },

  getSelectedSeries: () => {
    const { seriesList, selectedSeriesId } = get();
    return seriesList.find(s => s.series_id === selectedSeriesId);
  },

  getPriceTablesForEngineerModel: (engineerModelId: string | undefined) => {
    const { priceTables } = get();
    if (!engineerModelId) return priceTables;
    return priceTables.filter(pt => pt.engineer_model_id === engineerModelId);
  },

  getEngineerModelName: (engineerModelId: string | undefined) => {
    const { engineerModels } = get();
    if (!engineerModelId) return '-';
    const eng = engineerModels.find(e => e.model_id === engineerModelId);
    return eng?.model_name || engineerModelId;
  },

  getActiveModelDisplayName: () => {
    const { marketModels, activeMarketModelIndex } = get();
    if (activeMarketModelIndex < 0) return '';
    const model = marketModels[activeMarketModelIndex];
    if (!model) return '';
    const engName = model.engineer_model_name || get().getEngineerModelName(model.engineer_model_id);
    return formatModelDisplayName(model.model_name, engName);
  },

  isOptionAvailable: (categoryCode: string, optionCode: string) => {
    const { constraintAnalysis } = get();
    const options = constraintAnalysis.availableOptions[categoryCode];
    if (!options) return true;
    return options.includes(optionCode);
  },

  getOptionDisableReasons: (categoryCode: string, optionCode: string) => {
    const { constraintAnalysis } = get();
    return constraintAnalysis.disabledReasons[categoryCode]?.[optionCode] || [];
  },
}));