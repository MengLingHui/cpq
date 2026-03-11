import { Settings2 } from 'lucide-react';
import { MENU_ITEMS } from '@/features/cpq/menu-items';

interface CPQSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function CPQSidebar({ activeTab, onTabChange }: CPQSidebarProps) {
  return (
    <aside className="w-48 bg-[var(--cpq-sidebar-bg)] border-r border-[var(--cpq-sidebar-border)] shadow-sm flex flex-col shrink-0 sticky top-0 h-screen">
      <div className="p-3 border-b border-[var(--cpq-sidebar-border)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--cpq-brand-bg)]">
            <Settings2 className="w-3.5 h-3.5 text-[var(--cpq-brand-fg)]" />
          </div>
          <h1 className="text-xs font-bold text-[var(--cpq-sidebar-title)]">CPQ 选配系统</h1>
        </div>
        <p className="text-[9px] text-[var(--cpq-sidebar-muted)] mt-1 ml-8">Configure · Price · Quote</p>
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
                  ? 'bg-[var(--cpq-nav-active-bg)] text-[var(--cpq-nav-active-text)] font-semibold border-r-2 border-[var(--cpq-nav-active-border)]'
                  : 'text-[var(--cpq-nav-idle-text)] hover:bg-[var(--cpq-nav-idle-hover-bg)] hover:text-[var(--cpq-nav-idle-hover-text)]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--cpq-nav-active-border)]' : 'text-[var(--cpq-sidebar-muted)]'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
