import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, Database, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { userStorage } from '@/lib/utils';

export default function TestToolsPanel() {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // 导出所有数据
  const handleExport = () => {
    const data = userStorage.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpq-backup-${userStorage.getUserId()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入数据
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // 验证导入的数据格式
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid data format');
        }
        
        // 检查是否包含关键的底表数据
        const hasValidData = Object.keys(data).some(key => 
          ['saved_configurations', 'series', 'engineer_models', 'market_models', 'price_tables'].some(
            prefix => key.includes(prefix)
          )
        );
        
        if (!hasValidData && Object.keys(data).length > 0) {
          console.warn('[Import] 导入的数据可能不包含标准的CPQ数据');
        }
        
        // 导入数据到 localStorage
        userStorage.import(data);
        
        setImportError(null);
        setImportSuccess(true);
        
        // 延迟刷新页面以重新加载应用状态
        setTimeout(() => {
          setImportSuccess(false);
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error('[Import] 导入失败:', err);
        setImportError('文件格式错误，无法导入。请确保导入的是有效的CPQ备份文件。');
        setImportSuccess(false);
      }
    };
    
    reader.onerror = () => {
      setImportError('文件读取失败，请重试');
      setImportSuccess(false);
    };
    
    reader.readAsText(file);
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
            导出所有测试数据（系列、机型、价格表、选配历史等），可用于程序初始化或数据迁移
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".json"
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
              导出数据
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
            <p className="mt-0.5">导出文件包含所有用户的选配历史数据</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-600 space-y-2">
          <p>• <strong>导出数据</strong>：将所有底表数据（系列、机型、价格表、选配历史等）导出为 JSON 文件</p>
          <p>• <strong>导入数据</strong>：从 JSON 备份文件恢复数据，导入后页面会自动刷新以重新加载系统状态</p>
          <p>• <strong>重置默认</strong>：清除导入的底表数据，恢复从原始 JSON 文件加载数据</p>
          <p>• 导出的数据可用于程序初始化或数据迁移</p>
          <p>• 此功能仅供测试使用，请妥善保管备份文件</p>
        </CardContent>
      </Card>
    </div>
  );
}
