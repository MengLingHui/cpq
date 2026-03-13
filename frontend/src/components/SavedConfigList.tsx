import { useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2, Eye, ClipboardList, Play, FileJson, FileSpreadsheet, ShieldCheck, Search } from 'lucide-react';
import type { SavedConfiguration, ConfigStatus } from '@/lib/cpq-data';
import { formatModelDisplayName } from '@/lib/cpq-data';
import { userStorage } from '@/lib/utils';
import { formatDateTime, getConfigStatusLabel, useI18n } from '@/lib/i18n';

// 导出配置为JSON（PLM格式）
function exportToJSON(config: SavedConfiguration) {
  // Build PLM data structure - all key-value pairs including hidden ones
  const plmData: Record<string, string> = {};
  
  // Add basic info
  plmData['order_number'] = config.order_number || '-';
  plmData['config_number'] = config.config_number || '-';
  plmData['series_id'] = config.series_id || '';
  plmData['series_name'] = config.series_name || '';
  plmData['series_description'] = config.series_description || '';
  plmData['engineer_model_name'] = config.engineer_model_name || '';
  plmData['saved_at'] = config.saved_at;
  
  // Add all selections (including hidden ones)
  for (const [categoryCode, optionCode] of Object.entries(config.selections)) {
    plmData[categoryCode] = optionCode;
  }
  
  // Add custom entries
  for (const entry of config.custom_entries) {
    plmData[entry.category_code] = entry.custom_text;
  }
  
  const blob = new Blob([JSON.stringify(plmData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VDS-code-${config.config_number || config.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导出配置为CSV（PLM格式）
function exportToCSV(config: SavedConfiguration) {
  // Build PLM data structure - all key-value pairs including hidden ones
  const plmData: Record<string, string> = {};
  
  // Add basic info
  plmData['order_number'] = config.order_number || '-';
  plmData['config_number'] = config.config_number || '-';
  plmData['series_id'] = config.series_id || '';
  plmData['series_name'] = config.series_name || '';
  plmData['series_description'] = config.series_description || '';
  plmData['model_name'] = config.model_name || '';
  plmData['engineer_model_name'] = config.engineer_model_name || '';
  plmData['saved_at'] = config.saved_at;
  
  // Add all selections (including hidden ones)
  for (const [categoryCode, optionCode] of Object.entries(config.selections)) {
    plmData[categoryCode] = optionCode;
  }
  
  // Add custom entries
  for (const entry of config.custom_entries) {
    plmData[entry.category_code] = entry.custom_text;
  }
  
  // Convert to CSV
  const headers = Object.keys(plmData);
  const values = Object.values(plmData);
  
  // Escape values that contain commas or quotes
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  
  const csvContent = [
    headers.map(escapeCSV).join(','),
    values.map(escapeCSV).join(',')
  ].join('\n');
  
  // Add BOM for Excel to recognize UTF-8
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plm-export-${config.config_number || config.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getStatusDisplay(cfg: SavedConfiguration): { label: string; variant: 'default' | 'outline' | 'secondary'; color: string } {
  const status: ConfigStatus = cfg.status || (cfg.is_complete ? 'completed' : 'options_incomplete');
  const label = getConfigStatusLabel(status);

  switch (status) {
    case 'completed':
      return { label, variant: 'default', color: '' };
    case 'series_confirming':
      return { label, variant: 'outline', color: 'text-orange-600 border-orange-300' };
    case 'model_confirming':
      return { label, variant: 'outline', color: 'text-amber-600 border-amber-300' };
    case 'options_incomplete':
      return { label, variant: 'secondary', color: 'text-blue-600' };
    default:
      return { label: getConfigStatusLabel('options_incomplete'), variant: 'outline', color: '' };
  }
}

// 超级分类显示顺序和样式配置
const SUPER_CATEGORY_CONFIG: Record<number, { nameKey: string; color: string; bgColor: string }> = {
  0: { nameKey: 'saved.group.standard', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  1: { nameKey: 'saved.group.basic', color: 'text-slate-700', bgColor: 'bg-slate-50' },
  2: { nameKey: 'saved.group.option', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  3: { nameKey: 'saved.group.manufacture', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
};

function normalizeConfigNumber(value: string): string {
  return (value || '').trim().toUpperCase();
}

function ConfigDetail({ config }: { config: SavedConfiguration }) {
  const { t } = useI18n();
  const { marketModels } = useCPQStore();
  const model = marketModels.find(m => m.model_id === config.model_id);
  const engineerModelName = config.engineer_model_name || config.model_name || '-';

  const groupedSelections: Record<number, Array<{ catCode: string; catName: string; valueText: string; isCustom: boolean }>> = {
    0: [], 1: [], 2: [], 3: []
  };

  const customMap = new Map(config.custom_entries.map((entry) => [entry.category_code, entry]));

  if (model) {
    for (const group of model.configuration_groups) {
      const superId = group.super_category_id;
      for (const cat of group.categories) {
        const customEntry = customMap.get(cat.category_code);
        if (customEntry) {
          groupedSelections[superId]?.push({
            catCode: cat.category_code,
            catName: cat.category_name,
            valueText: customEntry.custom_text || '-',
            isCustom: true,
          });
          continue;
        }

        const selectedCode = config.selections[cat.category_code]
          || cat.options.find((opt) => opt.is_default)?.option_code
          || cat.options[0]?.option_code
          || '';
        const selectedOption = cat.options.find((opt) => opt.option_code === selectedCode);
        groupedSelections[superId]?.push({
          catCode: cat.category_code,
          catName: cat.category_name,
          valueText: selectedOption?.description || '-',
          isCustom: false,
        });
      }
    }
  } else {
    // Fallback when model snapshot is not found in current market models.
    for (const [catCode, optCode] of Object.entries(config.selections)) {
      groupedSelections[2].push({
        catCode,
        catName: catCode,
        valueText: optCode || '-',
        isCustom: false,
      });
    }
    for (const entry of config.custom_entries) {
      groupedSelections[entry.super_category_id ?? 2].push({
        catCode: entry.category_code,
        catName: entry.category_name || entry.category_code,
        valueText: entry.custom_text || '-',
        isCustom: true,
      });
    }
  }

  const statusInfo = getStatusDisplay(config);

  return (
    <div className="max-h-[60vh] overflow-y-auto space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50 rounded">
        <div><span className="text-slate-500">{t('saved.detailLabels.engineerModel')}:</span> {engineerModelName}</div>
        <div><span className="text-slate-500">{t('saved.detailLabels.marketModel')}:</span> {config.model_name ? formatModelDisplayName(config.model_name, config.engineer_model_name) : '-'}</div>
        <div><span className="text-slate-500">{t('saved.detailLabels.series')}:</span> {config.series_description || config.series_name || '-'}</div>
        <div><span className="text-slate-500">{t('saved.detailLabels.savedAt')}:</span> {formatDateTime(config.saved_at)}</div>
        <div>
          <span className="text-slate-500">{t('saved.detailLabels.status')}:</span>{' '}
          <Badge variant={statusInfo.variant} className={`text-[9px] h-4 ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>
        <div>
          <span className="text-slate-500">{t('saved.detailLabels.orderNo')}:</span>{' '}
          <span className="font-mono text-[11px]">{config.order_number || '-'}</span>
        </div>
        <div>
          <span className="text-slate-500">{t('saved.detailLabels.configNo')}:</span>{' '}
          <span className="font-mono text-[11px]">{config.config_number}</span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">{t('saved.fullDetail')}</h4>
        {[0, 1, 2, 3].map(superId => {
          const items = groupedSelections[superId] || [];
          if (items.length === 0) return null;

          const cfg = SUPER_CATEGORY_CONFIG[superId];
          return (
            <div key={superId} className={`rounded border ${cfg.bgColor}`}>
              <div className={`px-2 py-1 text-[10px] font-semibold ${cfg.color} border-b bg-white/50`}>
                {t(cfg.nameKey)}
                <span className="ml-1 text-slate-400 font-normal">({items.length}项)</span>
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

export default function SavedConfigList() {
  const { t } = useI18n();
  const {
    savedConfigurations,
    deleteConfiguration,
    confirmEtoFeasible,
    loadConfiguration,
    setActiveTab,
  } = useCPQStore();
  const [detailConfig, setDetailConfig] = useState<SavedConfiguration | null>(null);
  const [configNumberQuery, setConfigNumberQuery] = useState('');

  const normalizedQuery = normalizeConfigNumber(configNumberQuery);
  const displayConfigs = normalizedQuery
    ? savedConfigurations.filter(cfg => normalizeConfigNumber(cfg.config_number) === normalizedQuery)
    : savedConfigurations;

  if (savedConfigurations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <ClipboardList className="w-12 h-12 mb-3" />
        <p className="text-sm">{t('saved.empty')}</p>
        <p className="text-xs mt-1">{t('saved.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{t('saved.title')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('saved.userId')}: <span className="font-mono text-slate-400">{userStorage.getUserId()}</span>
            {' · '}
            {savedConfigurations.length} {t('saved.records')}
          </p>
        </div>
        {/* 暂时注释：纯产品报价单功能入口 */}
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <Input
          value={configNumberQuery}
          onChange={(e) => setConfigNumberQuery(e.target.value)}
          placeholder={t('saved.queryPlaceholder')}
          className="h-8 text-xs bg-white"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setConfigNumberQuery('')}
          disabled={!configNumberQuery.trim()}
        >
          {t('common.clear')}
        </Button>
      </div>
      {normalizedQuery && (
        <p className="text-[11px] text-slate-500 px-1">
          {t('saved.queryHitPrefix')}{normalizedQuery}{t('saved.queryHitSuffix')} {displayConfigs.length} {t('saved.queryHitUnit')}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">{t('saved.table.savedAt')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.series')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.marketModel')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.priceTable')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.status')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.orderNo')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.configNo')}</TableHead>
            <TableHead className="h-8 text-xs">{t('saved.table.totalPrice')}</TableHead>
            <TableHead className="h-8 text-xs text-right">{t('saved.table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayConfigs.map((cfg) => {
            const statusInfo = getStatusDisplay(cfg);
            return (
              <TableRow key={cfg.id}>
                <TableCell className="py-2 text-xs">
                  {formatDateTime(cfg.saved_at)}
                </TableCell>
                <TableCell className="py-2 text-xs font-medium">
                  {cfg.series_description || cfg.series_name || '-'}
                </TableCell>
                <TableCell className="py-2 text-xs font-medium">
                  {cfg.model_name|| '-'}
                </TableCell>
                <TableCell className="py-2 text-xs text-slate-600">
                  {cfg.price_table_name || '-'}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  <Badge
                    variant={statusInfo.variant}
                    className={`text-[9px] h-4 whitespace-nowrap ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-xs font-mono text-slate-500">
                  {cfg.order_number || '-'}
                </TableCell>
                <TableCell className="py-2 text-xs font-mono text-slate-500">
                  {cfg.config_number}
                </TableCell>
                <TableCell className="py-2 text-xs font-medium">
                  {cfg.total_price === '-' ? (
                    <span className="text-slate-400">-</span>
                  ) : cfg.has_custom ? (
                    <span className="text-amber-600">{cfg.total_price}</span>
                  ) : (
                    <span className="text-blue-700">{cfg.total_price}</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                      onClick={() => loadConfiguration(cfg)}
                    >
                      <Play className="w-3 h-3" />
                      {t('saved.actions.continueConfig')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setDetailConfig(cfg)}
                    >
                      <Eye className="w-3 h-3" />
                      {t('saved.actions.detail')}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">{t('saved.actions.deleteConfirm')}</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            {t('saved.actions.deleteDesc')}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="h-7 text-xs">{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            className="h-7 text-xs bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              deleteConfiguration(cfg.id);
                            }}
                          >
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    {cfg.is_complete && cfg.has_custom && (!cfg.config_number || cfg.config_number === '-') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-0.5 h-4 w-4 min-w-0 p-0 text-emerald-700/10 hover:text-emerald-700/40 opacity-10 hover:opacity-40"
                        onClick={() => confirmEtoFeasible(cfg.id)}
                        aria-label="ETO确认可行（演示隐藏按钮）"
                        title="ETO确认可行"
                      >
                        <ShieldCheck className="w-2 h-2" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {displayConfigs.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-4 border rounded-lg bg-white">
          {t('saved.notFound')}
        </div>
      )}

      <Dialog open={!!detailConfig} onOpenChange={(open) => { if (!open) setDetailConfig(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center justify-between">
              <span>
                {t('saved.detailTitle')} {detailConfig?.model_name ? `- ${formatModelDisplayName(detailConfig.model_name, detailConfig.engineer_model_name)}` : `- ${detailConfig?.series_description || detailConfig?.series_name}`}
              </span>
              {detailConfig && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportToJSON(detailConfig)}
                  >
                    <FileJson className="w-3 h-3" />
                    {t('quote.exportJson')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportToCSV(detailConfig)}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    CSV
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailConfig && <ConfigDetail config={detailConfig} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}