import { Settings2 } from 'lucide-react';
import { MENU_ITEMS } from '@/features/cpq/menu-items';

interface CPQSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function CPQSidebar({ activeTab, onTabChange }: CPQSidebarProps) {
  return (
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
              onClick={() => onTabChange(item.value)}
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
  );
}
