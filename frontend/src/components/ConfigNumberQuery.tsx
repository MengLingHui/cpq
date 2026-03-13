import { useMemo, useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { Search, Eye } from 'lucide-react';
import type { ConfigDetailByNumber } from '@/lib/cpq-data';

const SUPER_CATEGORY_CONFIG: Record<number, { name: string; color: string; bgColor: string }> = {
  0: { name: '标准化版本', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  1: { name: '基础参数', color: 'text-slate-700', bgColor: 'bg-slate-50' },
  2: { name: '配置选择', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  3: { name: '制造属性', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
};

function normalizeConfigNumber(value: string): string {
  return (value || '').trim().toUpperCase();
}

function QueryDetail({ config }: { config: ConfigDetailByNumber }) {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const groupedSelections: Record<number, Array<{ catCode: string; catName: string; valueText: string; isCustom: boolean }>> = {
    0: [], 1: [], 2: [], 3: [],
  };

  for (const item of config.details) {
    const valueText = item.value_type === 'custom'
      ? (item.custom_text || '-')
      : item.value_type === 'option'
        ? (item.option_description || item.option_code || '-')
        : '-';

    groupedSelections[item.super_category_id]?.push({
      catCode: item.category_code,
      catName: item.category_name,
      valueText,
      isCustom: item.value_type === 'custom',
    });
  }

  // Include categories from unknown super category ids in a fallback bucket for display.
  const knownSuperIds = new Set([0, 1, 2, 3]);
  const extraGroups = config.details
    .filter((item) => !knownSuperIds.has(item.super_category_id))
    .reduce<Record<number, Array<{ catCode: string; catName: string; valueText: string; isCustom: boolean }>>>((acc, item) => {
      if (!acc[item.super_category_id]) acc[item.super_category_id] = [];
      const valueText = item.value_type === 'custom'
        ? (item.custom_text || '-')
        : item.value_type === 'option'
          ? (item.option_description || item.option_code || '-')
          : '-';
      acc[item.super_category_id].push({
        catCode: item.category_code,
        catName: item.category_name,
        valueText,
        isCustom: item.value_type === 'custom',
      });
      return acc;
    }, {});

  const orderedSuperIds = [0, 1, 2, 3, ...Object.keys(extraGroups).map((k) => Number(k)).sort((a, b) => a - b)];

  for (const [key, items] of Object.entries(extraGroups)) {
    groupedSelections[Number(key)] = items;
  }

  const superCategoryNames = new Map<number, string>();
  for (const item of config.details) {
    superCategoryNames.set(item.super_category_id, item.super_category_name || `分类${item.super_category_id}`);
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50 rounded">
        <div><span className="text-slate-500">{isZh ? '工程机型' : 'Engineer Model'}:</span> {config.engineer_model_name || '-'}</div>
        <div><span className="text-slate-500">{isZh ? '产品线' : 'Series'}:</span> {config.series_description || config.series_name || '-'}</div>
        <div><span className="text-slate-500">{isZh ? '配置号' : 'Config No.'}:</span> <span className="font-mono text-[11px]">{config.config_number}</span></div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">{isZh ? '配置明细（全量 Category）' : 'Configuration Details (All Categories)'}</h4>
        {orderedSuperIds.map((superId) => {
          const items = groupedSelections[superId] || [];
          if (items.length === 0) return null;

          const cfg = SUPER_CATEGORY_CONFIG[superId] || {
            name: superCategoryNames.get(superId) || `分类${superId}`,
            color: 'text-slate-700',
            bgColor: 'bg-slate-50',
          };
          return (
            <div key={superId} className={`rounded border ${cfg.bgColor}`}>
              <div className={`px-2 py-1 text-[10px] font-semibold ${cfg.color} border-b bg-white/50`}>
                {cfg.name}
                <span className="ml-1 text-slate-400 font-normal">({items.length}{isZh ? '项' : ' items'})</span>
              </div>
              <Table>
                <TableBody>
                  {items.map(({ catCode, catName, valueText, isCustom }) => (
                    <TableRow key={catCode}>
                      <TableCell className="py-1 text-[11px] w-[40%]">{catName}</TableCell>
                      <TableCell className={`py-1 text-[11px] ${isCustom ? 'text-amber-700' : 'text-slate-600'}`}>{valueText}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ConfigNumberQuery() {
  const { locale } = useI18n();
  const isZh = locale === 'zh-CN';
  const { configDetailsByNumber } = useCPQStore();
  const [query, setQuery] = useState('');
  const [detailConfig, setDetailConfig] = useState<ConfigDetailByNumber | null>(null);

  const normalizedQuery = normalizeConfigNumber(query);
  const canonicalConfig = useMemo(() => {
    if (!normalizedQuery) return null;
    return configDetailsByNumber[normalizedQuery] || null;
  }, [configDetailsByNumber, normalizedQuery]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{isZh ? '配置号查询' : 'Config Number Query'}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{isZh ? '输入配置号后查询配置详情表（不显示销售机型与价格）' : 'Query full configuration details by config number (without market model and price)'}</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isZh ? '输入配置号精确查询（例如 AR20J2000123）' : 'Exact config number lookup (e.g. AR20J2000123)'}
          className="h-8 text-xs bg-white"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setQuery('')}
          disabled={!query.trim()}
        >
          {isZh ? '清空' : 'Clear'}
        </Button>
      </div>

      {!normalizedQuery ? (
        <div className="text-xs text-slate-400 text-center py-8 border rounded-lg bg-white">
          {isZh ? '请输入配置号开始查询' : 'Enter a config number to start'}
        </div>
      ) : (
        <>
          <p className="text-[11px] text-slate-500 px-1">
            {isZh ? '查询配置号主表' : 'Query key'}: {normalizedQuery}
          </p>

          {!canonicalConfig ? (
            <div className="text-xs text-slate-400 text-center py-4 border rounded-lg bg-white">
              {isZh ? '未找到匹配配置号的记录' : 'No record matched this config number'}
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{isZh ? '配置号实体' : 'Config Entity'}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{isZh ? '主键为配置号，展示该配置号对应的完整选配详情' : 'Primary key is config number, showing complete option details'}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => setDetailConfig(canonicalConfig)}
                >
                  <Eye className="w-3 h-3" />
                  {isZh ? '查看配置' : 'View Configuration'}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">{isZh ? '配置号' : 'Config No.'}</TableHead>
                    <TableHead className="h-8 text-xs">{isZh ? '工程机型' : 'Engineer Model'}</TableHead>
                    <TableHead className="h-8 text-xs">{isZh ? '产品线' : 'Series'}</TableHead>
                    <TableHead className="h-8 text-xs">{isZh ? 'Category 数' : 'Category Count'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="py-2 text-xs font-mono text-slate-600">{canonicalConfig.config_number}</TableCell>
                    <TableCell className="py-2 text-xs font-medium">{canonicalConfig.engineer_model_name || '-'}</TableCell>
                    <TableCell className="py-2 text-xs">{canonicalConfig.series_description || canonicalConfig.series_name || '-'}</TableCell>
                    <TableCell className="py-2 text-xs">{canonicalConfig.details.length}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!detailConfig} onOpenChange={(open) => { if (!open) setDetailConfig(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {(isZh ? '配置查询详情' : 'Configuration Query Details')} {detailConfig?.engineer_model_name ? `- ${detailConfig.engineer_model_name}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detailConfig && <QueryDetail config={detailConfig} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
