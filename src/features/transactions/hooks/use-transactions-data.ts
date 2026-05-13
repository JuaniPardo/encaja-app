"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notifications } from "@mantine/notifications";

import {
  sortSubcategories,
} from "@/features/categories/subcategories";
import {
  buildMonthOptions,
  localeCompareByName,
  mapTransactionTypeLabel,
} from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import {
  buildMonthRange,
  isTransactionTypeValue,
  normalizeSearchText,
  parseDateValue,
  parseQueryInteger,
  quickPaymentMethodTypes,
  resolveOperationalDate,
  sortCategories,
  toDateInputValue,
  type CategoryRow,
  type CategorySubcategoryRow,
  type PaymentMethodRow,
  type TransactionRow,
  type TypeFilter,
  type WorkspaceSettingsLiteRow,
} from "@/features/transactions/utils";
import type { TransactionType } from "@/types/database";

import type { TransactionGroup } from "../transactions-list";

type CategoryFilterOption = { value: string; label: string };
type CategoryFilterOptionGroup = { group: string; items: CategoryFilterOption[] };

export function useTransactionsData() {
  const { supabase, workspace } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();

  const now = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<CategorySubcategoryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [didApplyUrlFilters, setDidApplyUrlFilters] = useState(false);
  const [mobileFiltersOpened, setMobileFiltersOpened] = useState(false);
  const [createModalTypeFromQuery, setCreateModalTypeFromQuery] =
    useState<TransactionType | null>(null);
  const [openTransferModalFromQuery, setOpenTransferModalFromQuery] = useState(false);

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

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const subcategoryById = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])),
    [subcategories],
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

  const hasActiveTransferCategory = useMemo(
    () => categories.some((category) => category.type === "transfer" && category.is_active),
    [categories],
  );

  const activePaymentMethodsCount = useMemo(
    () => paymentMethods.filter((paymentMethod) => paymentMethod.is_active).length,
    [paymentMethods],
  );

  const canCreateTransaction = hasAnyActiveCategory;
  const canCreateTransfer = hasActiveTransferCategory && activePaymentMethodsCount >= 2;

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
      const subcategory = row.subcategory_id ? subcategoryById.get(row.subcategory_id) : null;
      const paymentMethod = row.payment_method_id
        ? paymentMethodById.get(row.payment_method_id)
        : null;

      const searchPool = [
        category?.name ?? "",
        subcategory?.name ?? "",
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
    subcategoryById,
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

  const filteredRowsCount = filteredRows.length;

  const activeFiltersCount =
    Number(typeFilter !== "all") +
    Number(categoryFilter !== "all") +
    Number(subcategoryFilter !== "all") +
    Number(paymentMethodFilter !== "all") +
    Number(normalizedSearchFilter !== "");

  const clearOperationalFilters = useCallback(() => {
    setTypeFilter("all");
    setCategoryFilter("all");
    setSubcategoryFilter("all");
    setPaymentMethodFilter("all");
    setSearchFilter("");
  }, []);

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

    const subcategoryFromQuery = params.get("subcategoryId") ?? params.get("subcategory");
    if (subcategoryFromQuery && subcategoryFromQuery.trim() !== "") {
      setSubcategoryFilter(subcategoryFromQuery);
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

    if (params.get("newTransfer") === "1") {
      setOpenTransferModalFromQuery(true);
    }

    setDidApplyUrlFilters(true);
  }, [didApplyUrlFilters]);

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

    if (subcategoryFilter === "all") {
      return;
    }

    const isFilterAvailable = subcategories.some((subcategory) => subcategory.id === subcategoryFilter);
    if (!isFilterAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubcategoryFilter("all");
    }
  }, [isBootstrapping, subcategories, subcategoryFilter]);

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

    const categoriesResponse = await supabase
      .from("categories")
      .select("id, workspace_id, name, type, is_active, source, sort_order, is_exceptional")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const subcategoriesResponse = await supabase
      .from("category_subcategories")
      .select("id, workspace_id, category_id, name, is_active, sort_order")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const paymentMethodsResponse = await supabase
      .from("payment_methods")
      .select("id, workspace_id, name, type, is_active")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const settingsResponse = await supabase
      .from("workspace_settings")
      .select("start_year, currency_code, show_cents")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadCategoriesError"),
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const sorted = ([...categoriesResponse.data] as CategoryRow[]).sort((a, b) => sortCategories(a, b, locale));
      setCategories(sorted);
    }

    if (subcategoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadSubcategoriesError"),
        message: subcategoriesResponse.error.message,
      });
      setSubcategories([]);
    } else {
      const sorted = ([...subcategoriesResponse.data] as CategorySubcategoryRow[]).sort((a, b) =>
        sortSubcategories(a, b, locale),
      );
      setSubcategories(sorted);
    }

    if (paymentMethodsResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.loadPaymentMethodsError"),
        message: paymentMethodsResponse.error.message,
      });
      setPaymentMethods([]);
    } else {
      setPaymentMethods((paymentMethodsResponse.data ?? []) as PaymentMethodRow[]);
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
      .select("id, category_id, subcategory_id, amount, type, transaction_date, effective_date, payment_method_id, description, notes, installment_purchase_id, installment_number, installment_count, transfer_group_id, direction, created_at")
      .eq("workspace_id", workspace.id)
      .or(periodFilter)
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    if (categoryFilter !== "all") {
      query = query.eq("category_id", categoryFilter);
    }

    if (subcategoryFilter !== "all") {
      query = query.eq("subcategory_id", subcategoryFilter);
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

    const sortedRows = ([...(response.data ?? [])] as unknown as TransactionRow[]).sort((a, b) => {
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
    subcategoryFilter,
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

  return {
    rows,
    filteredRows,
    categories,
    subcategories,
    paymentMethods,
    setPaymentMethods,
    currencyCode,
    showCents,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    typeFilter,
    setTypeFilter,
    categoryFilter,
    setCategoryFilter,
    subcategoryFilter,
    setSubcategoryFilter,
    paymentMethodFilter,
    setPaymentMethodFilter,
    searchFilter,
    setSearchFilter,
    isBootstrapping,
    isLoadingTransactions,
    createModalTypeFromQuery,
    setCreateModalTypeFromQuery,
    openTransferModalFromQuery,
    setOpenTransferModalFromQuery,
    monthOptions,
    transactionTypeSelectData,
    categoryById,
    subcategoryById,
    paymentMethodById,
    hasAnyPaymentMethods,
    hasAnyActiveCategory,
    canCreateTransaction,
    canCreateTransfer,
    visibleAmountFormatter,
    yearOptions,
    categoryFilterOptions,
    paymentMethodFilterOptions,
    quickPaymentMethodSelectData,
    formatDate,
    formatCompactDate,
    groupedRows,
    filteredRowsCount,
    activeFiltersCount,
    clearOperationalFilters,
    mobileFiltersOpened,
    setMobileFiltersOpened,
    loadTransactions,
  };
}
