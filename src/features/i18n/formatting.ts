import type { Locale } from "@/features/i18n/config";
import type { PaymentMethodType, TransactionType } from "@/types/database";

export function buildMonthOptions(intlLocale: string) {
  const formatter = new Intl.DateTimeFormat(intlLocale, { month: "long" });

  return Array.from({ length: 12 }, (_, index) => {
    const monthValue = index + 1;
    const rawLabel = formatter.format(new Date(2026, index, 1));
    const label = rawLabel.replace(/^./, (char) => char.toUpperCase());

    return {
      value: String(monthValue),
      label,
    };
  });
}

export function monthLabelFromOptions(
  month: number,
  monthOptions: Array<{ value: string; label: string }>,
  fallbackPrefix: string,
) {
  return monthOptions.find((option) => Number(option.value) === month)?.label ?? `${fallbackPrefix} ${month}`;
}

export function localeCompareByName(a: string, b: string, locale: Locale) {
  const compareLocale = locale === "en" ? "en" : "es";
  return a.localeCompare(b, compareLocale);
}

export function mapTransactionTypeLabel(
  type: TransactionType,
  t: (key: string, fallback?: string) => string,
  options?: { plural?: boolean },
) {
  if (options?.plural) {
    if (type === "income") return t("common.domain.transactionType.incomes", "Income");
    if (type === "expense") return t("common.domain.transactionType.expenses", "Expenses");
    return t("common.domain.transactionType.savings", "Savings");
  }

  if (type === "income") return t("common.domain.transactionType.income", "Income");
  if (type === "expense") return t("common.domain.transactionType.expense", "Expense");
  return t("common.domain.transactionType.saving", "Saving");
}

export function mapPaymentMethodTypeLabel(
  type: PaymentMethodType,
  t: (key: string, fallback?: string) => string,
) {
  return t(`common.domain.paymentMethodType.${type}`);
}
