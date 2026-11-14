import { useSegments } from 'expo-router';
import { design } from '@/theme';
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

// Category color always wins on library routes. User accent preferences remain
// available for generic screens (settings, profiles, etc.).
const categoryByRoute: Record<string, keyof typeof design.categoryAccents> = {
  home: 'home', movies: 'movies', series: 'series',
  anime: 'anime', 'anime-movies': 'animeMovies'
};
export function categoryAccentForRoute(route: string): string | undefined {
  const category = categoryByRoute[route];
  return category ? design.categoryAccents[category] : undefined;
}

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
  const segments = useSegments();
  const activeRoute = segments.find(segment => Object.prototype.hasOwnProperty.call(categoryByRoute, segment)) ?? '';
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
    accentColor: categoryAccentForRoute(activeRoute) ?? accentOptions.find(option => option.key === accent)?.color ?? accentOptions[0].color,
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
  }), [accent, display, activeRoute]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useVelarisTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useVelarisTheme must be used inside ThemeProvider');
  return value;
}
