"use client";

import { Alert, Group, LoadingOverlay, Stack, Text, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

import { monthLabelFromOptions } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { TransactionFormModal } from "@/features/transactions/transaction-form-modal";
import {
  TransactionsHeaderActions,
  TransactionsMobileActionsBar,
} from "@/features/transactions/transaction-actions";
import { useTransactionsData } from "@/features/transactions/hooks/use-transactions-data";
import { useTransactionsMutations } from "@/features/transactions/hooks/use-transactions-mutations";
import { TransactionsFiltersPanel } from "@/features/transactions/transactions-filters-panel";
import { TransactionsList } from "@/features/transactions/transactions-list";
import { TransferModal } from "@/features/transactions/transfer-modal";
import type { TypeFilter } from "@/features/transactions/utils";

export default function TransactionsPage() {
  const { t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 47.99em)");

  const data = useTransactionsData();
  const mutations = useTransactionsMutations({
    categoryById: data.categoryById,
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
  });

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

      <TransactionsList
        groupedRows={data.groupedRows}
        isMobile={isMobile}
        categoryById={data.categoryById}
        paymentMethodById={data.paymentMethodById}
        visibleAmountFormatter={data.visibleAmountFormatter}
        formatCompactDate={data.formatCompactDate}
        deletingId={mutations.deletingId}
        onOpenEditModal={mutations.openEditModal}
        onConfirmDelete={mutations.confirmDelete}
      />

      <TransactionsMobileActionsBar
        isMobile={isMobile}
        canCreateTransaction={data.canCreateTransaction}
        canCreateTransfer={data.canCreateTransfer}
        onCreateTransaction={() => mutations.openCreateModal()}
        onCreateTransfer={() => mutations.setIsTransferModalOpen(true)}
      />

      <TransactionFormModal
        opened={mutations.isModalOpen}
        onClose={mutations.closeModal}
        editingRow={mutations.editingRow}
        categories={data.categories}
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

      <TransferModal
        opened={mutations.isTransferModalOpen}
        onClose={() => mutations.setIsTransferModalOpen(false)}
        categories={data.categories}
        paymentMethods={data.paymentMethods}
        onSuccess={data.loadTransactions}
      />
    </Stack>
  );
}
