import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Database, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import JSZip from 'jszip';
import { userStorage } from '@/lib/utils';
import { useCPQStore } from '@/lib/cpq-store';

interface RawEngineerConfig {
  category_id: number;
  category_code: string;
  category_name: string;
  super_category_id: number;
  super_category_name: string;
  options: Array<{
    option_code: string;
    description: string;
    is_default: boolean;
  }>;
}

interface RawEngineerModel {
  model_id: string;
  model_name: string;
  product_series: string;
  series_info: {
    series_id: string;
    series_name: string;
    series_description: string;
    parent_series: string;
  };
  configurations: RawEngineerConfig[];
  rules?: unknown[];
}

function toEngineerInitFormat(engineerModels: ReturnType<typeof useCPQStore.getState>['engineerModels']) {
  return engineerModels.map((model) => {
    const configurations = model.configuration_groups.flatMap((group) =>
      group.categories.map((category) => ({
        category_id: category.category_id,
        category_code: category.category_code,
        category_name: category.category_name,
        super_category_id: category.super_category_id,
        super_category_name: category.super_category_name,
        options: category.options.map((option) => ({
          option_code: option.option_code,
          description: option.description,
          is_default: option.is_default,
        })),
      }))
    );

    return {
      model_id: model.model_id,
      model_name: model.model_name,
      product_series: model.product_series,
      series_info: model.series_info,
      configurations,
      rules: model.rules,
    };
  });
}

function toEngineerRuntimeFormat(rawEngineerModels: RawEngineerModel[]) {
  return rawEngineerModels.map((model) => {
    const groupMap = new Map<number, {
      super_category_id: number;
      super_category_name: string;
      categories: Array<{
        category_id: number;
        category_code: string;
        category_name: string;
        super_category_id: number;
        super_category_name: string;
        options: Array<{
          option_code: string;
          description: string;
          is_default: boolean;
          seq_id: number;
          hide: boolean;
        }>;
        seq_id: number;
        hide: boolean;
      }>;
    }>();

    for (const config of model.configurations || []) {
      if (!groupMap.has(config.super_category_id)) {
        groupMap.set(config.super_category_id, {
          super_category_id: config.super_category_id,
          super_category_name: config.super_category_name,
          categories: [],
        });
      }

      const group = groupMap.get(config.super_category_id)!;
      group.categories.push({
        category_id: config.category_id,
        category_code: config.category_code,
        category_name: config.category_name,
        super_category_id: config.super_category_id,
        super_category_name: config.super_category_name,
        options: (config.options || []).map((option, idx) => ({
          option_code: option.option_code,
          description: option.description,
          is_default: !!option.is_default,
          seq_id: idx + 1,
          hide: false,
        })),
        seq_id: group.categories.length + 1,
        hide: false,
      });
    }

    const configuration_groups = Array.from(groupMap.values())
      .sort((a, b) => a.super_category_id - b.super_category_id)
      .map((group, idx) => ({
        super_category_id: group.super_category_id,
        super_category_name: group.super_category_name,
        categories: group.categories,
        seq_id: idx + 1,
        hide: false,
      }));

    return {
      model_id: model.model_id,
      model_name: model.model_name,
      product_series: model.product_series,
      series_info: model.series_info,
      configuration_groups,
      rules: Array.isArray(model.rules) ? model.rules : [],
    };
  });
}

async function parseZipImport(file: File) {
  const zip = await JSZip.loadAsync(file);
  const marketText = await zip.file('market_model.json')?.async('string');
  const engineerText = await zip.file('engineer_model.json')?.async('string');
  const priceText = await zip.file('price_table.json')?.async('string');

  if (!marketText || !engineerText || !priceText) {
    throw new Error('ZIP missing required files');
  }

  const marketModels = JSON.parse(marketText);
  const rawEngineerModels = JSON.parse(engineerText) as RawEngineerModel[];
  const priceTables = JSON.parse(priceText);

  if (!Array.isArray(marketModels) || !Array.isArray(rawEngineerModels) || !Array.isArray(priceTables)) {
    throw new Error('ZIP JSON structure invalid');
  }

  return {
    market_models: marketModels,
    engineer_models: toEngineerRuntimeFormat(rawEngineerModels),
    price_tables: priceTables,
  } as Record<string, unknown>;
}

export default function TestToolsPanel() {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const marketModels = useCPQStore(state => state.marketModels);
  const engineerModels = useCPQStore(state => state.engineerModels);
  const priceTables = useCPQStore(state => state.priceTables);

  // 重置为默认数据（清除localStorage中的底表数据）
  const handleReset = () => {
    if (confirm('确定要重置为默认数据吗？这将清除所有导入的底表数据，恢复从JSON文件加载原始数据。')) {
      // 清除底表数据，保留选配历史
      userStorage.remove('series');
      userStorage.remove('market_models');
      userStorage.remove('engineer_models');
      userStorage.remove('price_tables');
      
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        window.location.reload();
      }, 1500);
    }
  };

  // 导出三张初始化底表
  const handleExport = async () => {
    const zip = new JSZip();
    const marketJson = JSON.stringify(marketModels, null, 2);
    const engineerJson = JSON.stringify(toEngineerInitFormat(engineerModels), null, 2);
    const priceJson = JSON.stringify(priceTables, null, 2);

    zip.file('market_model.json', marketJson);
    zip.file('engineer_model.json', engineerJson);
    zip.file('price_table.json', priceJson);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpq-init-tables-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入数据
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let data: Record<string, unknown>;

      if (file.name.toLowerCase().endsWith('.zip')) {
        data = await parseZipImport(file);
      } else {
        const text = await file.text();
        data = JSON.parse(text);
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
      }

      const hasValidData = Object.keys(data).some(key =>
        ['saved_configurations', 'series', 'engineer_models', 'market_models', 'price_tables'].some(
          prefix => key.includes(prefix)
        )
      );

      if (!hasValidData && Object.keys(data).length > 0) {
        console.warn('[Import] 导入的数据可能不包含标准的CPQ数据');
      }

      userStorage.import(data);

      setImportError(null);
      setImportSuccess(true);

      setTimeout(() => {
        setImportSuccess(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('[Import] 导入失败:', err);
      setImportError('文件格式错误，无法导入。请使用系统导出的ZIP或有效的CPQ备份JSON文件。');
      setImportSuccess(false);
    }

    // 重置 input 以便可以重复选择同一文件
    event.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">测试工具</h2>
          <p className="text-xs text-slate-500 mt-0.5">数据导入导出等测试功能</p>
        </div>
      </div>

      {importError && (
        <Alert variant="destructive" className="text-xs">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      {importSuccess && (
        <Alert className="text-xs border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription>导入成功，页面即将刷新...</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            数据备份与恢复
          </CardTitle>
          <CardDescription className="text-xs">
            导出压缩包（含销售机型、工程机型、价格表三张初始化底表）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".json,.zip"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-9 text-xs gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              导入数据
            </Button>
            <Button
              variant="outline"
              className="h-9 text-xs gap-2"
              onClick={handleExport}
            >
              <Download className="w-3.5 h-3.5" />
              导出ZIP
            </Button>
            <Button
              variant="outline"
              className="h-9 text-xs gap-2 text-amber-600 hover:text-amber-700"
              onClick={handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置默认
            </Button>
          </div>

          <div className="text-[10px] text-slate-400 bg-slate-50 rounded p-2">
            <p>用户ID: <span className="font-mono">{userStorage.getUserId()}</span></p>
            <p className="mt-0.5">导出将下载一个 ZIP，内含 market_model.json、engineer_model.json、price_table.json</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-2">
          <p>• <strong>导出ZIP</strong>：下载一个压缩包，包含 market_model.json、engineer_model.json、price_table.json 三个初始化底表文件</p>
          <p>• <strong>导入数据</strong>：支持导入系统导出的 ZIP（推荐）或历史 JSON 备份，导入后页面会自动刷新</p>
          <p>• <strong>重置默认</strong>：清除导入的底表数据，恢复从原始 JSON 文件加载数据</p>
          <p>• 导出的数据可用于程序初始化或数据迁移</p>
          <p>• 此功能仅供测试使用，请妥善保管备份文件</p>
        </CardContent>
      </Card>
    </div>
  );
}
