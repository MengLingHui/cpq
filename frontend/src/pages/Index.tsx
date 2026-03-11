import { useEffect, useMemo, useState } from 'react';
import { useCPQStore } from '@/lib/cpq-store';
import { Loader2 } from 'lucide-react';
import CPQSidebar from '@/features/cpq/components/CPQSidebar';
import CPQTabContent from '@/features/cpq/components/CPQTabContent';
import UIThemeSwitcher, { UI_THEME_OPTIONS, type UITheme } from '@/features/cpq/components/UIThemeSwitcher';

const THEME_STORAGE_KEY = 'cpq-ui-theme';

function getInitialTheme(): UITheme {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && UI_THEME_OPTIONS.some((item) => item.id === raw)) {
    return raw as UITheme;
  }
  return 'default';
}

export default function CPQPage() {
  const { initialize, isLoading, activeTab, setActiveTab } = useCPQStore();
  const [theme, setTheme] = useState<UITheme>(() => getInitialTheme());

  const wideTabs = new Set(['engineer', 'market', 'pricetable']);

  const themeIndex = useMemo(() => {
    const index = UI_THEME_OPTIONS.findIndex((item) => item.id === theme);
    return index < 0 ? 0 : index;
  }, [theme]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextIndex = (themeIndex + 1) % UI_THEME_OPTIONS.length;
    setTheme(UI_THEME_OPTIONS[nextIndex].id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cpq-shell-bg)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--cpq-brand-bg)]" />
          <p className="text-sm text-[var(--cpq-shell-muted)]">加载CPQ数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cpq-shell min-h-screen flex">
      <CPQSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 min-w-0">
        <div className={`${wideTabs.has(activeTab) || activeTab === 'saved' ? 'max-w-7xl' : 'max-w-6xl'} mx-auto px-4 py-4`}>
          <div className="mb-2 flex justify-end">
            <UIThemeSwitcher theme={theme} onToggleTheme={handleToggleTheme} />
          </div>
          <CPQTabContent activeTab={activeTab} />
        </div>
      </main>
    </div>
  );
}