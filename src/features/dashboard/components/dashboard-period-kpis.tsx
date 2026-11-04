import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardPeriodKpisProps = {
  isDesktop: boolean;
  isMobile: boolean;
  kpiColumns: number;
  balanceBudget: number;
  balanceReal: number;
  balanceDelta: number;
  savingReal: number;
  savingBudget: number;
  savingsVsIncome: number | null;
  currencyFormatter: Intl.NumberFormat;
  percentageFormatter: Intl.NumberFormat;
  t: TranslationFn;
  stackLayout?: boolean;
};

function BalancePeriodCard({
  isDesktop,
  balanceBudget,
  balanceReal,
  balanceDelta,
  currencyFormatter,
  t,
}: {
  isDesktop: boolean;
  balanceBudget: number;
  balanceReal: number;
  balanceDelta: number;
  currencyFormatter: Intl.NumberFormat;
  t: TranslationFn;
}) {
  return (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="var(--encaja-surface)">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="var(--encaja-text-secondary)">
          {t("dashboard.periodBalance")}
        </Text>
        <Text fw={800} c={balanceReal >= 0 ? "var(--mantine-color-teal-7)" : "var(--mantine-color-red-8)"}>
          {currencyFormatter.format(balanceReal)}
        </Text>
        <Text size="xs" c="var(--encaja-text-muted)">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(balanceBudget)}
        </Text>
        <Text size="xs" c={balanceDelta >= 0 ? "var(--encaja-positive-text)" : "var(--encaja-negative-text)"}>
          {t("dashboard.delta")}: {formatSignedCurrency(balanceDelta, currencyFormatter)}
        </Text>
      </Stack>
    </Paper>
  );
}

function SavingsPeriodCard({
  isDesktop,
  savingReal,
  savingBudget,
  savingsVsIncome,
  currencyFormatter,
  percentageFormatter,
  t,
}: {
  isDesktop: boolean;
  savingReal: number;
  savingBudget: number;
  savingsVsIncome: number | null;
  currencyFormatter: Intl.NumberFormat;
  percentageFormatter: Intl.NumberFormat;
  t: TranslationFn;
}) {
  return (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="var(--encaja-surface)">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="var(--encaja-text-secondary)">
          {t("dashboard.periodSavings")}
        </Text>
        <Text fw={800} c="var(--encaja-kpi-accent)">
          {currencyFormatter.format(savingReal)}
        </Text>
        <Text size="xs" c="var(--encaja-text-muted)">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(savingBudget)}
        </Text>
        <Text size="xs" c="var(--encaja-text-muted)">
          {t("dashboard.ratio")}: {" "}
          {savingsVsIncome === null
            ? t("dashboard.notApplicable")
            : t("dashboard.incomeRatio", undefined, { value: percentageFormatter.format(savingsVsIncome) })}
        </Text>
      </Stack>
    </Paper>
  );
}

export function DashboardPeriodKpis({
  isDesktop,
  isMobile,
  kpiColumns,
  balanceBudget,
  balanceReal,
  balanceDelta,
  savingReal,
  savingBudget,
  savingsVsIncome,
  currencyFormatter,
  percentageFormatter,
  t,
  stackLayout = false,
}: DashboardPeriodKpisProps) {
  const cards = (
    <>
      <BalancePeriodCard
        isDesktop={isDesktop}
        balanceBudget={balanceBudget}
        balanceReal={balanceReal}
        balanceDelta={balanceDelta}
        currencyFormatter={currencyFormatter}
        t={t}
      />
      <SavingsPeriodCard
        isDesktop={isDesktop}
        savingReal={savingReal}
        savingBudget={savingBudget}
        savingsVsIncome={savingsVsIncome}
        currencyFormatter={currencyFormatter}
        percentageFormatter={percentageFormatter}
        t={t}
      />
    </>
  );

  if (stackLayout) {
    return <Stack gap="sm" h="100%">{cards}</Stack>;
  }

  return <SimpleGrid cols={kpiColumns} spacing={isMobile ? "xs" : "sm"}>{cards}</SimpleGrid>;
}
