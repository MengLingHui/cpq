import { Palette } from 'lucide-react';

export type UITheme = 'default' | 'graphite' | 'fresh' | 'sand';

export interface UIThemeOption {
  id: UITheme;
  label: string;
}

export const UI_THEME_OPTIONS: UIThemeOption[] = [
  { id: 'default', label: '商务蓝' },
  { id: 'graphite', label: '极简石墨' },
  { id: 'fresh', label: '晨光青柠' },
  { id: 'sand', label: '暖沙铜' },
];

interface UIThemeSwitcherProps {
  theme: UITheme;
  onToggleTheme: () => void;
}

export default function UIThemeSwitcher({ theme, onToggleTheme }: UIThemeSwitcherProps) {
  const current = UI_THEME_OPTIONS.find((item) => item.id === theme) || UI_THEME_OPTIONS[0];

  return (
    <button
      type="button"
      onClick={onToggleTheme}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--cpq-switcher-border)] bg-[var(--cpq-switcher-bg)] px-3 text-xs font-medium text-[var(--cpq-switcher-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow"
      title="一键切换UI风格"
    >
      <Palette className="h-3.5 w-3.5" />
      <span>{current.label}</span>
    </button>
  );
}
