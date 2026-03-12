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
import { CONFIG_STATUS_LABELS, formatModelDisplayName } from '@/lib/cpq-data';
import { userStorage } from '@/lib/utils';

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
  const label = CONFIG_STATUS_LABELS[status];

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
      return { label: '未知', variant: 'outline', color: '' };
  }
}

// 超级分类显示顺序和样式配置
const SUPER_CATEGORY_CONFIG: Record<number, { name: string; color: string; bgColor: string }> = {
  0: { name: '标准化版本', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  1: { name: '基础参数', color: 'text-slate-700', bgColor: 'bg-slate-50' },
  2: { name: '配置选择', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  3: { name: '制造属性', color: 'text-emerald-700', bgColor: 'bg-emerald-50' },
};

function normalizeConfigNumber(value: string): string {
  return (value || '').trim().toUpperCase();
}

function ConfigDetail({ config }: { config: SavedConfiguration }) {
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
        <div><span className="text-slate-500">工程机型:</span> {engineerModelName}</div>
        <div><span className="text-slate-500">销售机型:</span> {config.model_name ? formatModelDisplayName(config.model_name, config.engineer_model_name) : '-'}</div>
        <div><span className="text-slate-500">产品线:</span> {config.series_description || config.series_name || '-'}</div>
        <div><span className="text-slate-500">保存时间:</span> {new Date(config.saved_at).toLocaleString('zh-CN')}</div>
        <div>
          <span className="text-slate-500">状态:</span>{' '}
          <Badge variant={statusInfo.variant} className={`text-[9px] h-4 ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>
        <div>
          <span className="text-slate-500">订单号:</span>{' '}
          <span className="font-mono text-[11px]">{config.order_number || '-'}</span>
        </div>
        <div>
          <span className="text-slate-500">配置号:</span>{' '}
          <span className="font-mono text-[11px]">{config.config_number}</span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">配置明细（全量 Category）</h4>
        {[0, 1, 2, 3].map(superId => {
          const items = groupedSelections[superId] || [];
          if (items.length === 0) return null;

          const cfg = SUPER_CATEGORY_CONFIG[superId];
          return (
            <div key={superId} className={`rounded border ${cfg.bgColor}`}>
              <div className={`px-2 py-1 text-[10px] font-semibold ${cfg.color} border-b bg-white/50`}>
                {cfg.name}
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
        <p className="text-sm">暂无选配历史</p>
        <p className="text-xs mt-1">请先在"产品选配"页面完成选配并保存</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">选配历史</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            用户ID: <span className="font-mono text-slate-400">{userStorage.getUserId()}</span>
            {' · '}
            共 {savedConfigurations.length} 条记录
          </p>
        </div>
        {/* 暂时注释：纯产品报价单功能入口 */}
      </div>

      <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <Input
          value={configNumberQuery}
          onChange={(e) => setConfigNumberQuery(e.target.value)}
          placeholder="输入配置号精确查询（例如 AR20J2000123）"
          className="h-8 text-xs bg-white"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setConfigNumberQuery('')}
          disabled={!configNumberQuery.trim()}
        >
          清空
        </Button>
      </div>
      {normalizedQuery && (
        <p className="text-[11px] text-slate-500 px-1">
          查询“{normalizedQuery}”命中 {displayConfigs.length} 条记录
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">保存时间</TableHead>
            <TableHead className="h-8 text-xs">产品线</TableHead>
            <TableHead className="h-8 text-xs">销售机型</TableHead>
            <TableHead className="h-8 text-xs">价格表</TableHead>
            <TableHead className="h-8 text-xs">状态</TableHead>
            <TableHead className="h-8 text-xs">订单号</TableHead>
            <TableHead className="h-8 text-xs">配置号</TableHead>
            <TableHead className="h-8 text-xs">总价</TableHead>
            <TableHead className="h-8 text-xs text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayConfigs.map((cfg) => {
            const statusInfo = getStatusDisplay(cfg);
            return (
              <TableRow key={cfg.id}>
                <TableCell className="py-2 text-xs">
                  {new Date(cfg.saved_at).toLocaleString('zh-CN')}
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
                      继续选配
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setDetailConfig(cfg)}
                    >
                      <Eye className="w-3 h-3" />
                      详情
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
                          <AlertDialogTitle className="text-sm">确认删除</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            确定要删除此选配记录吗？此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="h-7 text-xs">取消</AlertDialogCancel>
                          <AlertDialogAction
                            className="h-7 text-xs bg-red-600 hover:bg-red-700"
                            onClick={() => {
                              deleteConfiguration(cfg.id);
                            }}
                          >
                            删除
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
          未找到匹配配置号的记录
        </div>
      )}

      <Dialog open={!!detailConfig} onOpenChange={(open) => { if (!open) setDetailConfig(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center justify-between">
              <span>
                选配历史详情 {detailConfig?.model_name ? `- ${formatModelDisplayName(detailConfig.model_name, detailConfig.engineer_model_name)}` : `- ${detailConfig?.series_description || detailConfig?.series_name}`}
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
                    导出JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportToCSV(detailConfig)}
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    导出CSV
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