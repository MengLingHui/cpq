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
import { formatDateTime, formatNumber, useI18n } from '@/lib/i18n';
import { toast } from '@/components/ui/sonner';

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

function exportSheetAsPDF(sheet: PureProductQuoteSheetType, t: (key: string) => string, locale: 'zh-CN' | 'en-US') {
  const totalsHtml = Object.entries(sheet.totals_by_currency || {})
    .map(([currency, total]) => `<span class="badge">${escapeHtml(currency)}${formatNumber(Number(total), locale)}</span>`)
    .join('');

  const rowsHtml = (sheet.items || [])
    .map((item) => {
      const details = (item.printable_details || []).length
        ? (item.printable_details || [])
            .map((detail) => `<div>${escapeHtml(detail.category_name)}: ${escapeHtml(detail.option_description)}</div>`)
            .join('')
        : `<span class="muted">${escapeHtml(t('quote.noPrintableDetail'))}</span>`;

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
          <td>${escapeHtml(item.total_price || '-')} ${item.has_custom ? `<span class="warn">${escapeHtml(t('quote.includePending'))}</span>` : ''}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html lang="${locale}">
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
        <div class="meta">${escapeHtml(t('quote.labels.generatedAt'))}: ${formatDateTime(sheet.created_at, locale)} | ${escapeHtml(t('quote.labels.items'))}: ${sheet.item_count}</div>
        <div class="badges">${totalsHtml}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 22%">${escapeHtml(t('quote.labels.model'))}</th>
              <th style="width: 18%">${escapeHtml(t('quote.labels.priceTable'))}</th>
              <th style="width: 40%">${escapeHtml(t('quote.labels.printableDetails'))}</th>
              <th style="width: 20%">${escapeHtml(t('quote.labels.totalPrice'))}</th>
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
      toast.error(t('quote.printInitFailed'));
      return;
    }
    printWindow.focus();
    printWindow.print();
    cleanup();
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    toast.error(t('quote.printContentInitFailed'));
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
  const { t, locale } = useI18n();
  const { pureProductQuoteSheets, deletePureProductQuoteSheet } = useCPQStore();
  const [detailSheet, setDetailSheet] = useState<PureProductQuoteSheetType | null>(null);

  if (pureProductQuoteSheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <ClipboardList className="w-12 h-12 mb-3" />
        <p className="text-sm">{t('quote.empty')}</p>
        <p className="text-xs mt-1">{t('quote.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{t('quote.title')}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{t('quote.totalSheets')} {pureProductQuoteSheets.length} {t('quote.totalSheetsSuffix')}</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 text-xs">{t('quote.table.name')}</TableHead>
            <TableHead className="h-8 text-xs">{t('quote.table.itemCount')}</TableHead>
            <TableHead className="h-8 text-xs">{t('quote.table.total')}</TableHead>
            <TableHead className="h-8 text-xs">{t('quote.table.createdAt')}</TableHead>
            <TableHead className="h-8 text-xs text-right">{t('quote.table.actions')}</TableHead>
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
                      {currency}{formatNumber(total)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="py-2 text-xs">{formatDateTime(sheet.created_at)}</TableCell>
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
                    {t('quote.exportJson')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => exportSheetAsPDF(sheet, t, locale)}
                  >
                    <FileDown className="w-3 h-3" />
                    {t('quote.exportPdf')}
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
                        <AlertDialogTitle className="text-sm">{t('quote.deleteConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                          {t('quote.deleteDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-7 text-xs">{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className="h-7 text-xs bg-red-600 hover:bg-red-700"
                          onClick={() => deletePureProductQuoteSheet(sheet.id)}
                        >
                          {t('common.delete')}
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
              <span>{detailSheet?.name || t('quote.detailTitle')}</span>
              {detailSheet && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => exportSheetAsPDF(detailSheet, t, locale)}
                >
                  <FileDown className="w-3 h-3" />
                  {t('quote.exportPdf')}
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
                    {t('quote.labels.totalByCurrency')}({currency}): {currency}{formatNumber(total)}
                  </Badge>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">{t('quote.labels.model')}</TableHead>
                    <TableHead className="h-8 text-xs">{t('quote.labels.priceTable')}</TableHead>
                    <TableHead className="h-8 text-xs">{t('quote.labels.printableDetails')}</TableHead>
                    <TableHead className="h-8 text-xs">{t('quote.labels.totalPrice')}</TableHead>
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
                          <span className="text-slate-400 text-[11px]">{t('quote.noPrintableDetail')}</span>
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
                        {item.has_custom && <span className="ml-1 text-[10px] text-amber-600">{t('quote.includePending')}</span>}
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
