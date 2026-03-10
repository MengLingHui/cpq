import { userStorage } from './utils';

// CPQ Data Types and Utilities

export interface SeriesInfo {
  series_id: string;
  series_name: string;
  series_description: string;
  parent_series: string;
}

export interface OptionItem {
  option_code: string;
  description: string;
  is_default: boolean;
  seq_id: number;
  hide: boolean;
}

export interface Category {
  category_id: number;
  category_code: string;
  category_name: string;
  super_category_id: number;
  super_category_name: string;
  options: OptionItem[];
  seq_id: number;
  hide: boolean;
}

export interface ConfigurationGroup {
  super_category_id: number;
  super_category_name: string;
  categories: Category[];
  seq_id: number;
  hide: boolean;
}

export interface MarketModel {
  model_id: string;
  model_name: string;
  product_series: string;
  series_info: SeriesInfo;
  configuration_groups: ConfigurationGroup[];
  rules: unknown[];
  price_table_id?: string; // linked price table
  engineer_model_id?: string; // linked engineer model
  engineer_model_name?: string; // linked engineer model name for display
}

export interface EngineerModel {
  model_id: string;
  model_name: string;
  product_series: string;
  series_info: SeriesInfo;
  configuration_groups: ConfigurationGroup[];
  rules: unknown[];
}

// Price table entry with description
export interface PriceTableEntry {
  option_code: string;
  description: string; // option description
  price: number;
}

export interface PriceTable {
  id: string;
  name: string;
  description: string;
  currency: string; // e.g. "¥", "$", "€"
  created_at: string;
  entries: PriceTableEntry[];
  engineer_model_id?: string; // linked engineer model
}

// Price data for each option
export interface OptionPrice {
  option_code: string;
  base_price: number;
  currency: string;
}

// Configuration progress stage
export type ConfigStage = 'series' | 'model' | 'options';

export const CONFIG_STAGE_LABELS: Record<ConfigStage, string> = {
  series: '产品线确认中',
  model: '机型确认中',
  options: '配置选项确认中',
};

// Status for saved configurations
export type ConfigStatus = 'series_confirming' | 'model_confirming' | 'options_incomplete' | 'completed';

export const CONFIG_STATUS_LABELS: Record<ConfigStatus, string> = {
  series_confirming: '产品线确认中',
  model_confirming: '机型确认中',
  options_incomplete: '配置确认中',
  completed: '选配完成',
};

// Saved configuration result
export interface SavedConfiguration {
  id: string;
  model_id: string;
  model_name: string;
  engineer_model_name?: string; // engineer model name for "工程机型(销售机型)" display
  price_table_id: string;
  price_table_name: string;
  currency: string;
  selections: Record<string, string>; // category_code -> option_code
  custom_entries: CustomConfigEntry[]; // custom entries
  base_price: number;
  options_price: number;
  total_price: string; // e.g. "¥285,000" or "$285,000 + ?"
  has_custom: boolean;
  saved_at: string;
  is_complete: boolean; // whether all categories have been selected
  config_number: string; // configuration number, "-" if not generated
  // New fields for staged configuration
  stage: ConfigStage; // current progress stage
  series_id: string;
  series_name: string;
  series_description: string; // e.g. "Articulated Boom" instead of "AB"
  status: ConfigStatus; // derived status for display
}

// Format model display name as "工程机型(销售机型)"
// If engineer model name is available and different from market model name, show "engName(marketName)"
// Otherwise just show the market model name
export function formatModelDisplayName(marketModelName: string, engineerModelName?: string): string {
  if (engineerModelName && engineerModelName !== '-' && engineerModelName !== marketModelName) {
    return `${engineerModelName}(${marketModelName})`;
  }
  return marketModelName;
}

// Custom configuration entry
export interface CustomConfigEntry {
  category_code: string;
  category_name: string;
  custom_text: string;
  super_category_id: number;
}

// Available currencies
export const CURRENCIES = [
  { code: '¥', label: '人民币 (¥)' },
  { code: '$', label: '美元 ($)' },
  { code: '€', label: '欧元 (€)' },
  { code: '£', label: '英镑 (£)' },
  { code: '₩', label: '韩元 (₩)' },
  { code: 'JPY ¥', label: '日元 (¥)' },
];

// Generate deterministic mock prices based on option_code
export function generateOptionPrice(optionCode: string): number {
  let hash = 0;
  for (let i = 0; i < optionCode.length; i++) {
    const char = optionCode.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const absHash = Math.abs(hash);
  const price = (absHash % 150) * 100;
  return price;
}

// Super category IDs that involve pricing
// 基础参数 (id:1), 标准化版本 (id:0) do NOT involve pricing
// 配置选择 (id:2), 制造属性 (id:3) involve pricing
const PRICED_SUPER_CATEGORIES = new Set([2, 3]);

export function isSuperCategoryPriced(superCategoryId: number): boolean {
  return PRICED_SUPER_CATEGORIES.has(superCategoryId);
}

// Super categories that are read-only (auto-selected, cannot be manually changed)
// 标准化版本 (id:0), 基础参数 (id:1) are read-only
const READONLY_SUPER_CATEGORIES = new Set([0, 1]);

export function isSuperCategoryReadOnly(superCategoryId: number): boolean {
  return READONLY_SUPER_CATEGORIES.has(superCategoryId);
}

// Super categories that support custom input
const CUSTOM_INPUT_SUPER_CATEGORIES = new Set([2, 3]); // 配置选择, 制造属性

export function supportsCustomInput(superCategoryId: number): boolean {
  return CUSTOM_INPUT_SUPER_CATEGORIES.has(superCategoryId);
}

// Super categories that can have hidden items shown during configuration
const HIDEABLE_SUPER_CATEGORIES = new Set([2, 3]); // 配置选择, 制造属性

export function canShowHiddenItems(superCategoryId: number): boolean {
  return HIDEABLE_SUPER_CATEGORIES.has(superCategoryId);
}

// Build a map of option_code -> description from a market model
export function buildOptionDescriptionMap(model: MarketModel): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of model.configuration_groups) {
    for (const category of group.categories) {
      for (const option of category.options) {
        map[option.option_code] = option.description;
      }
    }
  }
  return map;
}

// Generate price map from a price table for a market model
export function generatePriceMapFromTable(
  model: MarketModel,
  priceTable: PriceTable | null
): Record<string, number> {
  const priceMap: Record<string, number> = {};
  const tableEntries = new Map<string, number>();

  if (priceTable) {
    for (const entry of priceTable.entries) {
      tableEntries.set(entry.option_code, entry.price);
    }
  }

  for (const group of model.configuration_groups) {
    for (const category of group.categories) {
      for (const option of category.options) {
        if (isSuperCategoryPriced(group.super_category_id)) {
          priceMap[option.option_code] =
            tableEntries.get(option.option_code) ?? generateOptionPrice(option.option_code);
        } else {
          priceMap[option.option_code] = 0;
        }
      }
    }
  }
  return priceMap;
}

// Generate default price map (without price table)
export function generatePriceMap(model: MarketModel): Record<string, number> {
  return generatePriceMapFromTable(model, null);
}

// Generate a default price table from a market model
export function generateDefaultPriceTable(model: MarketModel, name: string, description: string): PriceTable {
  const entries: PriceTableEntry[] = [];
  for (const group of model.configuration_groups) {
    if (!isSuperCategoryPriced(group.super_category_id)) continue;
    for (const category of group.categories) {
      for (const option of category.options) {
        entries.push({
          option_code: option.option_code,
          description: option.description,
          price: generateOptionPrice(option.option_code),
        });
      }
    }
  }
  return {
    id: `pt_${Date.now()}`,
    name,
    description,
    currency: '¥',
    created_at: new Date().toISOString(),
    entries,
    engineer_model_id: model.engineer_model_id,
  };
}

// Generate a price table from an engineer model
export function generatePriceTableFromEngineer(engineerModel: EngineerModel, name: string, description: string): PriceTable {
  const entries: PriceTableEntry[] = [];
  for (const group of engineerModel.configuration_groups) {
    if (!isSuperCategoryPriced(group.super_category_id)) continue;
    for (const category of group.categories) {
      for (const option of category.options) {
        entries.push({
          option_code: option.option_code,
          description: option.description,
          price: generateOptionPrice(option.option_code),
        });
      }
    }
  }
  return {
    id: `pt_${Date.now()}`,
    name,
    description,
    currency: '¥',
    created_at: new Date().toISOString(),
    entries,
    engineer_model_id: engineerModel.model_id,
  };
}

// Load series data -优先从localStorage读取，如果没有则从JSON文件加载
export async function loadSeriesData(): Promise<SeriesInfo[]> {
  // 先尝试从localStorage读取（支持导入的数据）
  const localData = userStorage.get<SeriesInfo[]>('series', null);
  if (localData) {
    console.log('[Storage] 从localStorage加载series数据');
    return localData;
  }
  // 从JSON文件加载
  const response = await fetch('/data/series.json');
  const data = await response.json();
  return data as SeriesInfo[];
}

// Load market models from JSON -优先从localStorage读取
export async function loadMarketModels(): Promise<MarketModel[]> {
  // 同时支持复数和单数形式的键名（向后兼容旧备份文件）
  let localData = userStorage.get<MarketModel[]>('market_models', null);
  if (!localData) {
    localData = userStorage.get<MarketModel[]>('market_model', null);
  }
  if (localData) {
    console.log('[Storage] 从localStorage加载market_models数据');
    return localData;
  }
  const response = await fetch('/data/market_model.json');
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

// Load price tables from JSON -优先从localStorage读取
export async function loadPriceTables(): Promise<PriceTable[]> {
  // 同时支持复数和单数形式的键名（向后兼容旧备份文件）
  let localData = userStorage.get<PriceTable[]>('price_tables', null);
  if (!localData) {
    localData = userStorage.get<PriceTable[]>('price_table', null);
  }
  if (localData) {
    console.log('[Storage] 从localStorage加载price_tables数据');
    return localData;
  }
  const response = await fetch('/data/price_table.json');
  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

// 文件名到存储键名的映射（确保导出导入时键名一致）
const FILE_TO_STORAGE_KEY: Record<string, string> = {
  'market_model.json': 'market_models',
  'engineer_model.json': 'engineer_models',
  'price_table.json': 'price_tables',
  'series.json': 'series',
  'saved_configurations.json': 'saved_configurations',
};

// Save data to localStorage (user-isolated)
export async function saveDataToFile(fileName: string, data: unknown): Promise<void> {
  // 使用映射表获取正确的存储键名
  const key = FILE_TO_STORAGE_KEY[fileName] || fileName.replace('.json', '');
  userStorage.set(key, data);
  console.log(`[Storage] 已保存到本地: ${key}, 用户ID: ${userStorage.getUserId()}`);
}

// Load saved configurations - 优先从localStorage读取，如果没有则从JSON文件加载
export async function loadSavedConfigurations(): Promise<SavedConfiguration[]> {
  try {
    // 先尝试从localStorage读取（支持导入的数据和用户保存的配置）
    const localData = userStorage.get<SavedConfiguration[]>('saved_configurations', null);
    if (localData && localData.length > 0) {
      console.log('[Storage] 从localStorage加载saved_configurations数据:', localData.length, '条');
      return localData;
    }
    // 从JSON文件加载初始数据
    const response = await fetch('/data/saved_configurations.json');
    const data = await response.json();
    const configs = Array.isArray(data) ? data : [];
    console.log('[Storage] 从JSON文件加载saved_configurations数据:', configs.length, '条');
    return configs;
  } catch (err) {
    console.error('[Storage] 加载配置失败:', err);
    return [];
  }
}

// Raw engineer model JSON structure (flat configurations without grouping)
interface RawEngineerConfig {
  category_id: number;
  category_code: string;
  category_name: string;
  super_category_id: number;
  super_category_name: string;
  options: {
    option_code: string;
    description: string;
    is_default: boolean;
  }[];
}

interface RawEngineerModel {
  model_id: string;
  model_name: string;
  product_series: string;
  series_info: SeriesInfo;
  configurations: RawEngineerConfig[];
  rules: unknown[];
}

// Convert raw engineer model JSON to EngineerModel with grouped configuration_groups
function convertRawEngineerModel(raw: RawEngineerModel): EngineerModel {
  // Group configurations by super_category_id
  const groupMap = new Map<number, { super_category_id: number; super_category_name: string; categories: Category[] }>();

  for (const config of raw.configurations) {
    if (!groupMap.has(config.super_category_id)) {
      groupMap.set(config.super_category_id, {
        super_category_id: config.super_category_id,
        super_category_name: config.super_category_name,
        categories: [],
      });
    }
    const group = groupMap.get(config.super_category_id)!;
    group.categories.push({
      category_id: config.category_id,
      category_code: config.category_code,
      category_name: config.category_name,
      super_category_id: config.super_category_id,
      super_category_name: config.super_category_name,
      options: config.options.map((o, idx) => ({
        option_code: o.option_code,
        description: o.description,
        is_default: o.is_default,
        seq_id: idx + 1,
        hide: false,
      })),
      seq_id: group.categories.length + 1,
      hide: false,
    });
  }

  // Sort groups by super_category_id and assign seq_id
  const sortedGroups = Array.from(groupMap.values())
    .sort((a, b) => a.super_category_id - b.super_category_id);

  const configurationGroups: ConfigurationGroup[] = sortedGroups.map((g, idx) => ({
    super_category_id: g.super_category_id,
    super_category_name: g.super_category_name,
    categories: g.categories,
    seq_id: idx + 1,
    hide: false,
  }));

  return {
    model_id: raw.model_id,
    model_name: raw.model_name,
    product_series: raw.product_series,
    series_info: { ...raw.series_info },
    configuration_groups: configurationGroups,
    rules: raw.rules || [],
  };
}

// Load engineer models from JSON -优先从localStorage读取
export async function loadEngineerModels(): Promise<EngineerModel[]> {
  // 同时支持复数和单数形式的键名（向后兼容旧备份文件）
  let localData = userStorage.get<EngineerModel[]>('engineer_models', null);
  if (!localData) {
    localData = userStorage.get<EngineerModel[]>('engineer_model', null);
  }
  if (localData) {
    console.log('[Storage] 从localStorage加载engineer_models数据');
    return localData;
  }
  const response = await fetch('/data/engineer_model.json');
  const data: RawEngineerModel[] = await response.json();
  const dataArray = Array.isArray(data) ? data : [data];
  return dataArray.map(convertRawEngineerModel);
}

// Create engineer model from market model (simulate PLM sync) - kept for backward compatibility
export function createEngineerModelFromMarket(market: MarketModel): EngineerModel {
  return {
    model_id: `eng_${market.model_id}`,
    model_name: market.model_name,
    product_series: market.product_series,
    series_info: { ...market.series_info },
    configuration_groups: market.configuration_groups.map(g => ({
      ...g,
      categories: g.categories.map(c => ({
        ...c,
        options: c.options.map(o => ({ ...o })),
      })),
    })),
    rules: [...market.rules],
  };
}

// Deep clone a market model for editing
export function cloneMarketModel(model: MarketModel): MarketModel {
  return JSON.parse(JSON.stringify(model));
}

// Global counter for configuration numbers (in-memory only, resets on refresh)
let stdCounter = 0;
let tmpCounter = 0;

// Generate a configuration number
// - No custom entries: std000000 (6 digits, auto-increment)
// - Has custom entries: tmp00000 (5 digits, auto-increment)
export function generateConfigNumber(
  modelId: string,
  selections: Record<string, string>,
  customEntries: { category_code: string }[]
): string {
  const hasCustom = customEntries.length > 0;
  
  if (hasCustom) {
    tmpCounter++;
    return `tmp${tmpCounter.toString().padStart(5, '0')}`;
  } else {
    stdCounter++;
    return `std${stdCounter.toString().padStart(6, '0')}`;
  }
}

// Check if all visible categories have selections
export function isConfigComplete(
  model: MarketModel,
  selections: Record<string, string>,
  customEntries: CustomConfigEntry[]
): boolean {
  for (const group of model.configuration_groups) {
    if (group.hide) continue;
    for (const cat of group.categories) {
      if (cat.hide) continue;
      const visibleOptions = cat.options.filter(o => !o.hide);
      if (visibleOptions.length === 0) continue;
      const hasSelection = !!selections[cat.category_code];
      const hasCustom = customEntries.some(e => e.category_code === cat.category_code);
      if (!hasSelection && !hasCustom) return false;
    }
  }
  return true;
}

// Base price for the model
export const MODEL_BASE_PRICE = 285000;