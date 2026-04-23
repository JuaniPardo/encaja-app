import { useMemo } from "react";
import { Box, Group, Paper, Stack, Text } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { TransactionLiteRow, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardMonthFlowCardProps = {
  isMobile: boolean;
  selectedYear: number;
  selectedMonth: number;
  transactionRows: TransactionLiteRow[];
  compactCurrencyFormatter: Intl.NumberFormat;
  t: TranslationFn;
};

type Point = {
  x: number;
  y: number;
};

function resolveGovernedDate(row: TransactionLiteRow) {
  const sourceDate = row.effective_date ?? row.transaction_date;
  return new Date(`${sourceDate}T12:00:00`);
}

function buildLinePath(points: Point[]) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
}

export function DashboardMonthFlowCard({
  isMobile,
  selectedYear,
  selectedMonth,
  transactionRows,
  compactCurrencyFormatter,
  t,
}: DashboardMonthFlowCardProps) {
  const flow = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dailyIncome = new Array<number>(daysInMonth).fill(0);
    const dailyExpense = new Array<number>(daysInMonth).fill(0);

    for (const row of transactionRows) {
      const governedDate = resolveGovernedDate(row);
      if (governedDate.getFullYear() !== selectedYear || governedDate.getMonth() + 1 !== selectedMonth) {
        continue;
      }

      const dayIndex = governedDate.getDate() - 1;
      if (dayIndex < 0 || dayIndex >= daysInMonth) {
        continue;
      }

      const amount = Number(row.amount) || 0;
      if (row.type === "income") {
        dailyIncome[dayIndex] += amount;
        continue;
      }

      if (row.type === "expense") {
        dailyExpense[dayIndex] += amount;
      }
    }

    const cumulativeIncome: number[] = [];
    const cumulativeExpense: number[] = [];
    let incomeRunning = 0;
    let expenseRunning = 0;

    for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
      incomeRunning += dailyIncome[dayIndex] ?? 0;
      expenseRunning += dailyExpense[dayIndex] ?? 0;
      cumulativeIncome.push(incomeRunning);
      cumulativeExpense.push(expenseRunning);
    }

    const maxValue = Math.max(1, ...cumulativeIncome, ...cumulativeExpense);

    const incomePoints = cumulativeIncome.map((value, index) => ({
      x: (index / Math.max(daysInMonth - 1, 1)) * 100,
      y: 48 - (value / maxValue) * 44,
    }));

    const expensePoints = cumulativeExpense.map((value, index) => ({
      x: (index / Math.max(daysInMonth - 1, 1)) * 100,
      y: 48 - (value / maxValue) * 44,
    }));

    return {
      incomeTotal: incomeRunning,
      expenseTotal: expenseRunning,
      balance: incomeRunning - expenseRunning,
      hasData: incomeRunning > 0 || expenseRunning > 0,
      incomePath: buildLinePath(incomePoints),
      expensePath: buildLinePath(expensePoints),
    };
  }, [selectedMonth, selectedYear, transactionRows]);

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "#e5e9f0",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Text size="xs" fw={800} c="#344054">
          {t("dashboard.monthFlowTitle")}
        </Text>

        {flow.hasData ? (
          <Stack gap={8}>
            <Box
              style={{
                borderRadius: 9,
                border: "1px solid #ecf0f4",
                background: "linear-gradient(180deg, #fcfdff 0%, #ffffff 100%)",
                padding: isMobile ? 8 : 10,
              }}
            >
              <svg width="100%" viewBox="0 0 100 50" preserveAspectRatio="none" style={{ display: "block" }}>
                <path d={flow.incomePath} fill="none" stroke="#2f9e88" strokeWidth={1.8} strokeLinecap="round" />
                <path d={flow.expensePath} fill="none" stroke="#b56a87" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
            </Box>

            <Group grow>
              <Stack gap={2}>
                <Text size="xs" fw={700} c="#087f5b">
                  {t("dashboard.incomeLabel")}
                </Text>
                <Text size="sm" fw={800} c="#087f5b">
                  {compactCurrencyFormatter.format(flow.incomeTotal)}
                </Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" fw={700} c="#c2255c">
                  {t("dashboard.expenseLabel")}
                </Text>
                <Text size="sm" fw={800} c="#c2255c">
                  {compactCurrencyFormatter.format(flow.expenseTotal)}
                </Text>
              </Stack>
              <Stack gap={2}>
                <Text size="xs" fw={700} c="#475467">
                  {t("dashboard.balanceLabel")}
                </Text>
                <Text size="sm" fw={800} c={flow.balance >= 0 ? "#087f5b" : "#c92a2a"}>
                  {formatSignedCurrency(flow.balance, compactCurrencyFormatter)}
                </Text>
              </Stack>
            </Group>
          </Stack>
        ) : (
          <Text size="xs" c="#98a2b3">
            {t("dashboard.monthFlowNoData")}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
