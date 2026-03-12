import { ClipboardList, Database, DollarSign, Search, Settings2, ShoppingCart, Wrench } from 'lucide-react';

export const MENU_ITEMS = [
  { value: 'test', label: '测试工具', icon: Wrench },
  { value: 'engineer', label: '工程机型', icon: Database },
  { value: 'pricetable', label: '价格表', icon: DollarSign },
  { value: 'market', label: '销售机型', icon: ShoppingCart },
  { value: 'saved', label: '选配历史', icon: ClipboardList },
  { value: 'query', label: '配置查询', icon: Search },
  // { value: 'pure-quote', label: '纯产品报价单', icon: FileSpreadsheet },
  { value: 'configurator', label: '产品选配', icon: Settings2 },
] as const;

export type CPQTab = (typeof MENU_ITEMS)[number]['value'];
