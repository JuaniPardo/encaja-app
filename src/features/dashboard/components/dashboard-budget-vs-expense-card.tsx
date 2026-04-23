import { Group, Paper, Stack, Text } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { CategorySummaryRow, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardBudgetVsExpenseCardProps = {
  isMobile: boolean;
  expenseBudget: number;
  expenseReal: number;
  expenseDeviation: number;
  expenseRows: CategorySummaryRow[];
  compactFormatter: Intl.NumberFormat;
  percentageFormatter: Intl.NumberFormat;
  t: TranslationFn;
};

export function DashboardBudgetVsExpenseCard({
  isMobile,
  expenseBudget,
  expenseReal,
  expenseDeviation,
  expenseRows,
  compactFormatter,
  percentageFormatter,
  t,
}: DashboardBudgetVsExpenseCardProps) {
  const executionPercent = Math.abs(expenseBudget) < 0.005 ? null : (expenseReal / expenseBudget) * 100;

  const overBudgetRows = [...expenseRows]
    .filter((row) => row.deviation > 0.005)
    .sort((left, right) => right.deviation - left.deviation)
    .slice(0, 2);

  const overBudgetSummary =
    overBudgetRows.length === 0
      ? t("dashboard.overBudgetCategoriesNoData")
      : overBudgetRows
          .map(
            (row) =>
              `${row.categoryName} ${formatSignedCurrency(row.deviation, compactFormatter)}`,
          )
          .join(" · ");

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "8px" : "10px"}
      style={{
        borderColor: "#e5e9f0",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={7}>
        <Group justify="space-between" align="center" gap={8}>
          <Text size="xs" fw={800} c="#344054">
            {t("dashboard.budgetVsExpenseTitle")}
          </Text>
          <Text size="11px" fw={700} c="#667085">
            {t("dashboard.collapsed")}
          </Text>
        </Group>

        <Text size="xs" c="#475467">
          {t("dashboard.budgetSummaryLine", undefined, {
            real: compactFormatter.format(expenseReal),
            budget: compactFormatter.format(expenseBudget),
            execution: executionPercent === null ? "N/A" : `${percentageFormatter.format(executionPercent)}%`,
            deviation: formatSignedCurrency(expenseDeviation, compactFormatter),
          })}
        </Text>

        <Text size="11px" c="#667085" lineClamp={2}>
          {t("dashboard.overBudgetSummaryLine", undefined, {
            categories: overBudgetSummary,
          })}
        </Text>
      </Stack>
    </Paper>
  );
}
