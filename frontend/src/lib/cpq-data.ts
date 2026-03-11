import { userStorage } from './utils';

// CPQ Data Types and Utilities

export interface SeriesInfo {
  series_id: string;
  series_name: string;
  series_description: string;
  parent_series: string;
}

function hasItems<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function getDataUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}data/${fileName}`;
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
  // Whether this category should appear in printable quote details
  print_enabled?: boolean;
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

export interface RuleSelection {
  category_code: string;
  option_code: string;
}

export interface EnableRule {
  id: string;
  type: 'enable';
  name: string;
  description?: string;
  when: RuleSelection[];
  then: Array<{
    category_code: string;
    allowed_option_codes: string[];
  }>;
  priority?: number;
  enabled?: boolean;
}

export interface ExcludeRule {
  id: string;
  type: 'exclude';
  name: string;
  description?: string;
  items: RuleSelection[];
  priority?: number;
  enabled?: boolean;
}

export type CPQRule = EnableRule | ExcludeRule;

export interface MarketModel {
  model_id: string;
  model_name: string;
  product_series: string;
  series_info: SeriesInfo;
  configuration_groups: ConfigurationGroup[];
  rules: CPQRule[];
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
  rules: CPQRule[];
}

function normalizeRuleSelection(input: unknown): RuleSelection | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const categoryCode = item.category_code;
  const optionCode = item.option_code;
  if (typeof categoryCode !== 'string' || typeof optionCode !== 'string') return null;
  return {
    category_code: categoryCode,
    option_code: optionCode,
  };
}

export function normalizeRuleSet(input: unknown): CPQRule[] {
  if (!Array.isArray(input)) return [];

  const normalized: CPQRule[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id : `rule_${Date.now()}_${normalized.length}`;
    const name = typeof candidate.name === 'string' ? candidate.name : id;
    const description = typeof candidate.description === 'string' ? candidate.description : undefined;
    const priority = typeof candidate.priority === 'number' ? candidate.priority : undefined;
    const enabled = typeof candidate.enabled === 'boolean' ? candidate.enabled : true;

    if (candidate.type === 'enable') {
      const when = Array.isArray(candidate.when)
        ? candidate.when.map(normalizeRuleSelection).filter((v): v is RuleSelection => !!v)
        : [];
      const then = Array.isArray(candidate.then)
        ? candidate.then
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              const effect = entry as Record<string, unknown>;
              if (typeof effect.category_code !== 'string') return null;
              if (!Array.isArray(effect.allowed_option_codes)) return null;
              const allowed = effect.allowed_option_codes.filter((v): v is string => typeof v === 'string');
              return {
                category_code: effect.category_code,
                allowed_option_codes: allowed,
              };
            })
            .filter((v): v is { category_code: string; allowed_option_codes: string[] } => !!v)
        : [];

      if (when.length > 0 && then.length > 0) {
        normalized.push({
          id,
          type: 'enable',
          name,
          description,
          when,
          then,
          priority,
          enabled,
        });
      }
      continue;
    }

    if (candidate.type === 'exclude') {
      const items = Array.isArray(candidate.items)
        ? candidate.items.map(normalizeRuleSelection).filter((v): v is RuleSelection => !!v)
        : [];

      if (items.length >= 2) {
        normalized.push({
          id,
          type: 'exclude',
          name,
          description,
          items,
          priority,
          enabled,
        });
      }
    }
  }

  return normalized;
}

function normalizeModelRules<T extends { rules?: unknown }>(model: T): T & { rules: CPQRule[] } {
  return {
    ...model,
    rules: normalizeRuleSet(model.rules),
  };
}

function normalizeMarketModelOptions(model: MarketModel): MarketModel {
  return {
    ...model,
    configuration_groups: model.configuration_groups.map((group) => ({
      ...group,
      categories: group.categories.map((category) => ({
        ...category,
        // Backward compatibility: migrate legacy option-level print_enabled to category-level.
        print_enabled: category.print_enabled !== false && !category.options.every((option) => {
          const legacyOption = option as OptionItem & { print_enabled?: boolean };
          return legacyOption.print_enabled === false;
        }),
        options: category.options.map((option) => ({
          ...option,
        })),
      })),
    })),
  };
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
  order_number?: string; // 6-digit order number, e.g. 000123
  saved_at: string;
  is_complete: boolean; // whether all categories have been selected
  config_number: string; // configuration number, "-" if not generated
  // New fields for staged configuration
  stage: ConfigStage; // current progress stage
  series_id: string;
  series_name: string;
  series_description: string; // e.g. "Articulated Boom" instead of "AB"
  status: ConfigStatus; // derived status for display
  updated_at?: string;
  source_config_id?: string;
  version?: number;
}

export interface PureProductQuotePrintableDetail {
  category_code: string;
  category_name: string;
  option_code: string;
  option_description: string;
}

export interface PureProductQuoteItem {
  saved_config_id: string;
  saved_at: string;
  model_name: string;
  engineer_model_name?: string;
  series_name: string;
  price_table_name: string;
  currency: string;
  base_price: number;
  options_price: number;
  total_price: string;
  has_custom: boolean;
  printable_details: PureProductQuotePrintableDetail[];
}

export interface PureProductQuoteSheet {
  id: string;
  name: string;
  source_config_ids: string[];
  item_count: number;
  totals_by_currency: Record<string, number>;
  items: PureProductQuoteItem[];
  created_at: string;
  updated_at: string;
}

function normalizePureProductQuoteSheets(data: unknown): PureProductQuoteSheet[] {
  if (!Array.isArray(data)) return [];

  return data
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => {
      const sourceConfigIds = Array.isArray(item.source_config_ids)
        ? item.source_config_ids.filter((id): id is string => typeof id === 'string')
        : [];

      const rawItems = Array.isArray(item.items) ? item.items : [];
      const normalizedItems: PureProductQuoteItem[] = rawItems
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          saved_config_id: typeof entry.saved_config_id === 'string' ? entry.saved_config_id : '',
          saved_at: typeof entry.saved_at === 'string' ? entry.saved_at : '',
          model_name: typeof entry.model_name === 'string' ? entry.model_name : '',
          engineer_model_name: typeof entry.engineer_model_name === 'string' ? entry.engineer_model_name : undefined,
          series_name: typeof entry.series_name === 'string' ? entry.series_name : '-',
          price_table_name: typeof entry.price_table_name === 'string' ? entry.price_table_name : '-',
          currency: typeof entry.currency === 'string' ? entry.currency : '¥',
          base_price: typeof entry.base_price === 'number' ? entry.base_price : 0,
          options_price: typeof entry.options_price === 'number' ? entry.options_price : 0,
          total_price: typeof entry.total_price === 'string' ? entry.total_price : '-',
          has_custom: entry.has_custom === true,
          printable_details: Array.isArray(entry.printable_details)
            ? entry.printable_details
                .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
                .map((d) => ({
                  category_code: typeof d.category_code === 'string' ? d.category_code : '',
                  category_name: typeof d.category_name === 'string' ? d.category_name : '',
                  option_code: typeof d.option_code === 'string' ? d.option_code : '',
                  option_description: typeof d.option_description === 'string' ? d.option_description : '',
                }))
            : [],
        }));

      const totals = item.totals_by_currency;
      const totalsByCurrency = totals && typeof totals === 'object'
        ? Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [key, typeof value === 'number' ? value : 0])
          )
        : {};

      const createdAt = typeof item.created_at === 'string' ? item.created_at : new Date().toISOString();
      const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : createdAt;

      return {
        id: typeof item.id === 'string' ? item.id : `ppq_legacy_${index}`,
        name: typeof item.name === 'string' ? item.name : `纯产品报价单-${index + 1}`,
        source_config_ids: sourceConfigIds,
        item_count: typeof item.item_count === 'number' ? item.item_count : normalizedItems.length,
        totals_by_currency: totalsByCurrency,
        items: normalizedItems,
        created_at: createdAt,
        updated_at: updatedAt,
      };
    });
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
  if (hasItems(localData)) {
    console.log('[Storage] 从localStorage加载series数据');
    return localData;
  }
  // 从JSON文件加载
  const response = await fetch(getDataUrl('series.json'));
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
  if (hasItems(localData)) {
    console.log('[Storage] 从localStorage加载market_models数据');
    return localData.map(model => normalizeMarketModelOptions(normalizeModelRules(model as MarketModel)));
  }
  const response = await fetch(getDataUrl('market_model.json'));
  const data = await response.json();
  const models = Array.isArray(data) ? data : [data];
  return models.map(model => normalizeMarketModelOptions(normalizeModelRules(model as MarketModel)));
}

// Load price tables from JSON -优先从localStorage读取
export async function loadPriceTables(): Promise<PriceTable[]> {
  // 同时支持复数和单数形式的键名（向后兼容旧备份文件）
  let localData = userStorage.get<PriceTable[]>('price_tables', null);
  if (!localData) {
    localData = userStorage.get<PriceTable[]>('price_table', null);
  }
  if (hasItems(localData)) {
    console.log('[Storage] 从localStorage加载price_tables数据');
    return localData;
  }
  const response = await fetch(getDataUrl('price_table.json'));
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
  'pure_product_quote_sheets.json': 'pure_product_quote_sheets',
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
    const response = await fetch(getDataUrl('saved_configurations.json'));
    const data = await response.json();
    const configs = Array.isArray(data) ? data : [];
    console.log('[Storage] 从JSON文件加载saved_configurations数据:', configs.length, '条');
    return configs;
  } catch (err) {
    console.error('[Storage] 加载配置失败:', err);
    return [];
  }
}

// Load pure product quote sheets - 优先从localStorage读取，如果没有则从JSON文件加载
export async function loadPureProductQuoteSheets(): Promise<PureProductQuoteSheet[]> {
  try {
    const localData = userStorage.get<PureProductQuoteSheet[]>('pure_product_quote_sheets', null);
    const normalizedLocal = normalizePureProductQuoteSheets(localData);
    if (normalizedLocal.length > 0) {
      console.log('[Storage] 从localStorage加载pure_product_quote_sheets数据:', normalizedLocal.length, '条');
      return normalizedLocal;
    }

    const response = await fetch(getDataUrl('pure_product_quote_sheets.json'));
    const data = await response.json();
    const sheets = normalizePureProductQuoteSheets(data);
    console.log('[Storage] 从JSON文件加载pure_product_quote_sheets数据:', sheets.length, '条');
    return sheets;
  } catch (err) {
    console.error('[Storage] 加载纯产品报价单失败:', err);
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
  rules?: unknown[];
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
    rules: normalizeRuleSet(raw.rules),
  };
}

// Load engineer models from JSON -优先从localStorage读取
export async function loadEngineerModels(): Promise<EngineerModel[]> {
  // 同时支持复数和单数形式的键名（向后兼容旧备份文件）
  let localData = userStorage.get<EngineerModel[]>('engineer_models', null);
  if (!localData) {
    localData = userStorage.get<EngineerModel[]>('engineer_model', null);
  }
  if (hasItems(localData)) {
    console.log('[Storage] 从localStorage加载engineer_models数据');
    return localData.map(model => normalizeModelRules(model as EngineerModel));
  }
  const response = await fetch(getDataUrl('engineer_model.json'));
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
    rules: normalizeRuleSet(market.rules),
  };
}

// Deep clone a market model for editing
export function cloneMarketModel(model: MarketModel): MarketModel {
  return JSON.parse(JSON.stringify(model));
}

function formatOrderSerial(serial: number): string {
  const normalized = ((serial % 1000000) + 1000000) % 1000000;
  return normalized.toString().padStart(6, '0');
}

function extractOrderSerial(config: SavedConfiguration): number | null {
  if (config.order_number && /^\d{6}$/.test(config.order_number)) {
    return Number(config.order_number);
  }

  if (typeof config.config_number === 'string') {
    const match = config.config_number.match(/(\d{6})$/);
    if (match) return Number(match[1]);
  }

  return null;
}

// Generate next order number: 6-digit流水号, 000000-999999 (rolls over after max)
export function generateOrderNumber(existing: SavedConfiguration[]): string {
  let maxSerial = -1;
  for (const config of existing) {
    const serial = extractOrderSerial(config);
    if (serial !== null) {
      maxSerial = Math.max(maxSerial, serial);
    }
  }
  return formatOrderSerial(maxSerial + 1);
}

function sanitizeEngineerModelName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'MODEL';
  return trimmed.replace(/\s+/g, '');
}

// Generate configuration number: 工程机型名称 + 6位订单流水号
// Example: AR20J-2 + 000000 => AR20J-2000000
export function generateConfigNumber(engineerModelName: string, orderNumber: string): string {
  const serial = /^\d{6}$/.test(orderNumber) ? orderNumber : formatOrderSerial(Number(orderNumber) || 0);
  return `${sanitizeEngineerModelName(engineerModelName)}${serial}`;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeSelectionsForFingerprint(selections: Record<string, string>): string {
  return Object.entries(selections)
    .filter(([, optionCode]) => !!optionCode)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryCode, optionCode]) => `${categoryCode}=${optionCode}`)
    .join('|');
}

function normalizeCustomEntriesForFingerprint(customEntries: CustomConfigEntry[]): string {
  return [...(customEntries || [])]
    .map((entry) => ({
      category_code: entry.category_code || '',
      custom_text: (entry.custom_text || '').trim(),
    }))
    .sort((a, b) => {
      if (a.category_code === b.category_code) {
        return a.custom_text.localeCompare(b.custom_text);
      }
      return a.category_code.localeCompare(b.category_code);
    })
    .map((entry) => `${entry.category_code}~${entry.custom_text}`)
    .join('|');
}

// Configuration fingerprint used for serial-number reuse
export function generateConfigFingerprint(
  engineerModelName: string,
  selections: Record<string, string>,
  customEntries: CustomConfigEntry[] = []
): string {
  const modelKey = sanitizeEngineerModelName(engineerModelName);
  const selectionKey = normalizeSelectionsForFingerprint(selections);
  const customKey = normalizeCustomEntriesForFingerprint(customEntries);
  return `${modelKey}|${selectionKey}|${customKey}`;
}

// Stable configuration number: 工程机型名称 + selections指纹（与保存次数无关）
export function generateStableConfigNumber(
  engineerModelName: string,
  selections: Record<string, string>
): string {
  const modelKey = sanitizeEngineerModelName(engineerModelName);
  const selectionKey = normalizeSelectionsForFingerprint(selections);
  const hash = fnv1a32(`${modelKey}|${selectionKey}`)
    .toString(36)
    .toUpperCase()
    .padStart(7, '0')
    .slice(-7);
  return `${modelKey}-${hash}`;
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