import { ClipboardList, Database, DollarSign, Search, Settings2, ShoppingCart, Wrench } from 'lucide-react';

export const MENU_ITEMS = [
  { value: 'test', labelKey: 'test', icon: Wrench },
  { value: 'engineer', labelKey: 'engineer', icon: Database },
  { value: 'pricetable', labelKey: 'pricetable', icon: DollarSign },
  { value: 'market', labelKey: 'market', icon: ShoppingCart },

  // { value: 'pure-quote', labelKey: 'pure-quote', icon: FileSpreadsheet },
  { value: 'configurator', labelKey: 'configurator', icon: Settings2 },
    { value: 'saved', labelKey: 'saved', icon: ClipboardList },
  { value: 'query', labelKey: 'query', icon: Search },
] as const;

export type CPQTab = (typeof MENU_ITEMS)[number]['value'];
