import { useMemo, useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { isSuperCategoryPriced, formatModelDisplayName, generateConfigFingerprint } from '@/lib/cpq-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatNumber, useI18n } from '@/lib/i18n';

import { DollarSign, TrendingUp, AlertTriangle, Hash, Copy, CheckCircle2 } from 'lucide-react';

export default function PricePanel() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const {
    selections,
    priceMap,
    marketModels,
    activeMarketModelIndex,
    customEntries,
    savedConfigurations,
    priceTables,
    getBasePrice,
    getOptionsPrice,
    getTotalPrice,
    getCurrency,
    hasCustomEntries,
    getActiveModelDisplayName,
    getEngineerModelName,
  } = useCPQStore();

  const [copied, setCopied] = useState(false);

  const model = marketModels[activeMarketModelIndex];
  if (!model) return null;

  const modelDisplayName = getActiveModelDisplayName();
  const basePrice = getBasePrice();
  const optionsPrice = getOptionsPrice();
  const totalPriceStr = getTotalPrice();
  const hasCustom = hasCustomEntries();
  const currency = getCurrency();
  const linkedPT = priceTables.find(t => t.id === model.price_table_id);
  const engineerModelName = model.engineer_model_name || getEngineerModelName(model.engineer_model_id) || model.model_name;

  const matchedSavedConfig = useMemo(() => {
    if (hasCustom) return undefined;

    const fingerprint = generateConfigFingerprint(
      engineerModelName,
      selections,
      customEntries,
    );

    return savedConfigurations.find((cfg) => {
      if (!cfg.is_complete) return false;
      if (!cfg.config_number || cfg.config_number === '-') return false;
      const cfgFingerprint = generateConfigFingerprint(
        cfg.engineer_model_name || cfg.model_name || 'MODEL',
        cfg.selections || {},
        cfg.custom_entries || [],
      );
      return cfgFingerprint === fingerprint;
    });
  }, [hasCustom, engineerModelName, selections, customEntries, savedConfigurations]);

  const orderNumber = matchedSavedConfig?.order_number || '-';
  const configNumber = matchedSavedConfig?.config_number || '-';

  const fp = (price: number) => `${currency}${formatNumber(price)}`;

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
            <h3 className="text-xs font-semibold text-slate-800">{isZh ? '价格汇总' : 'Price Summary'}</h3>
            <Badge variant="secondary" className="text-[9px] h-4 ml-auto">{currency}</Badge>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{modelDisplayName}</p>
          {linkedPT && (
            <p className="text-[10px] text-slate-400 mt-0.5">{isZh ? '价格表' : 'Price Table'}: {linkedPT.name}</p>
          )}
        </div>

        <div className="p-3 space-y-2">
          {/* Base Price */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{isZh ? '基础价格' : 'Base Price'}</span>
            <span className="font-medium">{fp(basePrice)}</span>
          </div>

          <Separator />

          {/* Selected Options with prices */}
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <TrendingUp className="w-3 h-3" />
              {isZh ? '选配加价项' : 'Selected Option Add-ons'}
            </div>
            {selectedItems.length === 0 && !hasCustom ? (
              <p className="text-[10px] text-slate-400 py-1">{isZh ? '无加价选项' : 'No priced add-ons'}</p>
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
                  {isZh ? '自定义配置项（价格待定）' : 'Custom entries (price pending)'}
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
            <span className="text-slate-600">{isZh ? '选配加价合计' : 'Add-on Subtotal'}</span>
            <span className="font-medium text-emerald-600">+{fp(optionsPrice)}</span>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between text-sm font-bold pt-1">
            <span className="text-slate-800">{isZh ? '总价' : 'Total'}</span>
            <span className={`text-base ${hasCustom ? 'text-amber-600' : 'text-blue-700'}`}>
              {totalPriceStr}
            </span>
          </div>
          {hasCustom && (
            <p className="text-[10px] text-amber-500 text-right">
              {isZh
                ? `含 ${customEntries.length} 项自定义配置，价格待确认`
                : `${customEntries.length} custom entries included, price pending`}
            </p>
          )}

          {/* Order / Configuration Number - inline */}
          <Separator />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                <Hash className="w-3 h-3" />
                {isZh ? '订单号 / 配置号' : 'Order / Config Number'}
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
                      {isZh ? '复制配置号' : 'Copy config number'}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className={`text-xs font-mono text-center py-1 rounded ${
              orderNumber === '-' ? 'text-slate-400' : 'text-slate-700 bg-slate-100 font-bold'
            }`}>
              {isZh ? '订单号' : 'Order No.'}: {orderNumber}
            </div>
            <div className={`text-xs font-mono text-center py-1 rounded ${
              configNumber === '-' ? 'text-slate-400' : 'text-blue-700 bg-blue-50 font-bold'
            }`}>
              {isZh ? '配置号' : 'Config No.'}: {configNumber === '-' ? (hasCustom ? (isZh ? 'ETO评审后生成' : 'Generated after ETO review') : '-') : configNumber}
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              {isZh
                ? '保存后自动生成正式编号；相同配置会复用历史配置号'
                : 'Formal numbers are generated after save; identical configs reuse existing numbers'}
            </p>
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
}