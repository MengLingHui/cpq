import { useEffect } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Loader2, Database, ShoppingCart, Settings2, DollarSign, ClipboardList, Wrench } from 'lucide-react';
import EngineerModelList from '@/components/EngineerModelList';
import MarketModelManager from '@/components/MarketModelManager';
import Configurator from '@/components/Configurator';
import PriceTableManager from '@/components/PriceTableManager';
import SavedConfigList from '@/components/SavedConfigList';
import TestToolsPanel from '@/components/TestToolsPanel';

const MENU_ITEMS = [
  { value: 'test', label: '测试工具', icon: Wrench },
  { value: 'engineer', label: '工程机型', icon: Database },
  { value: 'pricetable', label: '价格表', icon: DollarSign },
  { value: 'market', label: '销售机型', icon: ShoppingCart },

    { value: 'saved', label: '选配历史', icon: ClipboardList },
  { value: 'configurator', label: '产品选配', icon: Settings2 },
];

export default function CPQPage() {
  const { initialize, isLoading, activeTab, setActiveTab } = useCPQStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">加载CPQ数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Sidebar */}
      <aside className="w-48 bg-white border-r shadow-sm flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Settings2 className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-xs font-bold text-slate-800">CPQ 选配系统</h1>
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-8">Configure · Price · Quote</p>
        </div>
        <nav className="flex-1 py-2">
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border-r-2 border-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {activeTab === 'configurator' && <Configurator />}
          {activeTab === 'saved' && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <SavedConfigList />
            </div>
          )}
          {activeTab === 'market' && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <MarketModelManager />
            </div>
          )}
          {activeTab === 'engineer' && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <EngineerModelList />
            </div>
          )}
          {activeTab === 'pricetable' && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <PriceTableManager />
            </div>
          )}
          {activeTab === 'test' && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <TestToolsPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}