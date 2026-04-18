import { localeCompareByName } from "@/features/i18n/formatting";
import type { CategoryRow, DashboardLocale } from "@/features/dashboard/types/dashboard";
import type { TransactionType } from "@/types/database";

import { deviationTolerance, typeOrder } from "./dashboard-theme";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseAmountValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

export function buildMonthRange(year: number, month: number) {
  const monthStart = String(month).padStart(2, "0");
  const start = `${year}-${monthStart}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = String(nextMonth).padStart(2, "0");
  const end = `${nextYear}-${nextMonthStart}-01`;
  return { start, end };
}

export function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  const roundedValue = roundMoney(value);
  if (Math.abs(roundedValue) < deviationTolerance) {
    return formatter.format(0);
  }

  const absolute = formatter.format(Math.abs(roundedValue));
  return `${roundedValue > 0 ? "+" : "-"}${absolute}`;
}

export function buildSafeCurrencyFormatter(
  intlLocale: string,
  currencyCode: string,
  showCents: boolean,
  fallbackFormatter: Intl.NumberFormat,
) {
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  } catch {
    return fallbackFormatter;
  }
}

export function sortCategories(a: CategoryRow, b: CategoryRow, locale: DashboardLocale) {
  const typeDiff = typeOrder[a.type] - typeOrder[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const sortOrderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sortOrderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sortOrderA !== sortOrderB) {
    return sortOrderA - sortOrderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

export function clampToPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return value;
}

export function getDeviationColor(type: TransactionType, deviation: number) {
  if (Math.abs(deviation) < deviationTolerance) {
    return "#64748b";
  }

  if (type === "income") {
    return deviation > 0 ? "#087f5b" : "#c92a2a";
  }

  return deviation > 0 ? "#c92a2a" : "#087f5b";
}
