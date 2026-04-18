"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Collapse,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";

import {
  buildMonthOptions,
  localeCompareByName,
  mapTransactionTypeLabel,
  monthLabelFromOptions,
} from "@/features/i18n/formatting";
import {
  type TransactionFormInputValues,
  type TransactionFormValues,
} from "@/features/transactions/schema";
import {
  transactionTypeColorCssVar,
} from "@/features/transactions/type-colors";
import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { TransferModal } from "@/features/transactions/transfer-modal";
import { TransactionFormModal } from "@/features/transactions/transaction-form-modal";
import type { Database, TransactionType } from "@/types/database";
import {formatBudgetAmount} from "@/features/budget/amount-format";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code" | "show_cents"
>;

type TypeFilter = TransactionType | "all";
type QuickPaymentMethodType = "cash" | "debit_card" | "other";
type CategoryFilterOption = { value: string; label: string };
type CategoryFilterOptionGroup = { group: string; items: CategoryFilterOption[] };

type TransactionGroup = {
  key: string;
  label: string;
  rows: TransactionRow[];
};

const transactionTypeCardBackgrounds: Record<TransactionType, string> = {
  income: transactionTypeColorCssVar("income", 0),
  expense: transactionTypeColorCssVar("expense", 0),
  saving: transactionTypeColorCssVar("saving", 0),
  transfer: transactionTypeColorCssVar("transfer", 0),
};

const quickPaymentMethodTypes: QuickPaymentMethodType[] = ["cash", "debit_card", "other"];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildMonthRange(year: number, month: number) {
  const monthStart = String(month).padStart(2, "0");
  const start = `${year}-${monthStart}-01`;

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = String(nextMonth).padStart(2, "0");
  const end = `${nextYear}-${nextMonthStart}-01`;

  return { start, end };
}

function resolveOperationalDate(row: Pick<TransactionRow, "effective_date" | "transaction_date">) {
  return row.effective_date ?? row.transaction_date;
}

function parseQueryInteger(value: string | null, min: number, max: number) {
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

function isTransactionTypeValue(value: string | null): value is TransactionType {
  return value === "income" || value === "expense" || value === "saving";
}

function parseDateValue(dateValue: string) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toFormDefaults(
  row?: TransactionRow,
  preferredType: TransactionType = "expense",
): TransactionFormInputValues {
  if (!row) {
    const today = toDateInputValue(new Date());
    return {
      type: preferredType,
      categoryId: "",
      amount: "",
      transactionDate: today,
      effectiveDate: "",
      paymentMethodId: "",
      description: "",
      notes: "",
    };
  }

  return {
    type: row.type,
    categoryId: row.category_id,
    amount: formatBudgetAmount(row.amount),
    transactionDate: row.transaction_date,
    effectiveDate: row.effective_date ?? "",
    paymentMethodId: row.payment_method_id ?? "",
    description: row.description ?? "",
    notes: row.notes ?? "",
  };
}

function sortCategories(a: CategoryRow, b: CategoryRow, locale: "es" | "en") {
  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

function normalizeSearchText(value: string, locale: "es" | "en") {
  return value.trim().toLocaleLowerCase(locale === "en" ? "en" : "es");
}

function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function TransactionsPage() {
  const { supabase, workspace, user } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 47.99em)");

  const now = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [didApplyUrlFilters, setDidApplyUrlFilters] = useState(false);
  const [mobileFiltersOpened, setMobileFiltersOpened] = useState(false);
  const [quickPaymentMethodType, setQuickPaymentMethodType] =
    useState<QuickPaymentMethodType>("cash");
  const [formInitialValues, setFormInitialValues] = useState<TransactionFormInputValues>(
    toFormDefaults(),
  );
  const [createModalTypeFromQuery, setCreateModalTypeFromQuery] =
    useState<TransactionType | null>(null);
  const monthOptions = useMemo(() => buildMonthOptions(intlLocale), [intlLocale]);
  const transactionTypeLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      income: mapTransactionTypeLabel("income", t),
      expense: mapTransactionTypeLabel("expense", t),
      saving: mapTransactionTypeLabel("saving", t),
      transfer: mapTransactionTypeLabel("transfer", t),
    }),
    [t],
  );
  const transactionTypeSelectData = useMemo(
    () => [
      { value: "income", label: mapTransactionTypeLabel("income", t) },
      { value: "expense", label: mapTransactionTypeLabel("expense", t) },
      { value: "saving", label: mapTransactionTypeLabel("saving", t) },
    ],
    [t],
  );

  // Form state moved to TransactionFormModal

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const paymentMethodById = useMemo(
    () => new Map(paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod])),
    [paymentMethods],
  );
  const hasAnyPaymentMethods = paymentMethods.length > 0;

  const hasAnyActiveCategory = useMemo(
    () => categories.some((category) => category.is_active),
    [categories],
  );

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currencyCode, intlLocale]);

  const roundedCurrencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }, [currencyCode, intlLocale]);

  const visibleAmountFormatter = useMemo(
    () => (showCents ? currencyFormatter : roundedCurrencyFormatter),
    [currencyFormatter, roundedCurrencyFormatter, showCents],
  );

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [intlLocale]);

  const shortDateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
    });
  }, [intlLocale]);

  const longDateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "long",
    });
  }, [intlLocale]);

  const longDateWithYearFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [intlLocale]);

  const todayKey = useMemo(() => toDateInputValue(now), [now]);
  const yesterdayKey = useMemo(() => {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toDateInputValue(yesterday);
  }, [now]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const initialYear = Math.min(startYear, selectedYear, currentYear - 1);
    const finalYear = Math.max(selectedYear, currentYear + 2);
    const options: Array<{ value: string; label: string }> = [];

    for (let year = finalYear; year >= initialYear; year -= 1) {
      options.push({
        value: String(year),
        label: String(year),
      });
    }

    return options;
  }, [selectedYear, startYear]);


  const categoryFilterOptions = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => sortCategories(a, b, locale));
    const toOption = (category: CategoryRow): CategoryFilterOption => ({
      value: category.id,
      label: category.is_active
        ? category.name
        : `${category.name} (${t("transactions.inactiveCategorySuffix")})`,
    });
    const systemItems = sortedCategories
      .filter((category) => category.source === "system")
      .map(toOption);
    const customItems = sortedCategories
      .filter((category) => category.source === "custom")
      .map(toOption);
    const groupedOptions: CategoryFilterOptionGroup[] = [];

    if (systemItems.length > 0) {
      groupedOptions.push({
        group: t("categories.source.system"),
        items: systemItems,
      });
    }

    if (customItems.length > 0) {
      groupedOptions.push({
        group: t("categories.source.custom"),
        items: customItems,
      });
    }

    return [{ value: "all", label: t("transactions.allCategories") }, ...groupedOptions];
  }, [categories, locale, t]);

  const paymentMethodOptions = useMemo(() => {
    const currentPaymentMethodId = editingRow?.payment_method_id ?? null;

    return paymentMethods
      .filter(
        (paymentMethod) =>
          paymentMethod.is_active || paymentMethod.id === currentPaymentMethodId,
      )
      .sort((a, b) => localeCompareByName(a.name, b.name, locale))
      .map((paymentMethod) => ({
        value: paymentMethod.id,
        label: paymentMethod.is_active
          ? paymentMethod.name
          : `${paymentMethod.name} (${t("transactions.inactivePaymentMethodSuffix")})`,
      }));
  }, [editingRow?.payment_method_id, locale, paymentMethods, t]);

  const paymentMethodFilterOptions = useMemo(() => {
    const sortedPaymentMethods = [...paymentMethods].sort((a, b) =>
      localeCompareByName(a.name, b.name, locale),
    );

    return [
      { value: "all", label: t("transactions.all") },
      ...sortedPaymentMethods.map((paymentMethod) => ({
        value: paymentMethod.id,
        label: paymentMethod.is_active
          ? paymentMethod.name
          : `${paymentMethod.name} (${t("transactions.inactivePaymentMethodSuffix")})`,
      })),
    ];
  }, [locale, paymentMethods, t]);
  const quickPaymentMethodSelectData = useMemo(
    () =>
      quickPaymentMethodTypes.map((type) => ({
        value: type,
        label: t(`transactions.quickPayment.options.${type}`),
      })),
    [t],
  );

  const formatDate = useCallback(
    (dateValue: string | null) => {
      if (!dateValue) {
        return "-";
      }

      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      return dateFormatter.format(parsedDate);
    },
    [dateFormatter],
  );

  const formatCompactDate = useCallback(
    (dateValue: string) => {
      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      return shortDateFormatter
        .format(parsedDate)
        .replaceAll(".", "")
        .replace(" de ", " ")
        .toLocaleLowerCase(locale === "en" ? "en" : "es");
    },
    [locale, shortDateFormatter],
  );

  const formatGroupLabel = useCallback(
    (dateValue: string) => {
      if (dateValue === todayKey) {
        return t("transactions.today");
      }

      if (dateValue === yesterdayKey) {
        return t("transactions.yesterday");
      }

      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      if (parsedDate.getFullYear() === now.getFullYear()) {
        return longDateFormatter.format(parsedDate);
      }

      return longDateWithYearFormatter.format(parsedDate);
    },
    [longDateFormatter, longDateWithYearFormatter, now, t, todayKey, yesterdayKey],
  );

  const normalizedSearchFilter = useMemo(
    () => normalizeSearchText(searchFilter, locale),
    [locale, searchFilter],
  );

  const filteredRows = useMemo(() => {
    if (normalizedSearchFilter === "") {
      return rows;
    }

    return rows.filter((row) => {
      const category = categoryById.get(row.category_id);
      const paymentMethod = row.payment_method_id
        ? paymentMethodById.get(row.payment_method_id)
        : null;

      const searchPool = [
        category?.name ?? "",
        row.description ?? "",
        row.notes ?? "",
        paymentMethod?.name ?? "",
        transactionTypeLabels[row.type],
        formatDate(row.transaction_date),
        formatCompactDate(row.transaction_date),
        currencyFormatter.format(row.amount),
        roundedCurrencyFormatter.format(row.amount),
      ]
        .join(" ")
        .toLocaleLowerCase(locale === "en" ? "en" : "es");

      return searchPool.includes(normalizedSearchFilter);
    });
  }, [
    categoryById,
    currencyFormatter,
    formatCompactDate,
    formatDate,
    normalizedSearchFilter,
    paymentMethodById,
    locale,
    roundedCurrencyFormatter,
    rows,
    transactionTypeLabels,
  ]);

  const groupedRows = useMemo<TransactionGroup[]>(() => {
    const byDate = new Map<string, TransactionRow[]>();

    for (const row of filteredRows) {
      const dateKey = resolveOperationalDate(row);
      const groupRows = byDate.get(dateKey);

      if (groupRows) {
        groupRows.push(row);
      } else {
        byDate.set(dateKey, [row]);
      }
    }

    return Array.from(byDate.entries()).map(([key, groupedDateRows]) => ({
      key,
      label: formatGroupLabel(key),
      rows: groupedDateRows,
    }));
  }, [filteredRows, formatGroupLabel]);

  const activeFiltersCount =
    Number(typeFilter !== "all") +
    Number(categoryFilter !== "all") +
    Number(paymentMethodFilter !== "all") +
    Number(normalizedSearchFilter !== "");

  const clearOperationalFilters = useCallback(() => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setPaymentMethodFilter("all");
    setSearchFilter("");
  }, []);

  // typeSegmentStyles moved to TransactionFormModal

  useEffect(() => {
    if (didApplyUrlFilters) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    const yearFromQuery = parseQueryInteger(params.get("year"), 1900, 9999);
    if (yearFromQuery !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedYear(yearFromQuery);
    }

    const monthFromQuery = parseQueryInteger(params.get("month"), 1, 12);
    if (monthFromQuery !== null) {
      setSelectedMonth(monthFromQuery);
    }

    const typeFromQuery = params.get("type");
    if (isTransactionTypeValue(typeFromQuery)) {
      setTypeFilter(typeFromQuery);
    }

    const categoryFromQuery = params.get("categoryId") ?? params.get("category");
    if (categoryFromQuery && categoryFromQuery.trim() !== "") {
      setCategoryFilter(categoryFromQuery);
    }

    const paymentMethodFromQuery = params.get("paymentMethodId") ?? params.get("paymentMethod");
    if (paymentMethodFromQuery && paymentMethodFromQuery.trim() !== "") {
      setPaymentMethodFilter(paymentMethodFromQuery);
    }

    const searchFromQuery = params.get("search");
    if (searchFromQuery && searchFromQuery.trim() !== "") {
      setSearchFilter(searchFromQuery.trim());
    }

    if (params.get("new") === "1") {
      const prefillTypeFromQuery = params.get("prefillType");
      if (isTransactionTypeValue(prefillTypeFromQuery)) {
        setCreateModalTypeFromQuery(prefillTypeFromQuery);
      } else {
        setCreateModalTypeFromQuery("expense");
      }
    }

    setDidApplyUrlFilters(true);
  }, [didApplyUrlFilters]);

  // categoryId and paymentMethodId validation moved to TransactionFormModal

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (categoryFilter === "all") {
      return;
    }

    const isFilterAvailable = categoryFilterOptions.some((option) =>
      "items" in option
        ? option.items.some((item) => item.value === categoryFilter)
        : option.value === categoryFilter,
    );
    if (!isFilterAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryFilter("all");
    }
  }, [categoryFilter, categoryFilterOptions, isBootstrapping]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    if (paymentMethodFilter === "all") {
      return;
    }

    const isFilterAvailable = paymentMethodFilterOptions.some(
      (option) => option.value === paymentMethodFilter,
    );
    if (!isFilterAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentMethodFilter("all");
    }
  }, [isBootstrapping, paymentMethodFilter, paymentMethodFilterOptions]);

  const loadBaseData = useCallback(async () => {
    setIsBootstrapping(true);

    const [categoriesResponse, paymentMethodsResponse, settingsResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payment_methods")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("start_year, currency_code, show_cents")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
    ]);

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadCategoriesError"),
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const sorted = [...categoriesResponse.data].sort((a, b) => sortCategories(a, b, locale));
      setCategories(sorted);
    }

    if (paymentMethodsResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadPaymentMethodsError"),
        message: paymentMethodsResponse.error.message,
      });
      setPaymentMethods([]);
    } else {
      setPaymentMethods(paymentMethodsResponse.data);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadSettingsError"),
        message: settingsResponse.error.message,
      });
      setStartYear(new Date().getFullYear());
      setCurrencyCode("ARS");
      setShowCents(false);
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setStartYear(settings?.start_year ?? new Date().getFullYear());
      setCurrencyCode(settings?.currency_code ?? "ARS");
      setShowCents(settings?.show_cents ?? false);
    }

    setIsBootstrapping(false);
  }, [locale, supabase, t, workspace.id]);

  const loadTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);

    const { start, end } = buildMonthRange(selectedYear, selectedMonth);
    const periodFilter = [
      `and(effective_date.gte.${start},effective_date.lt.${end})`,
      `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
    ].join(",");

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspace.id)
      .or(periodFilter)
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    if (categoryFilter !== "all") {
      query = query.eq("category_id", categoryFilter);
    }

    if (paymentMethodFilter !== "all") {
      query = query.eq("payment_method_id", paymentMethodFilter);
    }

    const response = await query;
    setIsLoadingTransactions(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadTransactionsError"),
        message: response.error.message,
      });
      return;
    }

    const sortedRows = [...response.data].sort((a, b) => {
      const dateDiff = resolveOperationalDate(b).localeCompare(resolveOperationalDate(a));
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return b.created_at.localeCompare(a.created_at);
    });

    setRows(sortedRows);
  }, [
    categoryFilter,
    paymentMethodFilter,
    selectedMonth,
    selectedYear,
    supabase,
    t,
    typeFilter,
    workspace.id,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTransactions();
  }, [isBootstrapping, loadTransactions]);

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    setQuickPaymentMethodType("cash");
  }

  const openCreateModal = useCallback(
    (preferredType?: TransactionType) => {
      const defaultType = preferredType ?? (typeFilter === "all" ? "expense" : typeFilter);
      const filteredCategory = categoryFilter !== "all" ? categoryById.get(categoryFilter) : null;
      const filteredPaymentMethod =
        paymentMethodFilter !== "all" ? paymentMethodById.get(paymentMethodFilter) : null;

      const resolvedType = filteredCategory?.is_active ? filteredCategory.type : defaultType;
      const defaults = toFormDefaults(undefined, resolvedType);

      if (filteredCategory?.is_active && filteredCategory.type === resolvedType) {
        defaults.categoryId = filteredCategory.id;
      }

      if (filteredPaymentMethod?.is_active) {
        defaults.paymentMethodId = filteredPaymentMethod.id;
      }

      if (!hasAnyPaymentMethods) {
        setQuickPaymentMethodType("cash");
      }

      setEditingRow(null);
      setFormInitialValues(defaults);
      setIsModalOpen(true);
    },
    [
      categoryById,
      categoryFilter,
      hasAnyPaymentMethods,
      paymentMethodById,
      paymentMethodFilter,
      typeFilter,
    ],
  );

  function openEditModal(row: TransactionRow) {
    setEditingRow(row);
    setFormInitialValues(toFormDefaults(row));
    setQuickPaymentMethodType("cash");
    setIsModalOpen(true);
  }

  useEffect(() => {
    if (createModalTypeFromQuery === null || isBootstrapping || isModalOpen) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreateModal(createModalTypeFromQuery);
    setCreateModalTypeFromQuery(null);

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("new");
    params.delete("prefillType");

    const query = params.toString();
    const nextUrl = query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [createModalTypeFromQuery, isBootstrapping, isModalOpen, openCreateModal]);

  const onSubmit = async (values: TransactionFormValues) => {
    const category = categoryById.get(values.categoryId);
    if (!category || category.workspace_id !== workspace.id) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.invalidCategoryTitle"),
        message: t("transactions.notifications.invalidCategoryMessage"),
      });
      return;
    }

    if (category.type !== values.type) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.incompatibleTypeTitle"),
        message: t("transactions.notifications.incompatibleTypeMessage"),
      });
      return;
    }

    if (!category.is_active && (!editingRow || editingRow.category_id !== category.id)) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.inactiveCategoryTitle"),
        message: t("transactions.notifications.inactiveCategoryMessage"),
      });
      return;
    }

    let resolvedPaymentMethodId = values.paymentMethodId;
    let quickCreatedPaymentMethod: PaymentMethodRow | null = null;

    const shouldAutoCreateQuickPaymentMethod =
      !editingRow && !hasAnyPaymentMethods && resolvedPaymentMethodId === null;

    if (shouldAutoCreateQuickPaymentMethod) {
      const quickMethodName = t(`transactions.quickPayment.defaultNames.${quickPaymentMethodType}`);
      const createQuickMethodResponse = await supabase
        .from("payment_methods")
        .insert({
          workspace_id: workspace.id,
          name: quickMethodName,
          type: quickPaymentMethodType,
          current_balance: 0,
          include_in_balance: true,
          is_active: true,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (createQuickMethodResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.quickPaymentCreateError"),
          message: createQuickMethodResponse.error.message,
        });
        return;
      }

      const createdQuickMethod = createQuickMethodResponse.data;
      if (!createdQuickMethod) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.quickPaymentCreateError"),
          message: t("transactions.notifications.unexpectedQuickPaymentCreateError"),
        });
        return;
      }

      quickCreatedPaymentMethod = createdQuickMethod;
      resolvedPaymentMethodId = createdQuickMethod.id;
      setPaymentMethods((previousRows) => [...previousRows, createdQuickMethod]);
    }

    const paymentMethod = resolvedPaymentMethodId
      ? quickCreatedPaymentMethod?.id === resolvedPaymentMethodId
        ? quickCreatedPaymentMethod
        : paymentMethodById.get(resolvedPaymentMethodId)
      : null;

    if (resolvedPaymentMethodId && (!paymentMethod || paymentMethod.workspace_id !== workspace.id)) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.invalidPaymentMethodTitle"),
        message: t("transactions.notifications.invalidPaymentMethodMessage"),
      });
      return;
    }

    if (
      paymentMethod &&
      !paymentMethod.is_active &&
      (!editingRow || editingRow.payment_method_id !== paymentMethod.id)
    ) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.inactivePaymentMethodTitle"),
        message: t("transactions.notifications.inactivePaymentMethodMessage"),
      });
      return;
    }

    const payload = {
      type: values.type,
      category_id: values.categoryId,
      amount: Math.round(values.amount * 100) / 100,
      transaction_date: values.transactionDate,
      effective_date: values.effectiveDate,
      payment_method_id: resolvedPaymentMethodId,
      description: values.description,
      notes: values.notes,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editingRow.id)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.saveChangesError"),
          message: updateResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.updatedTitle"),
        message: t("transactions.notifications.updatedMessage"),
      });
    } else {
      const insertResponse = await supabase.from("transactions").insert({
        workspace_id: workspace.id,
        type: payload.type,
        category_id: payload.category_id,
        amount: payload.amount,
        transaction_date: payload.transaction_date,
        effective_date: payload.effective_date,
        payment_method_id: payload.payment_method_id,
        description: payload.description,
        notes: payload.notes,
        is_recurring: false,
        created_by: user.id,
      });

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.registerError"),
          message: insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.createdTitle"),
        message: t("transactions.notifications.createdMessage"),
      });
    }

    closeModal();
    setFormInitialValues(toFormDefaults(undefined, values.type));
    await loadTransactions();
  };

  const shouldShowQuickPaymentSetup = !editingRow && !hasAnyPaymentMethods;

  async function deleteTransaction(row: TransactionRow) {
    setDeletingId(row.id);

    let query = supabase.from("transactions").delete().eq("workspace_id", workspace.id);

    if (row.type === "transfer" && row.transfer_group_id) {
      query = query.eq("transfer_group_id", row.transfer_group_id);
    } else {
      query = query.eq("id", row.id);
    }

    const response = await query;
    setDeletingId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title:
          row.type === "transfer"
            ? t("transactions.notifications.transferDeleteError")
            : t("transactions.notifications.deleteError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title:
        row.type === "transfer"
          ? t("transactions.notifications.transferDeletedTitle")
          : t("transactions.notifications.deletedTitle"),
      message:
        row.type === "transfer"
          ? t("transactions.notifications.transferDeletedMessage")
          : t("transactions.notifications.deletedMessage"),
    });

    await loadTransactions();
  }

  function confirmDelete(row: TransactionRow) {
    modals.openConfirmModal({
      title: t("transactions.delete"),
      centered: true,
      labels: {
        confirm: t("transactions.delete"),
        cancel: t("common.actions.cancel"),
      },
      confirmProps: {
        color: "red",
      },
      children: (
        <Text size="sm" c="dimmed">
          {t("transactions.confirmDeleteBody")}
        </Text>
      ),
      onConfirm: () => {
        void deleteTransaction(row);
      },
    });
  }

  return (
    <Stack gap="sm" pos="relative" style={isMobile ? { paddingBottom: "5.2rem" } : undefined}>
      <LoadingOverlay visible={isBootstrapping || isLoadingTransactions} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2} component="h1">{t("transactions.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("transactions.subtitle")}
          </Text>
        </Stack>

        {!isMobile ? (
          <Group gap="xs">
            <Button onClick={() => openCreateModal()} disabled={!hasAnyActiveCategory}>
              {t("transactions.new")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsTransferModalOpen(true)}
              disabled={!hasAnyActiveCategory}
            >
              {t("transactions.transfer")}
            </Button>
          </Group>
        ) : null}
      </Group>

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          {isMobile ? (
            <Group justify="space-between" align="center" gap="xs">
              <Text fw={600} size="sm">
                {t("transactions.filters", "Filtros")}
              </Text>
              <Group gap="xs">
                {activeFiltersCount > 0 ? (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="compact-xs"
                    onClick={clearOperationalFilters}
                  >
                    {t("common.actions.clearFilters", "Limpiar")}
                  </Button>
                ) : null}
                <Button
                  variant="light"
                  color="gray"
                  size="compact-xs"
                  onClick={() => setMobileFiltersOpened((prev) => !prev)}
                >
                  {mobileFiltersOpened
                    ? t("transactions.hideFilters", "Ocultar")
                    : t("transactions.showFilters", "Mostrar")}
                </Button>
              </Group>
            </Group>
          ) : null}

          <Collapse expanded={!isMobile || mobileFiltersOpened}>
            <Group align="end" wrap="wrap" gap="xs">
              <NativeSelect
                label={t("transactions.year")}
                data={yearOptions}
                value={String(selectedYear)}
                onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
                style={{ minWidth: 104 }}
              />

              <NativeSelect
                label={t("transactions.month")}
                data={monthOptions}
                value={String(selectedMonth)}
                onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
                style={{ minWidth: 132 }}
              />

              <NativeSelect
                label={t("transactions.type")}
                data={[{ value: "all", label: t("transactions.all") }, ...transactionTypeSelectData]}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
                style={{ minWidth: 132 }}
              />

              <NativeSelect
                label={t("transactions.category")}
                data={categoryFilterOptions}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.currentTarget.value)}
                style={{ minWidth: 180 }}
              />

              <NativeSelect
                label={t("transactions.paymentMethodShort")}
                data={paymentMethodFilterOptions}
                value={paymentMethodFilter}
                onChange={(event) => setPaymentMethodFilter(event.currentTarget.value)}
                style={{ minWidth: 180 }}
              />

              <TextInput
                label={t("transactions.search")}
                placeholder={t("transactions.searchPlaceholder")}
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.currentTarget.value)}
                style={{ minWidth: 220, flex: "1 1 220px" }}
              />
            </Group>
          </Collapse>

          {!isMobile && activeFiltersCount > 0 ? (
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                onClick={clearOperationalFilters}
              >
                {t("common.actions.clearFilters", "Limpiar filtros")}
              </Button>
            </Group>
          ) : null}

          <Text size="xs" c="dimmed">
            {t("transactions.summaryMovements", undefined, {
              monthYear: `${monthLabelFromOptions(selectedMonth, monthOptions, t("common.messages.month"))} ${selectedYear}`,
              count: filteredRows.length,
              pluralSuffix: filteredRows.length === 1 ? "" : "s",
              filtersText:
                activeFiltersCount > 0
                  ? t("transactions.activeFiltersText", undefined, {
                      count: activeFiltersCount,
                      pluralSuffix: activeFiltersCount === 1 ? "" : "s",
                      activePluralSuffix: activeFiltersCount === 1 ? "" : "s",
                    })
                  : "",
            })}
          </Text>
        </Stack>
      </Paper>

      {!hasAnyActiveCategory ? (
        <Alert color="yellow" variant="light">
          {t("transactions.needActiveCategory")}
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p={6}>
        {groupedRows.length === 0 ? (
          <Text size="sm" c="dimmed" p="xs">
            {t("transactions.emptyState")}
          </Text>
        ) : (
          <Stack gap={8}>
            {groupedRows.map((group) => (
              <Stack key={group.key} gap={5}>
                <Text
                  size="10px"
                  fw={700}
                  c="dimmed"
                  px={6}
                  tt="uppercase"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {group.label}
                </Text>

                <Stack gap={5}>
                  {group.rows.map((row) => {
                    const category = categoryById.get(row.category_id);
                    const paymentMethod = row.payment_method_id
                      ? paymentMethodById.get(row.payment_method_id)
                      : null;
                    const operationalDate = resolveOperationalDate(row);

                    const metaParts = [formatCompactDate(operationalDate)];
                    if (paymentMethod?.name) {
                      metaParts.push(paymentMethod.name);
                    }
                    if (row.effective_date) {
                      metaParts.push(
                        `${t("transactions.realPrefix")} ${formatCompactDate(row.transaction_date)}`,
                      );
                    }

                    return (
                      <Paper
                        key={row.id}
                        withBorder
                        radius={6}
                        p={isMobile ? 7 : 8}
                        style={{
                          backgroundColor: transactionTypeCardBackgrounds[row.type],
                          borderColor: "var(--mantine-color-gray-3)",
                        }}
                      >
                        <Stack gap={3}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap" gap={6}>
                            <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={600} size="sm" lineClamp={1} style={{ lineHeight: 1.15 }}>
                                {category?.name ?? t("transactions.categoryUnavailable")}
                              </Text>

                              {row.description ? (
                                <Text size="11px" c="dimmed" lineClamp={1} style={{ lineHeight: 1.15 }}>
                                  {row.description}
                                </Text>
                              ) : null}
                            </Stack>

                            <Stack
                              align="flex-end"
                              gap={1}
                              style={{ minWidth: isMobile ? 132 : 196, flexShrink: 0 }}
                            >
                              <Text
                                fw={800}
                                style={{
                                  fontSize: isMobile ? "1.2rem" : "1.5rem",
                                  textAlign: "right",
                                  lineHeight: 1,
                                  letterSpacing: "-0.01em",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {visibleAmountFormatter.format(row.amount)}
                              </Text>
                            </Stack>
                          </Group>

                          <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                            <Text size="11px" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
                              {metaParts.join(" · ")}
                            </Text>

                            <Group gap={1} wrap="nowrap">
                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                leftSection={<EditIcon size={11} />}
                                onClick={() => openEditModal(row)}
                                aria-label={t("transactions.edit")}
                                px={isMobile ? 6 : 8}
                                styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                              >
                                {isMobile ? null : t("transactions.edit")}
                              </Button>
                              <Button
                                size="xs"
                                variant="subtle"
                                color="red"
                                leftSection={<TrashIcon size={11} />}
                                loading={deletingId === row.id}
                                onClick={() => confirmDelete(row)}
                                aria-label={t("transactions.delete")}
                                px={isMobile ? 6 : 8}
                                styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                              >
                                {isMobile ? null : t("transactions.delete")}
                              </Button>
                            </Group>
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      {isMobile ? (
        <Paper
          withBorder
          radius={8}
          p={6}
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
            zIndex: 40,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow: "0 -8px 18px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Button onClick={() => openCreateModal()} disabled={!hasAnyActiveCategory} fullWidth>
            {t("transactions.new")}
          </Button>
        </Paper>
      ) : null}

      <TransactionFormModal
        opened={isModalOpen}
        onClose={closeModal}
        editingRow={editingRow}
        categories={categories}
        paymentMethodOptions={paymentMethodOptions}
        transactionTypeSelectData={transactionTypeSelectData}
        isMobile={isMobile}
        quickPaymentMethodType={quickPaymentMethodType}
        setQuickPaymentMethodType={setQuickPaymentMethodType}
        quickPaymentMethodSelectData={quickPaymentMethodSelectData}
        shouldShowQuickPaymentSetup={shouldShowQuickPaymentSetup}
        initialValues={formInitialValues}
        onSubmit={onSubmit}
      />

      <TransferModal
        opened={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        categories={categories}
        paymentMethods={paymentMethods}
        onSuccess={loadTransactions}
      />
    </Stack>
  );
}
