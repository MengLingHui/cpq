import { useState, useEffect, useRef } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { isSuperCategoryPriced, generateConfigNumber, formatModelDisplayName } from '@/lib/cpq-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { DollarSign, TrendingUp, AlertTriangle, Hash, Copy, CheckCircle2, RefreshCw } from 'lucide-react';

export default function PricePanel() {
  const {
    selections,
    priceMap,
    marketModels,
    activeMarketModelIndex,
    customEntries,
    priceTables,
    getBasePrice,
    getOptionsPrice,
    getTotalPrice,
    getCurrency,
    hasCustomEntries,
    getActiveModelDisplayName,
  } = useCPQStore();

  const [configNumber, setConfigNumber] = useState('-');
  const [copied, setCopied] = useState(false);
  const prevSelectionsRef = useRef<string>('');

  // Reset config number when selections change
  useEffect(() => {
    const currentKey = JSON.stringify(selections) + JSON.stringify(customEntries);
    if (prevSelectionsRef.current && prevSelectionsRef.current !== currentKey) {
      setConfigNumber('-');
    }
    prevSelectionsRef.current = currentKey;
  }, [selections, customEntries]);

  const model = marketModels[activeMarketModelIndex];
  if (!model) return null;

  const modelDisplayName = getActiveModelDisplayName();
  const basePrice = getBasePrice();
  const optionsPrice = getOptionsPrice();
  const totalPriceStr = getTotalPrice();
  const hasCustom = hasCustomEntries();
  const currency = getCurrency();
  const linkedPT = priceTables.find(t => t.id === model.price_table_id);

  const fp = (price: number) => `${currency}${price.toLocaleString('zh-CN')}`;

  const handleGetConfigNumber = () => {
    const num = generateConfigNumber(model.model_id, selections, customEntries);
    setConfigNumber(num);
  };

  const handleCopyConfigNumber = async () => {
    if (configNumber === '-') return;
    try {
      await navigator.clipboard.writeText(configNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Get selected options with their prices (only from priced super categories)
  const selectedItems: { categoryName: string; description: string; price: number }[] = [];
  for (const group of model.configuration_groups) {
    if (group.hide) continue;
    if (!isSuperCategoryPriced(group.super_category_id)) continue;
    for (const cat of group.categories) {
      if (cat.hide) continue;
      if (customEntries.some(e => e.category_code === cat.category_code)) continue;
      const selectedCode = selections[cat.category_code];
      if (selectedCode) {
        const opt = cat.options.find(o => o.option_code === selectedCode);
        if (opt) {
          const price = priceMap[selectedCode] || 0;
          if (price > 0) {
            selectedItems.push({
              categoryName: cat.category_name,
              description: opt.description,
              price,
            });
          }
        }
      }
    }
  }

  return (
    <TooltipProvider>
      <div className="bg-white border rounded-lg shadow-sm sticky top-14">
        <div className="p-3 border-b bg-slate-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-semibold text-slate-800">价格汇总</h3>
            <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{currency}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{modelDisplayName}</p>
          {linkedPT && (
            <p className="text-[10px] text-slate-400 mt-0.5">价格表: {linkedPT.name}</p>
          )}
        </div>

        <div className="p-3 space-y-2">
          {/* Base Price */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">基础价格</span>
            <span className="font-medium">{fp(basePrice)}</span>
          </div>

          <Separator />

          {/* Selected Options with prices */}
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <TrendingUp className="w-3 h-3" />
              选配加价项
            </div>
            {selectedItems.length === 0 && !hasCustom ? (
              <p className="text-[10px] text-slate-400 py-1">无加价选项</p>
            ) : (
              <>
                {selectedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[10px] py-0.5"
                  >
                    <span className="text-slate-500 truncate flex-1 min-w-0">{item.categoryName}</span>
                    <span className="text-emerald-600 font-medium ml-2 whitespace-nowrap">
                      +{fp(item.price)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Custom entries */}
          {hasCustom && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  自定义配置项（价格待定）
                </div>
                {customEntries.map((entry) => (
                  <div
                    key={entry.category_code}
                    className="flex items-center justify-between text-[10px] py-0.5"
                  >
                    <span className="text-amber-700 truncate flex-1 min-w-0">{entry.category_name}</span>
                    <span className="text-amber-600 font-medium ml-2 whitespace-nowrap">
                      ?
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Options subtotal */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">选配加价合计</span>
            <span className="font-medium text-emerald-600">+{fp(optionsPrice)}</span>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between text-sm font-bold pt-1">
            <span className="text-slate-800">总价</span>
            <span className={`text-base ${hasCustom ? 'text-amber-600' : 'text-blue-700'}`}>
              {totalPriceStr}
            </span>
          </div>
          {hasCustom && (
            <p className="text-[10px] text-amber-500 text-right">
              含 {customEntries.length} 项自定义配置，价格待确认
            </p>
          )}

          {/* Configuration Number - inline */}
          <Separator />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <Hash className="w-3 h-3" />
                配置号
              </div>
              <div className="flex items-center gap-1">
                {configNumber !== '-' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={handleCopyConfigNumber}
                      >
                        {copied ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">
                      复制配置号
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={handleGetConfigNumber}
                    >
                      <RefreshCw className="w-3 h-3 text-blue-500" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px]">
                    获取配置号
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className={`text-xs font-mono text-center py-1 rounded ${
              configNumber === '-' ? 'text-slate-400' : 'text-blue-700 bg-blue-50 font-bold'
            }`}>
              {configNumber}
            </div>
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
}