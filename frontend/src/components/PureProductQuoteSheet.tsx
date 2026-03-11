import { useState } from 'react';
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
import { ClipboardList, Eye, FileDown, FileJson, Trash2 } from 'lucide-react';
import type { PureProductQuoteSheet as PureProductQuoteSheetType } from '@/lib/cpq-data';
import { formatModelDisplayName } from '@/lib/cpq-data';

function exportSheetAsJSON(sheet: PureProductQuoteSheetType) {
  const payload = {
    ...sheet,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sheet.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportSheetAsPDF(sheet: PureProductQuoteSheetType) {
  const totalsHtml = Object.entries(sheet.totals_by_currency || {})
    .map(([currency, total]) => `<span class="badge">${escapeHtml(currency)}${Number(total).toLocaleString('zh-CN')}</span>`)
    .join('');

  const rowsHtml = (sheet.items || [])
    .map((item) => {
      const details = (item.printable_details || []).length
        ? (item.printable_details || [])
            .map((detail) => `<div>${escapeHtml(detail.category_name)}: ${escapeHtml(detail.option_description)}</div>`)
            .join('')
        : '<span class="muted">无可打印明细</span>';

      const modelName = item.model_name
        ? formatModelDisplayName(item.model_name, item.engineer_model_name)
        : '-';

      return `
        <tr>
          <td>
            <div class="strong">${escapeHtml(modelName)}</div>
            <div class="muted">${escapeHtml(item.series_name || '-')}</div>
          </td>
          <td>${escapeHtml(item.price_table_name || '-')}</td>
          <td>${details}</td>
          <td>${escapeHtml(item.total_price || '-')} ${item.has_custom ? '<span class="warn">(含待确认项)</span>' : ''}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(sheet.name)}</title>
        <style>
          body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; margin: 24px; color: #0f172a; }
          h1 { font-size: 20px; margin: 0 0 8px 0; }
          .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
          .badges { margin: 8px 0 16px; }
          .badge { display: inline-block; border: 1px solid #cbd5e1; border-radius: 12px; padding: 2px 10px; margin-right: 6px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; font-size: 12px; word-wrap: break-word; }
          th { background: #f8fafc; text-align: left; }
          .strong { font-weight: 600; }
          .muted { color: #64748b; font-size: 11px; }
          .warn { color: #b45309; font-size: 11px; }
          @page { size: A4 landscape; margin: 12mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(sheet.name)}</h1>
        <div class="meta">生成时间: ${new Date(sheet.created_at).toLocaleString('zh-CN')} | 条目数: ${sheet.item_count}</div>
        <div class="badges">${totalsHtml}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 22%">机型</th>
              <th style="width: 18%">价格表</th>
              <th style="width: 40%">打印选配明细</th>
              <th style="width: 20%">总价</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  // Use an off-screen iframe to trigger print, avoiding popup blocker issues.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
    }, 1200);
  };

  const printNow = () => {
    const printWindow = iframe.contentWindow;
    if (!printWindow) {
      cleanup();
      alert('打印窗口初始化失败，请重试。');
      return;
    }
    printWindow.focus();
    printWindow.print();
    cleanup();
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    alert('打印内容初始化失败，请重试。');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(printNow, 180);
  };

  // Some browsers won't emit onload after document.write, so provide a fallback.
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      printNow();
    }
  }, 500);
}

export default function PureProductQuoteSheet() {
  const { pureProductQuoteSheets, deletePureProductQuoteSheet } = useCPQStore();
  const [detailSheet, setDetailSheet] = useState<PureProductQuoteSheetType | null>(null);

  if (pureProductQuoteSheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <ClipboardList className="w-12 h-12 mb-3" />
        <p className="text-sm">暂无纯产品报价单</p>
        <p className="text-xs mt-1">请先到“选配历史”勾选记录并生成报价单</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">纯产品报价单</h2>
        <p className="text-xs text-slate-500 mt-0.5">共 {pureProductQuoteSheets.length} 份报价单</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">报价单名称</TableHead>
            <TableHead className="h-8 text-xs">条目数</TableHead>
            <TableHead className="h-8 text-xs">汇总金额</TableHead>
            <TableHead className="h-8 text-xs">创建时间</TableHead>
            <TableHead className="h-8 text-xs text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pureProductQuoteSheets.map((sheet) => (
            <TableRow key={sheet.id}>
              <TableCell className="py-2 text-xs font-medium">{sheet.name}</TableCell>
              <TableCell className="py-2 text-xs">{sheet.item_count}</TableCell>
              <TableCell className="py-2 text-xs">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(sheet.totals_by_currency || {}).map(([currency, total]) => (
                    <Badge key={`${sheet.id}-${currency}`} variant="outline" className="text-[10px]">
                      {currency}{total.toLocaleString('zh-CN')}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2 text-xs">{new Date(sheet.created_at).toLocaleString('zh-CN')}</TableCell>
              <TableCell className="py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setDetailSheet(sheet)}
                  >
                    <Eye className="w-3 h-3" />
                    详情
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportSheetAsJSON(sheet)}
                  >
                    <FileJson className="w-3 h-3" />
                    导出JSON
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportSheetAsPDF(sheet)}
                  >
                    <FileDown className="w-3 h-3" />
                    导出PDF
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
                          确定删除这份纯产品报价单吗？删除后不可恢复。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-7 text-xs">取消</AlertDialogCancel>
                        <AlertDialogAction
                          className="h-7 text-xs bg-red-600 hover:bg-red-700"
                          onClick={() => deletePureProductQuoteSheet(sheet.id)}
                        >
                          删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!detailSheet} onOpenChange={(open) => { if (!open) setDetailSheet(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center justify-between gap-2">
              <span>{detailSheet?.name || '纯产品报价单详情'}</span>
              {detailSheet && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => exportSheetAsPDF(detailSheet)}
                >
                  <FileDown className="w-3 h-3" />
                  导出PDF
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailSheet && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">条目数: {detailSheet.item_count}</Badge>
                {Object.entries(detailSheet.totals_by_currency || {}).map(([currency, total]) => (
                  <Badge key={`total-${currency}`} variant="outline">
                    汇总({currency}): {currency}{total.toLocaleString('zh-CN')}
                  </Badge>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">机型</TableHead>
                    <TableHead className="h-8 text-xs">价格表</TableHead>
                    <TableHead className="h-8 text-xs">打印选配明细</TableHead>
                    <TableHead className="h-8 text-xs">总价</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailSheet.items || []).map((item) => (
                    <TableRow key={`${detailSheet.id}-${item.saved_config_id}`}>
                      <TableCell className="py-2 text-xs">
                        <div className="font-medium">
                          {item.model_name ? formatModelDisplayName(item.model_name, item.engineer_model_name) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-500">{item.series_name}</div>
                      </TableCell>
                      <TableCell className="py-2 text-xs">{item.price_table_name}</TableCell>
                      <TableCell className="py-2 text-xs">
                        {(item.printable_details || []).length === 0 ? (
                          <span className="text-slate-400 text-[11px]">无可打印明细</span>
                        ) : (
                          <div className="space-y-0.5">
                            {(item.printable_details || []).map((detail) => (
                              <div key={`${item.saved_config_id}-${detail.category_code}-${detail.option_code}`} className="text-[11px] text-slate-600">
                                {detail.category_name}: {detail.option_description}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {item.total_price}
                        {item.has_custom && <span className="ml-1 text-[10px] text-amber-600">(含待确认项)</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
