import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';

export const accentOptions = [
  { key: 'purple', label: 'Violett', color: '#7C5CFC' },
  { key: 'green', label: 'Grün', color: '#35C97A' },
  { key: 'yellow', label: 'Gelb', color: '#F3C94E' },
  { key: 'red', label: 'Rot', color: '#EE525C' },
  { key: 'orange', label: 'Orange', color: '#FA923C' },
  { key: 'blue', label: 'Blau', color: '#399FFF' }
] as const;

export type AccentKey = (typeof accentOptions)[number]['key'];
const ACCENT_KEY = 'velaris.theme.accent.v1';
const DISPLAY_KEY = 'velaris.theme.display.v1';
export type DisplayPreferences = { autoHero: boolean; animations: boolean; previews: boolean };
const defaults: DisplayPreferences = { autoHero: true, animations: true, previews: true };

type ThemeValue = {
  accent: AccentKey;
  accentColor: string;
  display: DisplayPreferences;
  setAccent: (next: AccentKey) => Promise<void>;
  setDisplay: (next: DisplayPreferences) => Promise<void>;
};
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [accent, changeAccent] = useState<AccentKey>('purple');
  const [display, changeDisplay] = useState<DisplayPreferences>(defaults);
  useEffect(() => {
    let active = true;
    Promise.all([SecureStore.getItemAsync(ACCENT_KEY), SecureStore.getItemAsync(DISPLAY_KEY)]).then(([stored, prefs]) => {
      if (!active) return;
      if (accentOptions.some(option => option.key === stored)) changeAccent(stored as AccentKey);
      if (prefs) {
        try {
          const parsed = JSON.parse(prefs) as Partial<DisplayPreferences>;
          changeDisplay({
            autoHero: typeof parsed.autoHero === 'boolean' ? parsed.autoHero : true,
            animations: typeof parsed.animations === 'boolean' ? parsed.animations : true,
            previews: typeof parsed.previews === 'boolean' ? parsed.previews : true
          });
        } catch { /* Keep default preferences. */ }
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const value = useMemo<ThemeValue>(() => ({
    accent,
    accentColor: accentOptions.find(option => option.key === accent)?.color ?? accentOptions[0].color,
    display,
    setAccent: async next => {
      if (!accentOptions.some(option => option.key === next)) return;
      changeAccent(next);
      await SecureStore.setItemAsync(ACCENT_KEY, next);
    },
    setDisplay: async next => {
      changeDisplay(next);
      await SecureStore.setItemAsync(DISPLAY_KEY, JSON.stringify(next));
    }
  }), [accent, display]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useVelarisTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useVelarisTheme must be used inside ThemeProvider');
  return value;
}
