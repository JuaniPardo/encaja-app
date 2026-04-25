import { Alert, Badge, Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";
import { transactionTypeColorShade } from "@/features/transactions/type-colors";

type BudgetSummaryPanelProps = {
  totals: {
    income: number;
    expense: number;
    saving: number;
    assigned: number;
    balance: number;
  };
  topSpentCategory?: {
    name: string;
    spent: number;
    percent: number;
  } | null;
  statusLabel: string;
  statusTone: "cyan" | "yellow" | "pink";
  currencyFormatter: Intl.NumberFormat;
};

export function BudgetSummaryPanel({
  totals,
  topSpentCategory,
  statusLabel,
  statusTone,
  currencyFormatter,
}: BudgetSummaryPanelProps) {
  const { t } = useI18n();
  const allocationPercent =
    totals.income > 0 ? Math.round((totals.assigned / totals.income) * 100) : 0;
  const summaryRows = [
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
      label: t("budget.global.saving", "Ahorro"),
      value: currencyFormatter.format(totals.saving),
      color: transactionTypeColorShade("saving", 7),
    },
  ];

  return (
    <Paper withBorder radius="md" p="md" style={{ position: "sticky", top: "5.1rem" }}>
      <Stack gap="md">
        <Stack gap={4}>
          <Group justify="space-between" align="flex-start">
            <Title order={4}>{t("budget.summary.title", "Resumen")}</Title>
            <Badge color={statusTone} variant="light">
              {statusLabel}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("budget.summary.subtitle", "Leé el estado global antes de seguir asignando montos.")}
          </Text>
        </Stack>

        <Paper withBorder radius="md" p="sm" bg={`${statusTone}.0`}>
          <Stack gap={4}>
            <Text size="xs" fw={800} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
              {t("budget.global.balance", "Balance")}
            </Text>
            <Text size="xl" fw={900} c={totals.balance >= 0 ? "cyan.7" : "red.7"} style={{ fontVariantNumeric: "tabular-nums" }}>
              {currencyFormatter.format(totals.balance)}
            </Text>
          </Stack>
        </Paper>

        <Stack gap="xs">
          {summaryRows.map((row) => (
            <Group key={row.label} justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                {row.label}
              </Text>
              <Text size="sm" fw={700} c={row.color} style={{ fontVariantNumeric: "tabular-nums" }}>
                {row.value}
              </Text>
            </Group>
          ))}
          <Group justify="space-between" align="center">
            <Text size="sm" fw={700}>
              {t("budget.assignedTotal")}
            </Text>
            <Text size="sm" fw={800} style={{ fontVariantNumeric: "tabular-nums" }}>
              {currencyFormatter.format(totals.assigned)}
            </Text>
          </Group>
        </Stack>

        <Stack gap={4}>
          <Group justify="space-between" align="center">
            <Text size="xs" fw={800} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
              {t("budget.summary.allocation", "Nivel de asignación")}
            </Text>
            <Text size="xs" fw={700}>
              {allocationPercent}%
            </Text>
          </Group>
          <Progress value={Math.min(allocationPercent, 100)} color={statusTone} radius="xl" />
        </Stack>

        {topSpentCategory ? (
          <Paper withBorder radius="md" p="sm">
            <Stack gap={6}>
              <Text size="xs" fw={800} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.08em" }}>
                {t("budget.summary.topSpent", "Top categoría de gasto")}
              </Text>
              <Group justify="space-between" align="center" wrap="nowrap" gap="md">
                <Text size="sm" fw={700} lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                  {topSpentCategory.name}
                </Text>
                <Text size="sm" fw={800} c={transactionTypeColorShade("expense", 7)} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {currencyFormatter.format(topSpentCategory.spent)}
                </Text>
              </Group>
              <Progress
                value={Math.min(topSpentCategory.percent, 100)}
                color={topSpentCategory.percent > 100 ? "red" : "pink"}
                radius="xl"
              />
              <Text size="xs" c="dimmed">
                {t("budget.summary.topSpentDetail", undefined, {
                  percent: topSpentCategory.percent,
                })}
              </Text>
            </Stack>
          </Paper>
        ) : null}

        <Alert color={statusTone === "pink" ? "red" : statusTone} variant={statusTone === "pink" ? "filled" : "light"}>
          <Text size="sm" fw={600}>
            {totals.balance === 0
              ? t("budget.summary.balancedMessage", "Tu presupuesto del período está balanceado.")
              : totals.balance > 0
                ? t("budget.summary.remainingMessage", undefined, {
                    amount: currencyFormatter.format(totals.balance),
                  })
                : t("budget.summary.overMessage", undefined, {
                    amount: currencyFormatter.format(Math.abs(totals.balance)),
                  })}
          </Text>
        </Alert>
      </Stack>
    </Paper>
  );
}
