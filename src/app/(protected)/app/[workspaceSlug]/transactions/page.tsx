"use client";

import { useMemo, useState } from "react";
import { Alert, Group, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import dynamic from "next/dynamic";

import { monthLabelFromOptions } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import {
  TransactionDetailModal,
  TransactionDetailPanel,
} from "@/features/transactions/transaction-detail-panel";
import { TransactionInsight } from "@/features/transactions/transaction-insight";
import {
  TransactionsHeaderActions,
  TransactionsMobileActionsBar,
} from "@/features/transactions/transaction-actions";
import { useTransactionsData } from "@/features/transactions/hooks/use-transactions-data";
import { useTransactionsMutations } from "@/features/transactions/hooks/use-transactions-mutations";
import { TransactionsFiltersPanel } from "@/features/transactions/transactions-filters-panel";
import { TransactionsList } from "@/features/transactions/transactions-list";
import { parseDateValue, resolveOperationalDate, type TypeFilter } from "@/features/transactions/utils";

const TransactionFormModal = dynamic(() =>
  import("@/features/transactions/transaction-form-modal").then((mod) => mod.TransactionFormModal),
);

const TransferModal = dynamic(() =>
  import("@/features/transactions/transfer-modal").then((mod) => mod.TransferModal),
);

export default function TransactionsPage() {
  const { t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const data = useTransactionsData();
  const mutations = useTransactionsMutations({
    categoryById: data.categoryById,
    subcategoryById: data.subcategoryById,
    paymentMethodById: data.paymentMethodById,
    hasAnyPaymentMethods: data.hasAnyPaymentMethods,
    typeFilter: data.typeFilter,
    categoryFilter: data.categoryFilter,
    paymentMethodFilter: data.paymentMethodFilter,
    loadTransactions: data.loadTransactions,
    setPaymentMethods: data.setPaymentMethods,
    isBootstrapping: data.isBootstrapping,
    createModalTypeFromQuery: data.createModalTypeFromQuery,
    setCreateModalTypeFromQuery: data.setCreateModalTypeFromQuery,
    openTransferModalFromQuery: data.openTransferModalFromQuery,
    setOpenTransferModalFromQuery: data.setOpenTransferModalFromQuery,
  });

  const selectedRow = useMemo(() => {
    const explicitSelection =
      data.filteredRows.find((row) => row.id === selectedTransactionId) ?? null;

    if (explicitSelection) {
      return explicitSelection;
    }

    return data.groupedRows[0]?.rows[0] ?? null;
  }, [data.filteredRows, data.groupedRows, selectedTransactionId]);

  const insight = useMemo(() => {
    const expenseRows = data.filteredRows.filter((row) => row.type === "expense");
    if (expenseRows.length === 0) {
      return {
        title: t("transactions.insight.emptyTitle", "No expense movements in view."),
        detail: t(
          "transactions.insight.emptyBody",
          "Change filters or register a transaction to see spending context here.",
        ),
      };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() - diffToMonday);

    const weeklyRows = expenseRows.filter((row) => {
      const parsedDate = parseDateValue(resolveOperationalDate(row));
      return parsedDate !== null && parsedDate >= weekStart && parsedDate <= now;
    });

    const rowsForInsight = weeklyRows.length > 0 ? weeklyRows : expenseRows;
    const amount = rowsForInsight.reduce((total, row) => total + row.amount, 0);
    const totalsByCategory = new Map<string, number>();

    for (const row of rowsForInsight) {
      totalsByCategory.set(row.category_id, (totalsByCategory.get(row.category_id) ?? 0) + row.amount);
    }

    const topCategoryId =
      Array.from(totalsByCategory.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const topCategoryName = topCategoryId
      ? data.categoryById.get(topCategoryId)?.name ?? t("transactions.categoryUnavailable")
      : t("transactions.categoryUnavailable");

    if (weeklyRows.length > 0) {
      return {
        title: t("transactions.insight.weekTitle", "You spent {{amount}} this week.", {
          amount: data.visibleAmountFormatter.format(amount),
        }),
        detail: t("transactions.insight.weekBody", "Main category: {{category}}.", {
          category: topCategoryName,
        }),
      };
    }

    return {
      title: t("transactions.insight.monthTitle", "{{count}} expense movements in this view.", {
        count: String(expenseRows.length),
        pluralSuffix: expenseRows.length === 1 ? "" : "s",
      }),
      detail: t("transactions.insight.monthBody", "Accumulated: {{amount}} · Main category: {{category}}.", {
        amount: data.visibleAmountFormatter.format(amount),
        category: topCategoryName,
      }),
    };
  }, [data.categoryById, data.filteredRows, data.visibleAmountFormatter, t]);

  const handleSelectTransaction = (row: (typeof data.filteredRows)[number]) => {
    setSelectedTransactionId(row.id);
    if (isMobile) {
      setIsDetailModalOpen(true);
    }
  };

  return (
    <Stack gap="sm" pos="relative" style={isMobile ? { paddingBottom: "6rem" } : undefined}>
      <LoadingOverlay visible={data.isBootstrapping || data.isLoadingTransactions} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2} component="h1">
            {t("transactions.title")}
          </Title>
          <Text c="dimmed" size="sm">
            {t("transactions.subtitle")}
          </Text>
        </Stack>

        <TransactionsHeaderActions
          isMobile={isMobile}
          canCreateTransaction={data.canCreateTransaction}
          canCreateTransfer={data.canCreateTransfer}
          onCreateTransaction={() => mutations.openCreateModal()}
          onCreateTransfer={() => mutations.setIsTransferModalOpen(true)}
        />
      </Group>

      <TransactionsFiltersPanel
        isMobile={isMobile}
        mobileFiltersOpened={data.mobileFiltersOpened}
        onToggleMobileFilters={() => data.setMobileFiltersOpened((previous) => !previous)}
        activeFiltersCount={data.activeFiltersCount}
        onClearFilters={data.clearOperationalFilters}
        yearOptions={data.yearOptions}
        selectedYear={data.selectedYear}
        onSelectedYearChange={data.setSelectedYear}
        monthOptions={data.monthOptions}
        selectedMonth={data.selectedMonth}
        onSelectedMonthChange={data.setSelectedMonth}
        typeFilter={data.typeFilter}
        onTypeFilterChange={(nextType) => data.setTypeFilter(nextType as TypeFilter)}
        transactionTypeSelectData={data.transactionTypeSelectData}
        categoryFilterOptions={data.categoryFilterOptions}
        categoryFilter={data.categoryFilter}
        onCategoryFilterChange={data.setCategoryFilter}
        paymentMethodFilterOptions={data.paymentMethodFilterOptions}
        paymentMethodFilter={data.paymentMethodFilter}
        onPaymentMethodFilterChange={data.setPaymentMethodFilter}
        searchFilter={data.searchFilter}
        onSearchFilterChange={data.setSearchFilter}
        summaryText={t("transactions.summaryMovements", undefined, {
          monthYear: `${monthLabelFromOptions(data.selectedMonth, data.monthOptions, t("common.messages.month"))} ${data.selectedYear}`,
          count: data.filteredRowsCount,
          pluralSuffix: data.filteredRowsCount === 1 ? "" : "s",
          filtersText:
            data.activeFiltersCount > 0
              ? t("transactions.activeFiltersText", undefined, {
                  count: data.activeFiltersCount,
                  pluralSuffix: data.activeFiltersCount === 1 ? "" : "s",
                  activePluralSuffix: data.activeFiltersCount === 1 ? "" : "s",
                })
              : "",
        })}
      />

      {!data.hasAnyActiveCategory ? (
        <Alert color="yellow" variant="light">
          {t("transactions.needActiveCategory")}
        </Alert>
      ) : null}

      <TransactionInsight title={insight.title} detail={insight.detail} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.7fr) minmax(320px, 0.95fr)",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        <TransactionsList
          groupedRows={data.groupedRows}
          selectedTransactionId={selectedRow?.id ?? null}
          isMobile={Boolean(isMobile)}
          categoryById={data.categoryById}
          subcategoryById={data.subcategoryById}
          paymentMethodById={data.paymentMethodById}
          visibleAmountFormatter={data.visibleAmountFormatter}
          formatCompactDate={data.formatCompactDate}
          deletingId={mutations.deletingId}
          onSelectTransaction={handleSelectTransaction}
          onOpenEditModal={mutations.openEditModal}
          onConfirmDelete={mutations.confirmDelete}
        />

        {!isMobile ? (
          <TransactionDetailPanel
            row={selectedRow}
            categoryById={data.categoryById}
            subcategoryById={data.subcategoryById}
            paymentMethodById={data.paymentMethodById}
            visibleAmountFormatter={data.visibleAmountFormatter}
            formatDate={data.formatDate}
            deletingId={mutations.deletingId}
            onEdit={mutations.openEditModal}
            onDelete={mutations.confirmDelete}
          />
        ) : null}
      </div>

      <TransactionsMobileActionsBar
        isMobile={isMobile}
        canCreateTransaction={data.canCreateTransaction}
        canCreateTransfer={data.canCreateTransfer}
        onCreateTransaction={() => mutations.openCreateModal()}
        onCreateTransfer={() => mutations.setIsTransferModalOpen(true)}
      />

      {mutations.isModalOpen ? (
        <TransactionFormModal
          opened={mutations.isModalOpen}
          onClose={mutations.closeModal}
          editingRow={mutations.editingRow}
          categories={data.categories}
          subcategories={data.subcategories}
          paymentMethods={data.paymentMethods}
          paymentMethodOptions={mutations.paymentMethodOptions}
          transactionTypeSelectData={data.transactionTypeSelectData}
          isMobile={isMobile}
          quickPaymentMethodType={mutations.quickPaymentMethodType}
          setQuickPaymentMethodType={mutations.setQuickPaymentMethodType}
          quickPaymentMethodSelectData={data.quickPaymentMethodSelectData}
          shouldShowQuickPaymentSetup={mutations.shouldShowQuickPaymentSetup}
          initialValues={mutations.formInitialValues}
          onSubmit={mutations.onSubmit}
        />
      ) : null}

      {mutations.isTransferModalOpen ? (
        <TransferModal
          opened={mutations.isTransferModalOpen}
          onClose={() => mutations.setIsTransferModalOpen(false)}
          paymentMethods={data.paymentMethods}
          onSuccess={data.loadTransactions}
        />
      ) : null}

      {isMobile ? (
        <TransactionDetailModal
          opened={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          row={selectedRow}
          categoryById={data.categoryById}
          subcategoryById={data.subcategoryById}
          paymentMethodById={data.paymentMethodById}
          visibleAmountFormatter={data.visibleAmountFormatter}
          formatDate={data.formatDate}
          deletingId={mutations.deletingId}
          onEdit={(row) => {
            setIsDetailModalOpen(false);
            void mutations.openEditModal(row);
          }}
          onDelete={(row) => {
            setIsDetailModalOpen(false);
            mutations.confirmDelete(row);
          }}
        />
      ) : null}
    </Stack>
  );
}
