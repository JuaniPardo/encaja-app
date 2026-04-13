"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  buildLocaleCookieValue,
  defaultLocale,
  detectBrowserLocale,
  localeStorageKey,
  normalizeLocale,
  resolveIntlLocale,
  type Locale,
} from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";

interface SetLocaleOptions {
  persist?: boolean;
}

interface I18nContextValue {
  locale: Locale;
  intlLocale: string;
  setLocale: (locale: Locale, options?: SetLocaleOptions) => void;
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function persistLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(localeStorageKey, locale);
  document.cookie = buildLocaleCookieValue(locale);
  document.documentElement.lang = locale;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const initial = normalizeLocale(initialLocale) ?? defaultLocale;
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return initial;
    }

    const storedLocale = normalizeLocale(window.localStorage.getItem(localeStorageKey));
    if (storedLocale) {
      return storedLocale;
    }

    if (!initialLocale) {
      return detectBrowserLocale(window.navigator.languages);
    }

    return initial;
  });

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale, options?: SetLocaleOptions) => {
    const normalized = normalizeLocale(nextLocale) ?? defaultLocale;
    setLocaleState(normalized);

    if (options?.persist ?? true) {
      persistLocale(normalized);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string, values?: Record<string, string | number>) =>
      getTranslation(locale, key, fallback, values),
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      intlLocale: resolveIntlLocale(locale),
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}
