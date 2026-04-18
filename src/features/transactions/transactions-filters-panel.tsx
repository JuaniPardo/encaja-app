"use client";

import { Button, Collapse, Group, NativeSelect, Paper, Stack, Text, TextInput } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";

type SelectOption = {
  value: string;
  label: string;
};

type SelectOptionGroup = {
  group: string;
  items: SelectOption[];
};

type TransactionsFiltersPanelProps = {
  isMobile: boolean;
  mobileFiltersOpened: boolean;
  onToggleMobileFilters: () => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
  yearOptions: SelectOption[];
  selectedYear: number;
  onSelectedYearChange: (year: number) => void;
  monthOptions: SelectOption[];
  selectedMonth: number;
  onSelectedMonthChange: (month: number) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  transactionTypeSelectData: SelectOption[];
  categoryFilterOptions: Array<SelectOption | SelectOptionGroup>;
  categoryFilter: string;
  onCategoryFilterChange: (categoryId: string) => void;
  paymentMethodFilterOptions: SelectOption[];
  paymentMethodFilter: string;
  onPaymentMethodFilterChange: (paymentMethodId: string) => void;
  searchFilter: string;
  onSearchFilterChange: (search: string) => void;
  summaryText: string;
};

export function TransactionsFiltersPanel({
  isMobile,
  mobileFiltersOpened,
  onToggleMobileFilters,
  activeFiltersCount,
  onClearFilters,
  yearOptions,
  selectedYear,
  onSelectedYearChange,
  monthOptions,
  selectedMonth,
  onSelectedMonthChange,
  typeFilter,
  onTypeFilterChange,
  transactionTypeSelectData,
  categoryFilterOptions,
  categoryFilter,
  onCategoryFilterChange,
  paymentMethodFilterOptions,
  paymentMethodFilter,
  onPaymentMethodFilterChange,
  searchFilter,
  onSearchFilterChange,
  summaryText,
}: TransactionsFiltersPanelProps) {
  const { t } = useI18n();

  return (
    <Paper withBorder radius="md" p="sm">
      <Stack gap="xs">
        {isMobile ? (
          <Group justify="space-between" align="center" gap="xs">
            <Text fw={600} size="sm">
              {t("transactions.filters", "Filtros")}
            </Text>
            <Group gap="xs">
              {activeFiltersCount > 0 ? (
                <Button variant="subtle" color="gray" size="compact-xs" onClick={onClearFilters}>
                  {t("common.actions.clearFilters", "Limpiar")}
                </Button>
              ) : null}
              <Button variant="light" color="gray" size="compact-xs" onClick={onToggleMobileFilters}>
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
              onChange={(event) => onSelectedYearChange(Number(event.currentTarget.value))}
              style={{ minWidth: 104 }}
            />

            <NativeSelect
              label={t("transactions.month")}
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => onSelectedMonthChange(Number(event.currentTarget.value))}
              style={{ minWidth: 132 }}
            />

            <NativeSelect
              label={t("transactions.type")}
              data={[{ value: "all", label: t("transactions.all") }, ...transactionTypeSelectData]}
              value={typeFilter}
              onChange={(event) => onTypeFilterChange(event.currentTarget.value)}
              style={{ minWidth: 132 }}
            />

            <NativeSelect
              label={t("transactions.category")}
              data={categoryFilterOptions}
              value={categoryFilter}
              onChange={(event) => onCategoryFilterChange(event.currentTarget.value)}
              style={{ minWidth: 180 }}
            />

            <NativeSelect
              label={t("transactions.paymentMethodShort")}
              data={paymentMethodFilterOptions}
              value={paymentMethodFilter}
              onChange={(event) => onPaymentMethodFilterChange(event.currentTarget.value)}
              style={{ minWidth: 180 }}
            />

            <TextInput
              label={t("transactions.search")}
              placeholder={t("transactions.searchPlaceholder")}
              value={searchFilter}
              onChange={(event) => onSearchFilterChange(event.currentTarget.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
          </Group>
        </Collapse>

        {!isMobile && activeFiltersCount > 0 ? (
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" size="compact-xs" onClick={onClearFilters}>
              {t("common.actions.clearFilters", "Limpiar filtros")}
            </Button>
          </Group>
        ) : null}

        <Text size="xs" c="dimmed">
          {summaryText}
        </Text>
      </Stack>
    </Paper>
  );
}
