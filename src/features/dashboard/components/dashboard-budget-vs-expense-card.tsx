import { Box, Group, Paper, Stack, Text } from "@mantine/core";

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
  const progressPercent = executionPercent === null ? 0 : Math.max(0, Math.min(executionPercent, 160));

  const overBudgetRows = [...expenseRows]
    .filter((row) => row.deviation > 0.005)
    .sort((left, right) => right.deviation - left.deviation)
    .slice(0, 3);

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "#d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Text size="xs" fw={800} c="#344054">
          {t("dashboard.budgetVsExpenseTitle")}
        </Text>

        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Text size="xs" c="#667085">
            {t("dashboard.realBudgetFull", undefined, {
              real: compactFormatter.format(expenseReal),
              budget: compactFormatter.format(expenseBudget),
            })}
          </Text>
          <Text size="xs" fw={700} c={expenseDeviation <= 0 ? "#087f5b" : "#c92a2a"}>
            {formatSignedCurrency(expenseDeviation, compactFormatter)}
          </Text>
        </Group>

        <Box
          style={{
            width: "100%",
            height: 10,
            borderRadius: 999,
            backgroundColor: "#edf2f7",
            overflow: "hidden",
          }}
        >
          <Box
            style={{
              width: `${Math.max(6, (progressPercent / 160) * 100)}%`,
              height: "100%",
              borderRadius: 999,
              background:
                executionPercent !== null && executionPercent > 100
                  ? "linear-gradient(90deg, #f03e3e 0%, #e03131 100%)"
                  : "linear-gradient(90deg, #099268 0%, #0ca678 100%)",
            }}
          />
        </Box>

        <Text size="xs" fw={700} c="#475467">
          {t("dashboard.budgetExecutionLabel")}: {executionPercent === null ? "N/A" : `${percentageFormatter.format(executionPercent)}%`}
        </Text>

        <Stack gap={6}>
          <Text size="xs" fw={700} c="#475467">
            {t("dashboard.overBudgetCategoriesTitle")}
          </Text>
          {overBudgetRows.length === 0 ? (
            <Text size="xs" c="#98a2b3">
              {t("dashboard.overBudgetCategoriesNoData")}
            </Text>
          ) : (
            overBudgetRows.map((row) => (
              <Group key={row.categoryId} justify="space-between" align="center" wrap="nowrap" gap={8}>
                <Text size="xs" c="#344054" lineClamp={1}>
                  {row.categoryName}
                </Text>
                <Text size="xs" fw={700} c="#c92a2a" style={{ whiteSpace: "nowrap" }}>
                  {formatSignedCurrency(row.deviation, compactFormatter)}
                </Text>
              </Group>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
