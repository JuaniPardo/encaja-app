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

function buildSmoothLinePath(points: Point[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  }

  const smoothing = 0.18;
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const prevPrev = points[index - 2] ?? prev;
    const next = points[index + 1] ?? current;

    const cp1x = prev.x + (current.x - prevPrev.x) * smoothing;
    const cp1y = prev.y + (current.y - prevPrev.y) * smoothing;
    const cp2x = current.x - (next.x - prev.x) * smoothing;
    const cp2y = current.y - (next.y - prev.y) * smoothing;

    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${current.x.toFixed(2)},${current.y.toFixed(2)}`;
  }

  return path;
}

function buildAreaPath(linePath: string, points: Point[], baseline: number) {
  if (!linePath || points.length === 0) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L${last.x.toFixed(2)},${baseline.toFixed(2)} L${first.x.toFixed(2)},${baseline.toFixed(2)} Z`;
}

function buildTickLabel(daysInMonth: number, dayIndex: number) {
  const safeDay = Math.min(Math.max(dayIndex + 1, 1), daysInMonth);
  return `${safeDay}`;
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

    const chartTop = 5;
    const chartBottom = 47;
    const chartHeight = chartBottom - chartTop;

    const incomePoints = cumulativeIncome.map((value, index) => ({
      x: (index / Math.max(daysInMonth - 1, 1)) * 100,
      y: chartBottom - (value / maxValue) * chartHeight,
    }));

    const expensePoints = cumulativeExpense.map((value, index) => ({
      x: (index / Math.max(daysInMonth - 1, 1)) * 100,
      y: chartBottom - (value / maxValue) * chartHeight,
    }));

    const incomeLinePath = buildSmoothLinePath(incomePoints);
    const expenseLinePath = buildSmoothLinePath(expensePoints);
    const axisLabels = [0, Math.round(daysInMonth * 0.33) - 1, Math.round(daysInMonth * 0.66) - 1, daysInMonth - 1]
      .map((dayIndex) => Math.max(0, Math.min(dayIndex, daysInMonth - 1)))
      .filter((dayIndex, index, all) => all.indexOf(dayIndex) === index)
      .map((dayIndex) => ({
        label: buildTickLabel(daysInMonth, dayIndex),
        xPercent: (dayIndex / Math.max(daysInMonth - 1, 1)) * 100,
      }));

    return {
      incomeTotal: incomeRunning,
      expenseTotal: expenseRunning,
      balance: incomeRunning - expenseRunning,
      hasData: incomeRunning > 0 || expenseRunning > 0,
      incomePath: incomeLinePath,
      expensePath: expenseLinePath,
      incomeAreaPath: buildAreaPath(incomeLinePath, incomePoints, chartBottom),
      expenseAreaPath: buildAreaPath(expenseLinePath, expensePoints, chartBottom),
      axisLabels,
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
                background: "linear-gradient(180deg, #fbfcfe 0%, #ffffff 100%)",
                padding: isMobile ? 8 : 10,
              }}
            >
              <Stack gap={6}>
                <svg width="100%" viewBox="0 0 100 50" preserveAspectRatio="none" style={{ display: "block" }}>
                  <defs>
                    <linearGradient id="month-flow-income-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3f8f7f" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="#3f8f7f" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="month-flow-expense-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4c6bd7" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#4c6bd7" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>

                  {[14, 26, 38].map((y) => (
                    <line
                      key={`h-${y}`}
                      x1={0}
                      y1={y}
                      x2={100}
                      y2={y}
                      stroke="#d6dee8"
                      strokeWidth={0.55}
                      strokeDasharray="3 3"
                    />
                  ))}
                  {[0, 33.3, 66.6, 100].map((x) => (
                    <line
                      key={`v-${x}`}
                      x1={x}
                      y1={4}
                      x2={x}
                      y2={47}
                      stroke="#dbe2ec"
                      strokeWidth={0.5}
                      strokeDasharray="3 3"
                    />
                  ))}

                  <path d={flow.incomeAreaPath} fill="url(#month-flow-income-gradient)" />
                  <path d={flow.expenseAreaPath} fill="url(#month-flow-expense-gradient)" />
                  <path d={flow.incomePath} fill="none" stroke="#3f8f7f" strokeWidth={1.65} strokeLinecap="round" />
                  <path d={flow.expensePath} fill="none" stroke="#4c6bd7" strokeWidth={1.65} strokeLinecap="round" />
                </svg>

                <Box
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${flow.axisLabels.length}, minmax(0, 1fr))`,
                    gap: 4,
                  }}
                >
                  {flow.axisLabels.map((item) => (
                    <Text
                      key={`axis-${item.xPercent}`}
                      size="10px"
                      c="#98a2b3"
                      ta="center"
                    >
                      {item.label}
                    </Text>
                  ))}
                </Box>
              </Stack>
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
