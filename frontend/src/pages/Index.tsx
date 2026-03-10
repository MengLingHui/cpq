import { useEffect } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Loader2 } from 'lucide-react';
import CPQSidebar from '@/features/cpq/components/CPQSidebar';
import CPQTabContent from '@/features/cpq/components/CPQTabContent';

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
      <CPQSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <CPQTabContent activeTab={activeTab} />
        </div>
      </main>
    </div>
  );
}