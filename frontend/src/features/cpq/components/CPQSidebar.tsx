import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { MENU_ITEMS } from '@/features/cpq/menu-items';
import { useI18n } from '@/lib/i18n';

interface CPQSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function CPQSidebar({ activeTab, onTabChange }: CPQSidebarProps) {
  const { t } = useI18n();
  const [isManagementExpanded, setIsManagementExpanded] = useState(false);

  const alwaysVisibleValues = useMemo(() => new Set(['configurator','query', 'saved']), []);

  const alwaysVisibleItems = useMemo(
    () => MENU_ITEMS.filter((item) => alwaysVisibleValues.has(item.value)),
    [alwaysVisibleValues],
  );

  const collapsibleItems = useMemo(
    () => MENU_ITEMS.filter((item) => !alwaysVisibleValues.has(item.value)),
    [alwaysVisibleValues],
  );

  useEffect(() => {
    if (collapsibleItems.some((item) => item.value === activeTab)) {
      setIsManagementExpanded(true);
    }
  }, [activeTab, collapsibleItems]);

  const renderMenuButton = (value: string, labelKey: string, Icon: typeof Settings2) => {
    const isActive = activeTab === value;

    return (
      <button
        key={value}
        onClick={() => onTabChange(value)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors ${
          isActive
            ? 'bg-[var(--cpq-nav-active-bg)] text-[var(--cpq-nav-active-text)] font-semibold border-r-2 border-[var(--cpq-nav-active-border)]'
            : 'text-[var(--cpq-nav-idle-text)] hover:bg-[var(--cpq-nav-idle-hover-bg)] hover:text-[var(--cpq-nav-idle-hover-text)]'
        }`}
      >
        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--cpq-nav-active-border)]' : 'text-[var(--cpq-sidebar-muted)]'}`} />
        {t(`menu.${labelKey}`)}
      </button>
    );
  };

  return (
    <aside className="w-48 bg-[var(--cpq-sidebar-bg)] border-r border-[var(--cpq-sidebar-border)] shadow-sm flex flex-col shrink-0 sticky top-0 h-screen">
      <div className="p-3 border-b border-[var(--cpq-sidebar-border)]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--cpq-brand-bg)]">
            <Settings2 className="w-3.5 h-3.5 text-[var(--cpq-brand-fg)]" />
          </div>
          <h1 className="text-xs font-bold text-[var(--cpq-sidebar-title)]">{t('sidebar.title')}</h1>
        </div>
        <p className="text-[9px] text-[var(--cpq-sidebar-muted)] mt-1 ml-8">Configure · Price · Quote</p>
      </div>

      <nav className="flex-1 py-2">
        <div className="mb-1">
          <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--cpq-sidebar-muted)]">
            {t('sidebar.quickAccess')}
          </p>
          {alwaysVisibleItems.map((item) => renderMenuButton(item.value, item.labelKey, item.icon))}
        </div>

        <div className="mt-1">
          <button
            type="button"
            onClick={() => setIsManagementExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--cpq-sidebar-muted)] hover:bg-[var(--cpq-nav-idle-hover-bg)]"
          >
            <span>{t('sidebar.management')}</span>
            {isManagementExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {isManagementExpanded && collapsibleItems.map((item) => renderMenuButton(item.value, item.labelKey, item.icon))}
        </div>
      </nav>
    </aside>
  );
}
