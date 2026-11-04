import Link from "next/link";
import { Box, Group, Paper, Stack, Text, UnstyledButton } from "@mantine/core";

import type { CategorySummaryRow, TranslationFn } from "@/features/dashboard/types/dashboard";

import type { TransactionType } from "@/types/database";

type DashboardTopExpenseCategoriesCardProps = {
  isMobile: boolean;
  rows: CategorySummaryRow[];
  compactCurrencyFormatter: Intl.NumberFormat;
  categoryDrilldownHref: (type: TransactionType, categoryId: string) => string;
  t: TranslationFn;
};

export function DashboardTopExpenseCategoriesCard({
  isMobile,
  rows,
  compactCurrencyFormatter,
  categoryDrilldownHref,
  t,
}: DashboardTopExpenseCategoriesCardProps) {
  const topRows = [...rows]
    .filter((row) => row.realAmount > 0)
    .sort((left, right) => right.realAmount - left.realAmount)
    .slice(0, 5);
  const maxAmount = topRows.length > 0 ? topRows[0].realAmount : 1;

  return (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        borderColor: "var(--encaja-border-soft)",
        backgroundColor: "var(--encaja-surface)",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Text size="xs" fw={800} c="var(--encaja-text-primary)">
          {t("dashboard.topExpenseCategoriesTitle")}
        </Text>

        {topRows.length === 0 ? (
          <Text size="xs" c="var(--encaja-text-faint)">
            {t("dashboard.topExpenseCategoriesNoData")}
          </Text>
        ) : (
          <Stack gap={8}>
            {topRows.map((row) => {
              const widthPercent = Math.max(8, (row.realAmount / maxAmount) * 100);

              return (
                <UnstyledButton
                  key={row.categoryId}
                  component={Link}
                  href={categoryDrilldownHref("expense", row.categoryId)}
                  style={{
                    display: "block",
                    borderRadius: 8,
                    border: "1px solid var(--encaja-border-faint)",
                    backgroundColor: "var(--encaja-surface-subtle)",
                    padding: isMobile ? "7px 8px" : "8px 10px",
                  }}
                >
                  <Stack gap={5}>
                    <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                      <Text size="xs" fw={700} c="var(--encaja-text-strong)" lineClamp={1}>
                        {row.categoryName}
                      </Text>
                      <Text size="xs" fw={700} c="var(--encaja-text-primary)" style={{ whiteSpace: "nowrap" }}>
                        {compactCurrencyFormatter.format(row.realAmount)}
                      </Text>
                    </Group>

                    <Box
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: "var(--encaja-surface-track)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        style={{
                          width: `${widthPercent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg, var(--mantine-color-pink-7) 0%, #f06595 100%)",
                        }}
                      />
                    </Box>
                  </Stack>
                </UnstyledButton>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
