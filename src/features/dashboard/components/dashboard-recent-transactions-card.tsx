import { useMemo } from "react";
import Link from "next/link";
import { Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import { formatSignedCurrency } from "@/features/dashboard/lib/dashboard-math";
import type { CategoryRow, TransactionLiteRow, TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardRecentTransactionsCardProps = {
  isMobile: boolean;
  locale: "es" | "en";
  categories: CategoryRow[];
  transactionRows: TransactionLiteRow[];
  compactCurrencyFormatter: Intl.NumberFormat;
  categoryDrilldownHref: (type: "income" | "expense" | "saving" | "transfer", categoryId: string) => string;
  typeLabels: Record<"income" | "expense" | "saving" | "transfer", string>;
  t: TranslationFn;
};

function resolveGovernedDate(row: TransactionLiteRow) {
  const sourceDate = row.effective_date ?? row.transaction_date;
  return new Date(`${sourceDate}T12:00:00`);
}

function resolveSignedAmount(row: TransactionLiteRow) {
  const amount = Number(row.amount) || 0;

  if (row.type === "income") {
    return amount;
  }

  if (row.type === "expense" || row.type === "saving") {
    return -amount;
  }

  return row.direction === "in" ? amount : -amount;
}

export function DashboardRecentTransactionsCard({
  isMobile,
  locale,
  categories,
  transactionRows,
  compactCurrencyFormatter,
  categoryDrilldownHref,
  typeLabels,
  t,
}: DashboardRecentTransactionsCardProps) {
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
        day: "2-digit",
        month: "short",
      }),
    [locale],
  );

  const recentRows = useMemo(() => {
    return [...transactionRows]
      .filter((row) => row.type !== "transfer")
      .sort((left, right) => resolveGovernedDate(right).getTime() - resolveGovernedDate(left).getTime())
      .slice(0, 5);
  }, [transactionRows]);

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
          {t("dashboard.recentTransactionsTitle")}
        </Text>

        {recentRows.length === 0 ? (
          <Text size="xs" c="#98a2b3">
            {t("dashboard.recentTransactionsNoData")}
          </Text>
        ) : (
          <Stack gap={7}>
            {recentRows.map((row, index) => {
              const signedAmount = resolveSignedAmount(row);
              const governedDate = resolveGovernedDate(row);
              const typeLabel = typeLabels[row.type];
              const categoryName = categoryNameById.get(row.category_id) ?? t("dashboard.category");
              const amountColor = signedAmount >= 0 ? "#087f5b" : row.type === "saving" ? "#1c7ed6" : "#c92a2a";

              return (
                <UnstyledButton
                  key={`${row.category_id}-${row.transaction_date}-${index}`}
                  component={Link}
                  href={categoryDrilldownHref(row.type, row.category_id)}
                  style={{
                    display: "block",
                    borderRadius: 8,
                    border: "1px solid #e6eaf0",
                    backgroundColor: "#fbfcff",
                    padding: isMobile ? "7px 8px" : "8px 10px",
                  }}
                >
                  <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={700} c="#1f2937" lineClamp={1}>
                        {categoryName}
                      </Text>
                      <Text size="11px" c="#667085" lineClamp={1}>
                        {typeLabel} · {dateFormatter.format(governedDate)}
                      </Text>
                    </Stack>
                    <Text size="xs" fw={800} c={amountColor} style={{ whiteSpace: "nowrap" }}>
                      {formatSignedCurrency(signedAmount, compactCurrencyFormatter)}
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
