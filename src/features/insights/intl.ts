import { roundMoney } from "@/features/dashboard/lib/dashboard-math";

export type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

export function formatPercentValue(value: number, formatter: Intl.NumberFormat) {
  return `${formatter.format(roundMoney(value * 100))}%`;
}
