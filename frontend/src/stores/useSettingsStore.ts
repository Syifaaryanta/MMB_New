import { create } from 'zustand';

export type ThemeType = 'light' | 'dark';
export type LanguageType = 'id' | 'en';

interface SettingsState {
  theme: ThemeType;
  language: LanguageType;
  toggleTheme: () => void;
  setLanguage: (lang: LanguageType) => void;
  initializeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'light',
  language: 'id',

  toggleTheme: () => {
    const currentTheme = get().theme;
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Update DOM
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    localStorage.setItem('mmb_theme', nextTheme);
    set({ theme: nextTheme });
  },

  setLanguage: (lang: LanguageType) => {
    localStorage.setItem('mmb_lang', lang);
    set({ language: lang });
  },

  initializeSettings: () => {
    // 1. Theme initialization
    const savedTheme = localStorage.getItem('mmb_theme') as ThemeType | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme: ThemeType = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Language initialization
    const savedLang = localStorage.getItem('mmb_lang') as LanguageType | null;
    const initialLang: LanguageType = savedLang || 'id';

    set({ theme: initialTheme, language: initialLang });
  }
}));
