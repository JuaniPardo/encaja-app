"use client";

import { formatBudgetAmount } from "@/features/budget/amount-format";
import { localeCompareByName } from "@/features/i18n/formatting";
import type { Database, TransactionType } from "@/types/database";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type CategorySubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];
export type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
export type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code" | "show_cents"
>;

export type TypeFilter = TransactionType | "all";
export type QuickPaymentMethodType = "cash" | "debit_card";

export const quickPaymentMethodTypes: QuickPaymentMethodType[] = ["cash", "debit_card"];

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

export function resolveOperationalDate(
  row: Pick<
    TransactionRow,
    | "effective_date"
    | "transaction_date"
    | "installment_purchase_id"
    | "installment_number"
    | "installment_count"
  >,
) {
  const isInstallment =
    row.installment_purchase_id !== null &&
    row.installment_number !== null &&
    row.installment_count !== null;

  if (isInstallment && row.installment_number === 1) {
    return row.transaction_date;
  }

  return row.effective_date ?? row.transaction_date;
}

export function parseQueryInteger(value: string | null, min: number, max: number) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

export function isTransactionTypeValue(value: string | null): value is TransactionType {
  return value === "income" || value === "expense" || value === "saving";
}

export function parseDateValue(dateValue: string) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function toFormDefaults(
  row?: TransactionRow,
  preferredType: TransactionType = "expense",
) {
  if (!row) {
    const today = toDateInputValue(new Date());
    return {
      type: preferredType,
      categoryId: "",
      subcategoryId: "",
      amount: "",
      transactionDate: today,
      effectiveDate: "",
      paymentMethodId: "",
      installmentsCount: 1,
      description: "",
      notes: "",
    };
  }

  return {
    type: row.type,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id ?? "",
    amount: formatBudgetAmount(row.amount),
    transactionDate: row.transaction_date,
    effectiveDate: row.effective_date ?? "",
    paymentMethodId: row.payment_method_id ?? "",
    installmentsCount: row.installment_count ?? 1,
    description: row.description ?? "",
    notes: row.notes ?? "",
  };
}

export function sortCategories(a: CategoryRow, b: CategoryRow, locale: "es" | "en") {
  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

export function normalizeSearchText(value: string, locale: "es" | "en") {
  return value.trim().toLocaleLowerCase(locale === "en" ? "en" : "es");
}
