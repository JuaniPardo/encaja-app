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
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          {t("dashboard.periodBalance")}
        </Text>
        <Text fw={800} c={balanceReal >= 0 ? "#0ca678" : "#e03131"}>
          {currencyFormatter.format(balanceReal)}
        </Text>
        <Text size="xs" c="#667085">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(balanceBudget)}
        </Text>
        <Text size="xs" c={balanceDelta >= 0 ? "#087f5b" : "#c92a2a"}>
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
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          {t("dashboard.periodSavings")}
        </Text>
        <Text fw={800} c="#2b8aaf">
          {currencyFormatter.format(savingReal)}
        </Text>
        <Text size="xs" c="#667085">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(savingBudget)}
        </Text>
        <Text size="xs" c="#667085">
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
