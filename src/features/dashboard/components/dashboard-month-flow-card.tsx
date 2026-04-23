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

function buildMonotoneLinePath(points: Point[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  }

  const segmentCount = points.length - 1;
  const segmentSlopes = new Array<number>(segmentCount);
  for (let index = 0; index < segmentCount; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const dx = next.x - current.x;
    segmentSlopes[index] = dx === 0 ? 0 : (next.y - current.y) / dx;
  }

  const tangents = new Array<number>(points.length);
  tangents[0] = segmentSlopes[0];
  tangents[points.length - 1] = segmentSlopes[segmentSlopes.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    tangents[index] = (segmentSlopes[index - 1] + segmentSlopes[index]) / 2;
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const slope = segmentSlopes[index];
    if (Math.abs(slope) < 1e-9) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }

    const ratioA = tangents[index] / slope;
    const ratioB = tangents[index + 1] / slope;
    const hypot = Math.hypot(ratioA, ratioB);
    if (hypot > 3) {
      const scale = 3 / hypot;
      tangents[index] = scale * ratioA * slope;
      tangents[index + 1] = scale * ratioB * slope;
    }
  }

  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let index = 0; index < segmentCount; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const dx = next.x - current.x;

    const cp1x = current.x + dx / 3;
    const cp1y = current.y + (tangents[index] * dx) / 3;
    const cp2x = next.x - dx / 3;
    const cp2y = next.y - (tangents[index + 1] * dx) / 3;

    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)}`;
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

export function DashboardMonthFlowCard({
  isMobile,
  selectedYear,
  selectedMonth,
  transactionRows,
  compactCurrencyFormatter,
  t,
}: DashboardMonthFlowCardProps) {
  const areaChartDefaultStrokeWidth = 2;

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

    const chartLeft = 8;
    const chartRight = 100;
    const chartTop = 5;
    const chartBottom = 47;
    const chartHeight = chartBottom - chartTop;
    const chartWidth = chartRight - chartLeft;

    const incomePoints = cumulativeIncome.map((value, index) => ({
      x: chartLeft + (index / Math.max(daysInMonth - 1, 1)) * chartWidth,
      y: chartBottom - (value / maxValue) * chartHeight,
    }));

    const expensePoints = cumulativeExpense.map((value, index) => ({
      x: chartLeft + (index / Math.max(daysInMonth - 1, 1)) * chartWidth,
      y: chartBottom - (value / maxValue) * chartHeight,
    }));

    const incomeLinePath = buildMonotoneLinePath(incomePoints);
    const expenseLinePath = buildMonotoneLinePath(expensePoints);
    const yAxisTicks = [1, 0.66, 0.33, 0].map((ratio) => ({
      y: chartBottom - ratio * chartHeight,
      label: compactCurrencyFormatter.format(maxValue * ratio),
    }));
    const horizontalGridLines = [0.25, 0.5, 0.75].map(
      (ratio) => chartBottom - ratio * chartHeight,
    );

    return {
      incomeTotal: incomeRunning,
      expenseTotal: expenseRunning,
      balance: incomeRunning - expenseRunning,
      hasData: incomeRunning > 0 || expenseRunning > 0,
      chartLeft,
      chartRight,
      chartTop,
      chartBottom,
      incomePath: incomeLinePath,
      expensePath: expenseLinePath,
      incomeAreaPath: buildAreaPath(incomeLinePath, incomePoints, chartBottom),
      expenseAreaPath: buildAreaPath(expenseLinePath, expensePoints, chartBottom),
      yAxisTicks,
      horizontalGridLines,
    };
  }, [compactCurrencyFormatter, selectedMonth, selectedYear, transactionRows]);

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

                  {flow.horizontalGridLines.map((y) => (
                    <line
                      key={`h-${y}`}
                      x1={flow.chartLeft}
                      y1={y}
                      x2={flow.chartRight}
                      y2={y}
                      stroke="#dbe3ed"
                      strokeOpacity={0.68}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  <line
                    x1={flow.chartLeft}
                    y1={flow.chartTop}
                    x2={flow.chartLeft}
                    y2={flow.chartBottom}
                    stroke="#d2dbe8"
                    strokeOpacity={0.82}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />

                  {flow.yAxisTicks.map((tick) => (
                    <text
                      key={`y-tick-${tick.y}`}
                      x={flow.chartLeft - 0.9}
                      y={tick.y + 0.6}
                      textAnchor="end"
                      fontSize="2"
                      fill="#98a2b3"
                    >
                      {tick.label}
                    </text>
                  ))}

                  <path d={flow.incomeAreaPath} fill="url(#month-flow-income-gradient)" />
                  <path d={flow.expenseAreaPath} fill="url(#month-flow-expense-gradient)" />
                  <path
                    d={flow.incomePath}
                    fill="none"
                    stroke="#3f8f7f"
                    strokeWidth={areaChartDefaultStrokeWidth}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={flow.expensePath}
                    fill="none"
                    stroke="#4c6bd7"
                    strokeWidth={areaChartDefaultStrokeWidth}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
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
