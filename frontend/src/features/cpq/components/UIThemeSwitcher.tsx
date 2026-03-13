import { Palette } from 'lucide-react';
import { getThemeLabel, useI18n } from '@/lib/i18n';

export type UITheme = 'default' | 'graphite' | 'fresh' | 'sand';

export interface UIThemeOption {
  id: UITheme;
  label: string;
}

export const UI_THEME_OPTIONS: UIThemeOption[] = [
  { id: 'default', label: '' },
  { id: 'graphite', label: '' },
  { id: 'fresh', label: '' },
  { id: 'sand', label: '' },
];

interface UIThemeSwitcherProps {
  theme: UITheme;
  onToggleTheme: () => void;
}

export default function UIThemeSwitcher({ theme, onToggleTheme }: UIThemeSwitcherProps) {
  const { locale, t } = useI18n();
  const current = UI_THEME_OPTIONS.find((item) => item.id === theme) || UI_THEME_OPTIONS[0];

  return (
    <button
      type="button"
      onClick={onToggleTheme}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--cpq-switcher-border)] bg-[var(--cpq-switcher-bg)] px-3 text-xs font-medium text-[var(--cpq-switcher-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow"
      title={t('theme.toggleTitle')}
    >
      <Palette className="h-3.5 w-3.5" />
      <span>{getThemeLabel(current.id, locale)}</span>
    </button>
  );
}
