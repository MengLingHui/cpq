import { useEffect, useMemo, useRef, useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { useI18n } from '@/lib/i18n';
import Configurator from '@/components/Configurator';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClipboardList,
  Copy,
  Layers,
  PenSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Truck,
  Trash2,
  WalletCards,
} from 'lucide-react';

type OpportunityProductLine = {
  id: string;
  productName: string;
  modelId: string;
  quantity: number;
  unitPrice: number | null;
  currency: string;
  totalLabel: string;
  displayCode: string;
  configStatus: string;
  savedConfigId: string;
  isComplete: boolean;
};

const OPPORTUNITY = {
  id: 'DEAL-7812',
  name: 'Global Packaging Line Expansion',
  owner: 'Alex Morgan',
  expectedCloseDate: '2026-05-20',
  org: 'NorthBridge Industrial Solutions',
};

const CRM_DEMO_STORAGE_KEY = 'cpq-crm-demo-state-v1';

type CommercialTerms = {
  warranty: string;
  payment: string;
  delivery: string;
  service: string;
  notes: string;
};

function formatCurrency(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function configStatusLabel(hasCustom: boolean, t: (key: string) => string) {
  return hasCustom ? t('crm.status.etoPending') : t('crm.status.directOrder');
}

function getProgressLabel(_status: string | undefined, t: (key: string) => string) {
  return t('crm.status.pendingConfig');
}

function resolveProductName(
  seriesName: string | undefined,
  modelName: string | undefined,
  engineerModelName: string | undefined,
  stage: string | undefined,
  t: (key: string) => string,
) {
  // Prefer engineer model name in CRM line items and hide sales model naming.
  if (engineerModelName) {
    return engineerModelName;
  }
  if (modelName) {
    return modelName;
  }
  const safeSeries = seriesName || t('crm.placeholder.unnamedSeries');
  if (stage === 'model') {
    return `${safeSeries} / ${t('crm.placeholder.pendingModel')}`;
  }
  return `${safeSeries} / ${t('crm.placeholder.pendingSelection')}`;
}

function resolveDisplayCode(configNumber?: string, orderNumber?: string) {
  const normalizedConfig = (configNumber || '').trim();
  if (normalizedConfig && normalizedConfig !== '-') {
    return normalizedConfig;
  }
  const normalizedOrder = (orderNumber || '').trim();
  if (normalizedOrder && normalizedOrder !== '-') {
    return normalizedOrder;
  }
  return '-';
}

interface CRMOpportunityPageProps {
  embedded?: boolean;
}

export default function CRMOpportunityPage({ embedded = false }: CRMOpportunityPageProps) {
  const { t, locale } = useI18n();
  const opportunityCurrency = 'EUR';
  const {
    initialize,
    isLoading,
    savedConfigurations,
    loadConfiguration,
    setActiveTab,
    setPostSaveTab,
    clearEditingConfigContext,
    backToSeriesSelection,
  } = useCPQStore();

  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [productLines, setProductLines] = useState<OpportunityProductLine[]>([]);
  const baselineConfigIdsRef = useRef<Set<string>>(new Set());
  const baselineConfigVersionRef = useRef<Record<string, string>>({});
  const editingLineIdRef = useRef<string | null>(null);
  const [commercialTerms, setCommercialTerms] = useState<CommercialTerms>({
    warranty: t('crm.defaultTerms.warranty'),
    payment: t('crm.defaultTerms.payment'),
    delivery: t('crm.defaultTerms.delivery'),
    service: t('crm.defaultTerms.service'),
    notes: '',
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CRM_DEMO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        productLines?: OpportunityProductLine[];
        commercialTerms?: CommercialTerms;
      };
      if (Array.isArray(parsed.productLines)) {
        setProductLines(parsed.productLines);
      }
      if (parsed.commercialTerms) {
        setCommercialTerms(parsed.commercialTerms);
      }
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      CRM_DEMO_STORAGE_KEY,
      JSON.stringify({
        productLines,
        commercialTerms,
      }),
    );
  }, [productLines, commercialTerms]);

  useEffect(() => {
    return () => {
      setPostSaveTab(null);
    };
  }, [setPostSaveTab]);

  const knownSubtotal = useMemo(() => {
    return productLines.reduce((sum, item) => {
      if (item.unitPrice === null) {
        return sum;
      }
      return sum + item.unitPrice * item.quantity;
    }, 0);
  }, [productLines]);

  const openConfiguratorFromDeal = () => {
    editingLineIdRef.current = null;
    baselineConfigIdsRef.current = new Set(savedConfigurations.map((cfg) => cfg.id));
    baselineConfigVersionRef.current = Object.fromEntries(
      savedConfigurations.map((cfg) => [cfg.id, `${cfg.updated_at || cfg.saved_at || ''}|${cfg.version ?? 0}`]),
    );
    clearEditingConfigContext();
    backToSeriesSelection();
    setPostSaveTab('crm-demo');
    setIsConfiguratorOpen(true);
  };

  const openConfiguratorForLine = (lineId: string) => {
    const line = productLines.find((item) => item.id === lineId);
    if (!line) {
      return;
    }

    editingLineIdRef.current = lineId;
    baselineConfigIdsRef.current = new Set(savedConfigurations.map((cfg) => cfg.id));
    baselineConfigVersionRef.current = Object.fromEntries(
      savedConfigurations.map((cfg) => [cfg.id, `${cfg.updated_at || cfg.saved_at || ''}|${cfg.version ?? 0}`]),
    );

    const linkedConfig = savedConfigurations.find((cfg) => cfg.id === line.savedConfigId);
    if (linkedConfig) {
      loadConfiguration(linkedConfig, { preserveActiveTab: true });
    } else {
      clearEditingConfigContext();
      backToSeriesSelection();
    }

    setPostSaveTab('crm-demo');
    setIsConfiguratorOpen(true);
  };

  const applyConfigToLine = (lineId: string, cfg: (typeof savedConfigurations)[number]) => {
    const productName = resolveProductName(
      cfg.series_name,
      cfg.model_name,
      cfg.engineer_model_name,
      cfg.stage,
      t,
    );

    const isComplete = !!cfg.is_complete;
    const normalizedCurrency = opportunityCurrency;
    const knownUnitPrice = isComplete ? cfg.base_price + cfg.options_price : null;
    const totalLabel = isComplete && knownUnitPrice !== null
      ? formatCurrency(knownUnitPrice, normalizedCurrency, locale)
      : t('crm.status.pendingConfig');

    setProductLines((prev) => {
      const target = prev.find((item) => item.id === lineId);
      if (!target) {
        return prev;
      }

      return prev.map((item) => {
        if (item.id !== lineId) {
          return item;
        }
        return {
          ...item,
          productName,
          modelId: cfg.model_id || '-',
          unitPrice: knownUnitPrice,
          currency: normalizedCurrency,
          totalLabel,
          displayCode: resolveDisplayCode(cfg.config_number, cfg.order_number),
          configStatus: isComplete ? configStatusLabel(cfg.has_custom, t) : getProgressLabel(cfg.status, t),
          savedConfigId: cfg.id,
          isComplete,
        };
      });
    });
  };

  useEffect(() => {
    if (!isConfiguratorOpen) {
      return;
    }

    const baselineIds = baselineConfigIdsRef.current;
    const baselineVersions = baselineConfigVersionRef.current;
    const newlySaved = savedConfigurations.filter((cfg) => !baselineIds.has(cfg.id));
    const editingLineId = editingLineIdRef.current;
    const editingLine = editingLineId ? productLines.find((line) => line.id === editingLineId) : undefined;
    const updatedExisting = editingLine
      ? savedConfigurations.find((cfg) => {
          if (cfg.id !== editingLine.savedConfigId) {
            return false;
          }
          const currentVersionTag = `${cfg.updated_at || cfg.saved_at || ''}|${cfg.version ?? 0}`;
          const baselineVersionTag = baselineVersions[cfg.id] || '';
          return currentVersionTag !== baselineVersionTag;
        })
      : undefined;

    const latestNew = newlySaved.length
      ? [...newlySaved].sort((left, right) => {
          return new Date(right.saved_at).getTime() - new Date(left.saved_at).getTime();
        })[0]
      : undefined;

    const latest = updatedExisting || latestNew;

    if (!latest) {
      return;
    }

    baselineConfigIdsRef.current = new Set(savedConfigurations.map((cfg) => cfg.id));
    baselineConfigVersionRef.current = Object.fromEntries(
      savedConfigurations.map((cfg) => [cfg.id, `${cfg.updated_at || cfg.saved_at || ''}|${cfg.version ?? 0}`]),
    );
    const latestIsComplete = !!latest.is_complete;

    const shouldOverwriteLine = !!editingLineIdRef.current && !!updatedExisting && latest.id === updatedExisting.id;

    if (shouldOverwriteLine && editingLineIdRef.current && updatedExisting) {
      applyConfigToLine(editingLineIdRef.current, updatedExisting);
    } else {
      const sourceConfig = latestNew || latest;
      const productName = resolveProductName(
        sourceConfig.series_name,
        sourceConfig.model_name,
        sourceConfig.engineer_model_name,
        sourceConfig.stage,
        t,
      );

      const isComplete = !!sourceConfig.is_complete;
      const normalizedCurrency = opportunityCurrency;
      const knownUnitPrice = isComplete ? sourceConfig.base_price + sourceConfig.options_price : null;
      const totalLabel = isComplete && knownUnitPrice !== null
        ? formatCurrency(knownUnitPrice, normalizedCurrency, locale)
        : t('crm.status.pendingConfig');

      const nextLine: OpportunityProductLine = {
        id: `line_${Date.now()}`,
        productName,
        modelId: sourceConfig.model_id || '-',
        quantity: 1,
        unitPrice: knownUnitPrice,
        currency: normalizedCurrency,
        totalLabel,
        displayCode: resolveDisplayCode(sourceConfig.config_number, sourceConfig.order_number),
        configStatus: isComplete ? configStatusLabel(sourceConfig.has_custom, t) : getProgressLabel(sourceConfig.status, t),
        savedConfigId: sourceConfig.id,
        isComplete,
      };

      setProductLines((prev) => [...prev, nextLine]);
    }

    // Force return to CRM demo tab after any save in CRM flow.
    setActiveTab('crm-demo');
    editingLineIdRef.current = null;
    setIsConfiguratorOpen(false);
    setPostSaveTab(null);

    toast.success(latestIsComplete ? t('crm.toast.savedComplete') : t('crm.toast.savedPartial'));
  }, [isConfiguratorOpen, savedConfigurations, setPostSaveTab, setActiveTab, t]);

  const removeLine = (lineId: string) => {
    setProductLines((prev) => prev.filter((line) => line.id !== lineId));
  };

  const duplicateLine = (lineId: string) => {
    setProductLines((prev) => {
      const source = prev.find((line) => line.id === lineId);
      if (!source) {
        return prev;
      }
      const copied: OpportunityProductLine = {
        ...source,
        id: `line_${Date.now()}`,
      };
      return [...prev, copied];
    });
    toast.success(t('crm.toast.lineCopied'));
  };

  const updateLineQuantity = (lineId: string, rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    const nextQuantity = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setProductLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, quantity: nextQuantity } : line)));
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      editingLineIdRef.current = null;
      setPostSaveTab(null);
    }
    setIsConfiguratorOpen(open);
  };

  return (
    <div className={embedded ? 'bg-[var(--cpq-shell-bg)] rounded-lg' : 'min-h-screen bg-[var(--cpq-shell-bg)]'}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cpq-shell-muted)]">{t('crm.header.tag')}</p>
              <h1 className="mt-1 text-xl font-semibold text-slate-800">{OPPORTUNITY.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{t('crm.header.dealNo')} {OPPORTUNITY.id} · {t('crm.header.customer')} {OPPORTUNITY.org}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-full bg-[var(--cpq-nav-active-bg)] px-3 py-1 text-[var(--cpq-nav-active-text)] hover:bg-[var(--cpq-nav-active-bg)]">
                {t('crm.status.seriesConfirming')}
              </Badge>
              <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-100">
                {t('crm.header.inProgress')}
              </Badge>
            </div>
          </div>
        </header>

        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{t('crm.productLines.title')}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">{t('crm.productLines.subtitle')}</p>
                </div>
                <Button onClick={openConfiguratorFromDeal} className="gap-1.5 rounded-full">
                  <Plus className="h-4 w-4" />
                  {t('crm.productLines.newProduct')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {productLines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <Layers className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <p className="text-sm text-slate-600">{t('crm.productLines.empty')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('crm.productLines.columns.product')}</TableHead>
                      <TableHead>{t('crm.productLines.columns.configNo')}</TableHead>
                      <TableHead>{t('crm.productLines.columns.qty')}</TableHead>
                      <TableHead>{t('crm.productLines.columns.unitPrice')}</TableHead>
                      <TableHead>{t('crm.productLines.columns.lineTotal')}</TableHead>
                      <TableHead>{t('crm.productLines.columns.status')}</TableHead>
                      <TableHead className="text-right">{t('crm.productLines.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-medium text-slate-800 hover:text-blue-700 hover:underline"
                            onClick={() => openConfiguratorForLine(line.id)}
                          >
                            {line.productName}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{line.displayCode}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) => updateLineQuantity(line.id, event.target.value)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          {line.isComplete && line.unitPrice !== null ? formatCurrency(line.unitPrice, opportunityCurrency, locale) : '-'}
                        </TableCell>
                        <TableCell>
                          {line.isComplete && line.unitPrice !== null
                            ? formatCurrency(line.unitPrice * line.quantity, opportunityCurrency, locale)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {line.configStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openConfiguratorForLine(line.id)}
                            aria-label={t('crm.productLines.actionLabels.edit')}
                          >
                            <PenSquare className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicateLine(line.id)}
                            aria-label={t('crm.productLines.actionLabels.copy')}
                          >
                            <Copy className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(line.id)}
                            aria-label={t('crm.productLines.actionLabels.delete')}
                          >
                            <Trash2 className="h-4 w-4 text-slate-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <Separator className="my-4" />

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('crm.productLines.knownSubtotal')}</span>
                <span className="text-base font-semibold text-slate-900">{formatCurrency(knownSubtotal, opportunityCurrency, locale)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('crm.commercial.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-[var(--cpq-brand-bg)]" />
                  {t('crm.commercial.warranty')}
                </div>
                <Textarea
                  value={commercialTerms.warranty}
                  onChange={(event) => setCommercialTerms((prev) => ({ ...prev, warranty: event.target.value }))}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <WalletCards className="h-4 w-4 text-[var(--cpq-brand-bg)]" />
                  {t('crm.commercial.payment')}
                </div>
                <Textarea
                  value={commercialTerms.payment}
                  onChange={(event) => setCommercialTerms((prev) => ({ ...prev, payment: event.target.value }))}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Truck className="h-4 w-4 text-[var(--cpq-brand-bg)]" />
                  {t('crm.commercial.delivery')}
                </div>
                <Textarea
                  value={commercialTerms.delivery}
                  onChange={(event) => setCommercialTerms((prev) => ({ ...prev, delivery: event.target.value }))}
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ClipboardList className="h-4 w-4 text-[var(--cpq-brand-bg)]" />
                  {t('crm.commercial.service')}
                </div>
                <Input
                  value={commercialTerms.service}
                  onChange={(event) => setCommercialTerms((prev) => ({ ...prev, service: event.target.value }))}
                />
                <Textarea
                  value={commercialTerms.notes}
                  onChange={(event) => setCommercialTerms((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder={t('crm.commercial.notes')}
                  className="min-h-16"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isConfiguratorOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="h-[92vh] max-w-[96vw] overflow-hidden border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-[var(--cpq-brand-bg)]" />
              {t('crm.modal.title')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('crm.modal.desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="h-[calc(92vh-72px)] overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                {t('common.loadingCpqData')}
              </div>
            ) : (
              <Configurator />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
