import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'zh-CN' | 'en-US';

export const LOCALE_STORAGE_KEY = 'cpq-locale';

const FALLBACK_LOCALE: Locale = 'en-US';

const messages = {
  'zh-CN': {
    common: {
      loadingCpqData: '加载CPQ数据...',
      cancel: '取消',
      save: '保存',
      edit: '编辑',
      delete: '删除',
      detail: '详情',
      clear: '清空',
    },
    menu: {
      test: '演示工具',
      engineer: '工程机型',
      pricetable: '价格表',
      market: '销售机型',
      saved: '选配历史',
      query: '配置查询',
      configurator: '产品选配',
      crmDemo: 'CRM Demo',
    },
    sidebar: {
      title: 'CPQ 选配系统',
      quickAccess: '快捷入口',
      demoPage: '演示包(Demo Page)',
      management: '基础管理',
    },
    theme: {
      default: '商务蓝',
      graphite: '极简石墨',
      fresh: '晨光青柠',
      sand: '暖沙铜',
      toggleTitle: '一键切换UI风格',
      language: '语言',
    },
    auth: {
      processing: '正在处理认证...',
      errorTitle: '认证错误',
      defaultError: '抱歉，认证信息无效或已过期',
      returnHome: '返回首页',
      autoReturnPrefix: '将在',
      autoReturnSuffix: '秒后自动返回首页',
      redirecting: '正在跳转...',
    },
    status: {
      unknown: '未知',
      series_confirming: '产品线确认中',
      model_confirming: '机型确认中',
      options_incomplete: '配置确认中',
      completed: '选配完成',
    },
    saved: {
      title: '选配历史',
      empty: '暂无选配历史',
      emptyHint: '请先在"产品选配"页面完成选配并保存',
      records: '条记录',
      userId: '用户ID',
      queryPlaceholder: '输入配置号精确查询（例如 AR20J2000123）',
      queryHitPrefix: '查询“',
      queryHitSuffix: '”命中',
      queryHitUnit: '条记录',
      table: {
        savedAt: '保存时间',
        series: '产品线',
        marketModel: '销售机型',
        priceTable: '价格表',
        status: '状态',
        orderNo: '订单号',
        configNo: '配置号',
        totalPrice: '总价',
        actions: '操作',
      },
      actions: {
        continueConfig: '继续选配',
        detail: '详情',
        deleteConfirm: '确认删除',
        deleteDesc: '确定要删除此选配记录吗？此操作不可撤销。',
      },
      notFound: '未找到匹配配置号的记录',
      detailTitle: '选配详情',
      detailLabels: {
        engineerModel: '工程机型',
        marketModel: '销售机型',
        series: '产品线',
        savedAt: '保存时间',
        status: '状态',
        orderNo: '订单号',
        configNo: '配置号',
      },
      fullDetail: '配置明细（全量 Category）',
      group: {
        standard: '标准化版本',
        basic: '基础参数',
        option: '配置选择',
        manufacture: '制造属性',
      },
    },
    pricetable: {
      title: '价格表管理',
      subtitle: '维护选项价格表，支持多币种。价格表关联工程机型，销售机型选择价格表时仅显示关联相同工程机型的价格表。',
      create: '新建价格表',
      noData: '暂无价格表',
      noDataHint: '点击上方按钮创建价格表',
      noEngineerAlert: '暂无工程机型，无法创建价格表',
      inUseAlert: '该价格表正在被销售机型使用，无法删除',
      createdOn: '创建于',
      selectEngineer: '选择工程机型',
      selectEngineerHint: '请先选择要关联的工程机型，价格表的选项将基于该工程机型生成。',
      createDialogTitle: '新建价格表',
      editDialogTitle: '编辑价格表',
      fields: {
        name: '价格表名称',
        desc: '描述',
        currency: '币种',
        linkedEngineer: '关联工程机型',
      },
      placeholders: {
        name: '输入价格表名称',
        desc: '输入描述',
        filter: '搜索选项编码或内容...',
      },
      countSummary: '共',
      countSummarySuffix: '个选项价格 · 币种:',
      table: {
        name: '价格表名称',
        desc: '描述',
        linkedEngineer: '关联工程机型',
        currency: '币种',
        optionCount: '选项数',
        createdAt: '创建时间',
        actions: '操作',
        index: '序号',
        optionCode: '选项编码',
        optionDesc: '选项内容',
        price: '价格',
      },
      duplicateSuffix: ' (副本)',
      itemCount: '配置项',
      actions: {
        edit: '编辑',
        copy: '复制',
      },
    },
    quote: {
      title: '纯产品报价单',
      empty: '暂无纯产品报价单',
      emptyHint: '请先到“选配历史”勾选记录并生成报价单',
      totalSheets: '共',
      totalSheetsSuffix: '份报价单',
      table: {
        name: '报价单名称',
        itemCount: '条目数',
        total: '汇总金额',
        createdAt: '创建时间',
        actions: '操作',
      },
      detailTitle: '纯产品报价单详情',
      noPrintableDetail: '无可打印明细',
      includePending: '(含待确认项)',
      deleteConfirm: '确认删除',
      deleteDesc: '确定删除这份纯产品报价单吗？删除后不可恢复。',
      exportJson: '导出JSON',
      exportPdf: '导出PDF',
      labels: {
        generatedAt: '生成时间',
        items: '条目数',
        model: '机型',
        priceTable: '价格表',
        printableDetails: '打印选配明细',
        totalPrice: '总价',
        totalByCurrency: '汇总',
      },
      printInitFailed: '打印窗口初始化失败，请重试。',
      printContentInitFailed: '打印内容初始化失败，请重试。',
    },
    crm: {
      header: {
        tag: 'CRM 商机',
        dealNo: '商机编号',
        customer: '客户',
        inProgress: '跟进中',
      },
      status: {
        etoPending: '待ETO评审',
        directOrder: '可直接下单',
        seriesConfirming: '产品线确认中',
        modelConfirming: '机型确认中',
        optionsIncomplete: '选配未完成',
        completed: '选配完成',
        processing: '处理中',
      },
      placeholder: {
        unnamedSeries: '未命名产品线',
        pendingModel: '待确认机型',
        pendingSelection: '待选型',
      },
      toast: {
        savedComplete: '选配结果已写入商机产品行。',
        savedPartial: '中间保存已写入商机产品行，可后续继续完善。',
        lineCopied: '产品行已复制。',
      },
      productLines: {
        title: '产品行',
        subtitle: '从商机直接发起 CPQ 选配，并自动写入产品行。',
        newProduct: '新建产品',
        empty: '暂无产品行，点击右上角“新建产品”进入选配流程。',
        modelId: '型号ID',
        total: '总价',
        knownSubtotal: '已知金额小计',
        columns: {
          product: '产品',
          configNo: '配置号',
          qty: '数量',
          unitPrice: '单价',
          status: '状态',
          actions: '操作',
        },
        actionLabels: {
          edit: '查看或修改配置',
          copy: '复制产品行',
          delete: '删除产品行',
        },
      },
      commercial: {
        title: '商机条款与商务信息',
        warranty: '质保条款',
        payment: '付款条款',
        delivery: '交付条款',
        service: '服务条款',
        notes: '商务备注',
      },
      defaultTerms: {
        warranty: '整机质保12个月，核心部件24个月。',
        payment: '30%预付款，60%发货前，10%验收后30天。',
        delivery: '预计合同生效后6-8周交付。',
        service: '含远程支持与现场调试。',
      },
      modal: {
        title: '从商机新建产品 - CPQ选配',
        desc: '完成机型与选项配置后点击保存，弹窗会自动关闭并把结果写入当前商机产品行。',
      },
    },
  },
  'en-US': {
    common: {
      loadingCpqData: 'Loading CPQ data...',
      cancel: 'Cancel',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      detail: 'Details',
      clear: 'Clear',
    },
    menu: {
      test: 'Demo Tools',
      engineer: 'Engineer Models',
      pricetable: 'Price Tables',
      market: 'Market Models',
      saved: 'Saved Configs',
      query: 'Config Lookup',
      configurator: 'Configurator',
      crmDemo: 'CRM Demo',
    },
    sidebar: {
      title: 'CPQ Configurator',
      quickAccess: 'Quick Access',
      demoPage: 'Demo Page',
      management: 'Management',
    },
    theme: {
      default: 'Business Blue',
      graphite: 'Graphite',
      fresh: 'Fresh Lime',
      sand: 'Warm Sand',
      toggleTitle: 'Switch UI theme',
      language: 'Language',
    },
    auth: {
      processing: 'Processing authentication...',
      errorTitle: 'Authentication Error',
      defaultError: 'Sorry, your authentication information is invalid or has expired',
      returnHome: 'Return to Home',
      autoReturnPrefix: 'Will automatically return to the home page in',
      autoReturnSuffix: 'seconds',
      redirecting: 'Redirecting...',
    },
    status: {
      unknown: 'Unknown',
      series_confirming: 'Series Confirming',
      model_confirming: 'Model Confirming',
      options_incomplete: 'Options Incomplete',
      completed: 'Completed',
    },
    saved: {
      title: 'Saved Configurations',
      empty: 'No saved configurations yet',
      emptyHint: 'Complete and save a configuration from the Configurator tab first',
      records: 'records',
      userId: 'User ID',
      queryPlaceholder: 'Exact config number lookup (e.g. AR20J2000123)',
      queryHitPrefix: 'Query "',
      queryHitSuffix: '" matched',
      queryHitUnit: 'records',
      table: {
        savedAt: 'Saved At',
        series: 'Series',
        marketModel: 'Market Model',
        priceTable: 'Price Table',
        status: 'Status',
        orderNo: 'Order No.',
        configNo: 'Config No.',
        totalPrice: 'Total',
        actions: 'Actions',
      },
      actions: {
        continueConfig: 'Continue',
        detail: 'Details',
        deleteConfirm: 'Confirm Delete',
        deleteDesc: 'Delete this saved configuration? This action cannot be undone.',
      },
      notFound: 'No record matched the config number',
      detailTitle: 'Configuration Details',
      detailLabels: {
        engineerModel: 'Engineer Model',
        marketModel: 'Market Model',
        series: 'Series',
        savedAt: 'Saved At',
        status: 'Status',
        orderNo: 'Order No.',
        configNo: 'Config No.',
      },
      fullDetail: 'Configuration Details (All Categories)',
      group: {
        standard: 'Standardization',
        basic: 'Base Parameters',
        option: 'Option Selection',
        manufacture: 'Manufacturing Attributes',
      },
    },
    pricetable: {
      title: 'Price Table Management',
      subtitle: 'Maintain option price tables with multi-currency support. Tables are bound to engineer models and only matching tables are shown for market model linking.',
      create: 'New Price Table',
      noData: 'No price tables yet',
      noDataHint: 'Create one using the button above',
      noEngineerAlert: 'No engineer model found, cannot create price table',
      inUseAlert: 'This price table is currently linked to market models and cannot be deleted',
      createdOn: 'Created on',
      selectEngineer: 'Select Engineer Model',
      selectEngineerHint: 'Select an engineer model first. Price table options will be generated from that model.',
      createDialogTitle: 'Create Price Table',
      editDialogTitle: 'Edit Price Table',
      fields: {
        name: 'Price Table Name',
        desc: 'Description',
        currency: 'Currency',
        linkedEngineer: 'Linked Engineer Model',
      },
      placeholders: {
        name: 'Enter price table name',
        desc: 'Enter description',
        filter: 'Search by option code or description...',
      },
      countSummary: 'Total',
      countSummarySuffix: 'option prices · Currency:',
      table: {
        name: 'Name',
        desc: 'Description',
        linkedEngineer: 'Engineer Model',
        currency: 'Currency',
        optionCount: 'Options',
        createdAt: 'Created At',
        actions: 'Actions',
        index: '#',
        optionCode: 'Option Code',
        optionDesc: 'Option Description',
        price: 'Price',
      },
      duplicateSuffix: ' (Copy)',
      itemCount: 'items',
      actions: {
        edit: 'Edit',
        copy: 'Duplicate',
      },
    },
    quote: {
      title: 'Pure Product Quote Sheets',
      empty: 'No quote sheets yet',
      emptyHint: 'Select saved configurations and generate one from Saved Configs tab',
      totalSheets: 'Total',
      totalSheetsSuffix: 'quote sheets',
      table: {
        name: 'Quote Name',
        itemCount: 'Items',
        total: 'Totals',
        createdAt: 'Created At',
        actions: 'Actions',
      },
      detailTitle: 'Quote Sheet Details',
      noPrintableDetail: 'No printable details',
      includePending: '(includes pending items)',
      deleteConfirm: 'Confirm Delete',
      deleteDesc: 'Delete this quote sheet? This action cannot be undone.',
      exportJson: 'Export JSON',
      exportPdf: 'Export PDF',
      labels: {
        generatedAt: 'Generated At',
        items: 'Items',
        model: 'Model',
        priceTable: 'Price Table',
        printableDetails: 'Printable Details',
        totalPrice: 'Total',
        totalByCurrency: 'Total',
      },
      printInitFailed: 'Failed to initialize print window. Please try again.',
      printContentInitFailed: 'Failed to initialize print content. Please try again.',
    },
    crm: {
      header: {
        tag: 'CRM Opportunity',
        dealNo: 'Deal No.',
        customer: 'Customer',
        inProgress: 'In Progress',
      },
      status: {
        etoPending: 'ETO Review Pending',
        directOrder: 'Ready to Order',
        seriesConfirming: 'Series Confirming',
        modelConfirming: 'Model Confirming',
        optionsIncomplete: 'Options Incomplete',
        completed: 'Completed',
        processing: 'Processing',
      },
      placeholder: {
        unnamedSeries: 'Unnamed Series',
        pendingModel: 'Model Pending',
        pendingSelection: 'Selection Pending',
      },
      toast: {
        savedComplete: 'Configuration saved to opportunity product lines.',
        savedPartial: 'Intermediate save added to opportunity product lines; continue editing later.',
        lineCopied: 'Product line copied.',
      },
      productLines: {
        title: 'Product Lines',
        subtitle: 'Launch CPQ directly from opportunity and write results back to line items.',
        newProduct: 'New Product',
        empty: 'No product lines yet. Click "New Product" to start CPQ flow.',
        modelId: 'Model ID',
        total: 'Total',
        knownSubtotal: 'Known Subtotal',
        columns: {
          product: 'Product',
          configNo: 'Config No.',
          qty: 'Qty',
          unitPrice: 'Unit Price',
          status: 'Status',
          actions: 'Actions',
        },
        actionLabels: {
          edit: 'View or edit configuration',
          copy: 'Duplicate product line',
          delete: 'Delete product line',
        },
      },
      commercial: {
        title: 'Commercial Terms',
        warranty: 'Warranty Terms',
        payment: 'Payment Terms',
        delivery: 'Delivery Terms',
        service: 'Service Terms',
        notes: 'Commercial Notes',
      },
      defaultTerms: {
        warranty: '12-month whole-unit warranty, 24 months for core components.',
        payment: '30% down payment, 60% before shipment, 10% within 30 days after acceptance.',
        delivery: 'Estimated delivery in 6-8 weeks after contract effectiveness.',
        service: 'Includes remote support and on-site commissioning.',
      },
      modal: {
        title: 'Create Product from Opportunity - CPQ',
        desc: 'After configuration is saved, this dialog closes and writes results back to current opportunity line items.',
      },
    },
  },
} as const;

type MessageTree = typeof messages;
type MessageValue = string | Record<string, unknown>;

function getByPath(obj: Record<string, unknown>, path: string): MessageValue | undefined {
  return path.split('.').reduce<MessageValue | undefined>((acc, part) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[part] as MessageValue | undefined;
  }, obj);
}

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en-US') {
    return stored;
  }
  const browser = navigator.language.toLowerCase();
  return browser.startsWith('zh') ? 'zh-CN' : 'en-US';
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  const setLocale = (next: Locale) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    setLocaleState(next);
  };

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string): string => {
      const dict = messages[locale] as unknown as Record<string, unknown>;
      const value = getByPath(dict, key);
      if (typeof value === 'string') return value;
      const fallback = getByPath(messages[FALLBACK_LOCALE] as unknown as Record<string, unknown>, key);
      return typeof fallback === 'string' ? fallback : key;
    };

    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'),
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export function getActiveLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en-US') return stored;
  return FALLBACK_LOCALE;
}

export function formatNumber(value: number, locale = getActiveLocale()): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatDate(value: Date | string | number, locale = getActiveLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | number, locale = getActiveLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function getConfigStatusLabel(status: 'series_confirming' | 'model_confirming' | 'options_incomplete' | 'completed', locale = getActiveLocale()): string {
  return messages[locale].status[status] || messages[FALLBACK_LOCALE].status[status];
}

export function getThemeLabel(theme: 'default' | 'graphite' | 'fresh' | 'sand', locale = getActiveLocale()): string {
  return messages[locale].theme[theme] || messages[FALLBACK_LOCALE].theme[theme];
}

export function getMenuLabel(key: 'test' | 'engineer' | 'pricetable' | 'market' | 'saved' | 'query' | 'configurator' | 'crmDemo', locale = getActiveLocale()): string {
  return messages[locale].menu[key] || messages[FALLBACK_LOCALE].menu[key];
}
