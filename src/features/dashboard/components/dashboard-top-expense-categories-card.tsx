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
        borderColor: "#d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Text size="xs" fw={800} c="#344054">
          {t("dashboard.topExpenseCategoriesTitle")}
        </Text>

        {topRows.length === 0 ? (
          <Text size="xs" c="#98a2b3">
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
                    border: "1px solid #e6eaf0",
                    backgroundColor: "#fbfcff",
                    padding: isMobile ? "8px" : "9px 10px",
                  }}
                >
                  <Stack gap={5}>
                    <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                      <Text size="xs" fw={700} c="#1f2937" lineClamp={1}>
                        {row.categoryName}
                      </Text>
                      <Text size="xs" fw={700} c="#344054" style={{ whiteSpace: "nowrap" }}>
                        {compactCurrencyFormatter.format(row.realAmount)}
                      </Text>
                    </Group>

                    <Box
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: "#edf2f7",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        style={{
                          width: `${widthPercent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg, #d6336c 0%, #f06595 100%)",
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
