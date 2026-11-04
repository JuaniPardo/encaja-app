export type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

export function createPercentFormatter(intlLocale: string) {
  return new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 0 });
}

// es-AR separa el signo con un espacio ("62 %"); los insights lo muestran pegado ("62%").
export function formatPercentValue(value: number, percentFormatter: Intl.NumberFormat) {
  return percentFormatter
    .formatToParts(value)
    .filter((part) => !(part.type === "literal" && part.value.trim() === ""))
    .map((part) => part.value)
    .join("");
}
