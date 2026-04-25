import { Group, Paper, Text } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";
import { transactionTypeColorShade } from "@/features/transactions/type-colors";

type BudgetGlobalSummaryProps = {
  totals: {
    income: number;
    expense: number;
    saving: number;
    balance: number;
  };
  currencyFormatter: Intl.NumberFormat;
  compact?: boolean;
};

type SummaryMetric = {
  label: string;
  value: string;
  color: string;
};

export function BudgetGlobalSummary({
  totals,
  currencyFormatter,
  compact = false,
}: BudgetGlobalSummaryProps) {
  const { t } = useI18n();
  const balanceColor = totals.balance >= 0 ? "cyan.7" : "red.7";

  const metrics: SummaryMetric[] = [
    {
      label: t("budget.global.income", "Ingresos"),
      value: currencyFormatter.format(totals.income),
      color: transactionTypeColorShade("income", 7),
    },
    {
      label: t("budget.global.expense", "Gastos"),
      value: currencyFormatter.format(totals.expense),
      color: transactionTypeColorShade("expense", 7),
    },
    {
      label: t("budget.global.balance", "Balance"),
      value: currencyFormatter.format(totals.balance),
      color: balanceColor,
    },
  ];

  return (
    <Paper
      withBorder
      radius="md"
      p={compact ? "xs" : "sm"}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        backgroundColor: "color-mix(in srgb, var(--mantine-color-body) 92%, white 8%)",
        backdropFilter: "blur(10px)",
        borderColor: "var(--mantine-color-gray-3)",
      }}
    >
      <Group
        justify="space-between"
        align="stretch"
        wrap="nowrap"
        gap={compact ? 8 : 12}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              flex: 1,
              minWidth: 0,
              padding: compact ? "0.1rem 0" : "0.2rem 0.35rem",
              borderRight:
                metric.label === metrics.at(-1)?.label ? "none" : "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <Text size="10px" fw={800} c="dimmed" tt="uppercase" ta="center" style={{ letterSpacing: "0.08em" }}>
              {metric.label}
            </Text>
            <Text
              size={compact ? "sm" : "md"}
              fw={800}
              c={metric.color}
              ta="center"
              mt={2}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {metric.value}
            </Text>
          </div>
        ))}
      </Group>
    </Paper>
  );
}
