export const supportedLocales = ["es", "en"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "es";
export const localeStorageKey = "encaja.locale";
export const localeCookieName = "encaja-locale";
const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "es" || normalized === "en") {
    return normalized;
  }

  const basePart = normalized.split(/[-_]/)[0];
  if (basePart === "es" || basePart === "en") {
    return basePart;
  }

  return null;
}

export function detectBrowserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = normalizeLocale(language);
    if (normalized) {
      return normalized;
    }
  }

  return defaultLocale;
}

export function resolveIntlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "es-AR";
}

export function buildLocaleCookieValue(locale: Locale): string {
  return `${localeCookieName}=${locale}; path=/; max-age=${localeCookieMaxAgeSeconds}; samesite=lax`;
}
