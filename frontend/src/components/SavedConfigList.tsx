import { useState, useRef } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Trash2, Eye, ClipboardList, Play, FileJson, FileSpreadsheet } from 'lucide-react';
import type { SavedConfiguration, ConfigStatus } from '@/lib/cpq-data';
import { CONFIG_STATUS_LABELS, formatModelDisplayName } from '@/lib/cpq-data';
import { userStorage } from '@/lib/utils';

// 导出配置为JSON（PLM格式）
function exportToJSON(config: SavedConfiguration) {
  // Build PLM data structure - all key-value pairs including hidden ones
  const plmData: Record<string, string> = {};
  
  // Add basic info
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

function ConfigDetail({ config }: { config: SavedConfiguration }) {
  const { marketModels } = useCPQStore();
  const model = marketModels.find(m => m.model_id === config.model_id);
  const currency = config.currency || '¥';

  const optDescMap: Record<string, string> = {};
  const catNameMap: Record<string, string> = {};
  const catSuperMap: Record<string, number> = {}; // category_code -> super_category_id
  
  if (model) {
    for (const group of model.configuration_groups) {
      for (const cat of group.categories) {
        catNameMap[cat.category_code] = cat.category_name;
        catSuperMap[cat.category_code] = group.super_category_id;
        for (const opt of cat.options) {
          optDescMap[opt.option_code] = opt.description;
        }
      }
    }
  }

  // 按超级分类分组 selections
  const groupedSelections: Record<number, Array<{ catCode: string; optCode: string; catName: string; optDesc: string }>> = {
    0: [], 1: [], 2: [], 3: []
  };
  
  for (const [catCode, optCode] of Object.entries(config.selections)) {
    const superId = catSuperMap[catCode] ?? 2; // 默认归入配置选择
    groupedSelections[superId].push({
      catCode,
      optCode,
      catName: catNameMap[catCode] || catCode,
      optDesc: optDescMap[optCode] || '-',
    });
  }

  // 按超级分类分组 custom_entries
  const groupedCustoms: Record<number, typeof config.custom_entries> = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of config.custom_entries) {
    const superId = entry.super_category_id ?? 2;
    groupedCustoms[superId].push(entry);
  }

  const statusInfo = getStatusDisplay(config);

  return (
    <div className="max-h-[60vh] overflow-y-auto space-y-3">
      <div className="grid grid-cols-2 gap-2 text-xs p-2 bg-slate-50 rounded">
        <div><span className="text-slate-500">产品线:</span> {config.series_description || config.series_name || '-'}</div>
        <div><span className="text-slate-500">机型:</span> {config.model_name ? formatModelDisplayName(config.model_name, config.engineer_model_name) : '-'}</div>
        <div><span className="text-slate-500">价格表:</span> {config.price_table_name || '-'}</div>
        <div><span className="text-slate-500">币种:</span> {currency}</div>
        <div><span className="text-slate-500">保存时间:</span> {new Date(config.saved_at).toLocaleString('zh-CN')}</div>
        <div>
          <span className="text-slate-500">状态:</span>{' '}
          <Badge variant={statusInfo.variant} className={`text-[9px] h-4 ${statusInfo.color}`}>{statusInfo.label}</Badge>
        </div>
        <div>
          <span className="text-slate-500">配置号:</span>{' '}
          <span className="font-mono text-[11px]">{config.config_number}</span>
        </div>
      </div>

      {Object.keys(config.selections).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold">选配明细</h4>
          {[0, 1, 2, 3].map(superId => {
            const items = groupedSelections[superId];
            const customItems = groupedCustoms[superId];
            if (items.length === 0 && customItems.length === 0) return null;
            
            const cfg = SUPER_CATEGORY_CONFIG[superId];
            return (
              <div key={superId} className={`rounded border ${cfg.bgColor}`}>
                <div className={`px-2 py-1 text-[10px] font-semibold ${cfg.color} border-b bg-white/50`}>
                  {cfg.name}
                  <span className="ml-1 text-slate-400 font-normal">({items.length + customItems.length}项)</span>
                </div>
                <Table>
                  <TableBody>
                    {items.map(({ catCode, catName, optDesc }) => (
                      <TableRow key={catCode}>
                        <TableCell className="py-1 text-[11px] w-[40%]">{catName}</TableCell>
                        <TableCell className="py-1 text-[11px] text-slate-600">{optDesc}</TableCell>
                      </TableRow>
                    ))}
                    {customItems.map((entry) => (
                      <TableRow key={`custom-${entry.category_code}`}>
                        <TableCell className="py-1 text-[11px]">{entry.category_name}</TableCell>
                        <TableCell className="py-1 text-[11px] text-amber-700">{entry.custom_text}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      {config.model_id && (
        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">基础价格</span>
            <span>{currency}{config.base_price.toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">选配加价</span>
            <span className="text-emerald-600">+{currency}{config.options_price.toLocaleString('zh-CN')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1 border-t">
            <span>总价</span>
            <span className={config.has_custom ? 'text-amber-600' : 'text-blue-700'}>
              {config.total_price}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SavedConfigList() {
  const { savedConfigurations, deleteConfiguration, loadConfiguration } = useCPQStore();
  const [detailConfig, setDetailConfig] = useState<SavedConfiguration | null>(null);

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
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">保存时间</TableHead>
            <TableHead className="h-8 text-xs">产品线</TableHead>
            <TableHead className="h-8 text-xs">销售机型</TableHead>
            <TableHead className="h-8 text-xs">价格表</TableHead>
            <TableHead className="h-8 text-xs">状态</TableHead>
            <TableHead className="h-8 text-xs">配置号</TableHead>
            <TableHead className="h-8 text-xs">总价</TableHead>
            <TableHead className="h-8 text-xs text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {savedConfigurations.map((cfg) => {
            const statusInfo = getStatusDisplay(cfg);
            const isCompleted = cfg.status === 'completed' || cfg.is_complete;
            return (
              <TableRow key={cfg.id}>
                <TableCell className="py-2 text-xs">
                  {new Date(cfg.saved_at).toLocaleString('zh-CN')}
                </TableCell>
                <TableCell className="py-2 text-xs font-medium">
                  {cfg.series_description || cfg.series_name || '-'}
                </TableCell>
                <TableCell className="py-2 text-xs font-medium">
                  {cfg.model_name ? formatModelDisplayName(cfg.model_name, cfg.engineer_model_name) : '-'}
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
                    {!isCompleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700"
                        onClick={() => loadConfiguration(cfg)}
                      >
                        <Play className="w-3 h-3" />
                        继续选配
                      </Button>
                    )}
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
                            onClick={() => deleteConfiguration(cfg.id)}
                          >
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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