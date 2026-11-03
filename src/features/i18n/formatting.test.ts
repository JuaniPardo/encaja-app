import { describe, expect, it } from "vitest";

import { WORKSPACE_CURRENCY_CODES } from "@/app/(protected)/app/[workspaceSlug]/settings/types";
import { supportedLocales } from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";
import { getCurrencyFormatOptions, getCurrencyInputPrefix } from "@/features/i18n/formatting";

const INTL_LOCALES = ["es-AR", "en-US"];
const CENTS_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
const ROUNDED_DIGITS = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
const OTHER_CURRENCY_CODES = WORKSPACE_CURRENCY_CODES.filter((code) => code !== "BOB");

function normalizeSpaces(value: string) {
  return value.replace(/[  ]/g, " ");
}

function formatWithHelper(
  intlLocale: string,
  currencyCode: string,
  value: number,
  options: Intl.NumberFormatOptions = CENTS_DIGITS,
) {
  const formatter = new Intl.NumberFormat(intlLocale, {
    ...getCurrencyFormatOptions(currencyCode),
    ...options,
  });

  return normalizeSpaces(formatter.format(value));
}

describe("getCurrencyFormatOptions", () => {
  it("shows the Bs symbol for BOB with cents", () => {
    expect(formatWithHelper("es-AR", "BOB", 1234.5)).toBe("Bs 1.234,50");
    expect(formatWithHelper("en-US", "BOB", 1234.5)).toBe("Bs 1,234.50");
  });

  it("shows the Bs symbol for BOB without cents", () => {
    expect(formatWithHelper("es-AR", "BOB", 1234.5, ROUNDED_DIGITS)).toBe("Bs 1.235");
    expect(formatWithHelper("en-US", "BOB", 1234.5, ROUNDED_DIGITS)).toBe("Bs 1,235");
  });

  it("shows the Bs symbol for compact and negative BOB amounts", () => {
    const compactDigits = { notation: "compact", maximumFractionDigits: 1 } as const;

    expect(formatWithHelper("es-AR", "BOB", 1234567, compactDigits)).toBe("Bs 1,2 M");

    for (const intlLocale of INTL_LOCALES) {
      for (const formatted of [
        formatWithHelper(intlLocale, "BOB", 1234567, compactDigits),
        formatWithHelper(intlLocale, "BOB", -1234.5),
      ]) {
        expect(formatted).toContain("Bs");
        expect(formatted).not.toContain("BOB");
      }
    }
  });

  it("treats a lowercase bob code as BOB", () => {
    expect(getCurrencyFormatOptions("bob").currencyDisplay).toBe("narrowSymbol");
    expect(formatWithHelper("es-AR", "bob", 1234.5)).toBe("Bs 1.234,50");
  });

  it.each(OTHER_CURRENCY_CODES)("keeps the default format for %s", (currencyCode) => {
    expect(getCurrencyFormatOptions(currencyCode)).toEqual({
      style: "currency",
      currency: currencyCode,
    });

    for (const intlLocale of INTL_LOCALES) {
      const defaultFormatter = new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: currencyCode,
        ...CENTS_DIGITS,
      });

      expect(formatWithHelper(intlLocale, currencyCode, 1234.5)).toBe(
        normalizeSpaces(defaultFormatter.format(1234.5)),
      );
    }
  });

  it("keeps the current es-AR symbols for USD and UYU", () => {
    expect(formatWithHelper("es-AR", "USD", 1234.5)).toBe("US$ 1.234,50");
    expect(formatWithHelper("es-AR", "UYU", 1234.5)).toBe("UYU 1.234,50");
  });

  it("falls back to ARS when the code is empty", () => {
    expect(getCurrencyFormatOptions("")).toEqual({ style: "currency", currency: "ARS" });
  });
});

describe("getCurrencyInputPrefix", () => {
  it("uses the Bs symbol for BOB, with room for it in the field", () => {
    expect(getCurrencyInputPrefix("BOB")).toEqual({ symbol: "Bs", width: 32 });
    expect(getCurrencyInputPrefix("bob")).toEqual({ symbol: "Bs", width: 32 });
  });

  it("matches the symbol shown in formatted BOB amounts", () => {
    const { symbol } = getCurrencyInputPrefix("BOB");

    for (const intlLocale of INTL_LOCALES) {
      expect(formatWithHelper(intlLocale, "BOB", 1234.5).startsWith(`${symbol} `)).toBe(true);
    }
  });

  it.each(OTHER_CURRENCY_CODES)("keeps the current $ prefix and width for %s", (currencyCode) => {
    expect(getCurrencyInputPrefix(currencyCode)).toEqual({ symbol: "$", width: 24 });
  });

  it("keeps the $ prefix when the code is empty", () => {
    expect(getCurrencyInputPrefix("")).toEqual({ symbol: "$", width: 24 });
  });
});

describe("workspace currency labels", () => {
  it("offers BOB as a selectable workspace currency", () => {
    expect(WORKSPACE_CURRENCY_CODES).toContain("BOB");
  });

  it("labels BOB with the Bs symbol in each locale", () => {
    expect(getTranslation("es", "workspaceSettings.currencyOptions.bob")).toBe(
      "BOB · Boliviano (Bs)",
    );
    expect(getTranslation("en", "workspaceSettings.currencyOptions.bob")).toBe(
      "BOB · Bolivian boliviano (Bs)",
    );
  });

  it.each(supportedLocales)("has a label for every workspace currency in %s", (locale) => {
    for (const currencyCode of WORKSPACE_CURRENCY_CODES) {
      const key = `workspaceSettings.currencyOptions.${currencyCode.toLowerCase()}`;
      const label = getTranslation(locale, key);

      expect(label).not.toBe(key);
      expect(label).not.toBe(currencyCode);
    }
  });
});
