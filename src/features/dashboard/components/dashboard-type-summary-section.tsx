import Link from "next/link";
import { Box, Group, Paper, Table, Text } from "@mantine/core";

import { formatSignedCurrency, getDeviationColor } from "@/features/dashboard/lib/dashboard-math";
import { typeTheme } from "@/features/dashboard/lib/dashboard-theme";
import { ProgressCell } from "@/features/dashboard/progress-cell";
import type {
  CategorySummaryRow,
  TranslationFn,
} from "@/features/dashboard/types/dashboard";
import type { TotalsByType } from "@/features/dashboard/types/dashboard";
import type { TransactionType } from "@/types/database";

type DashboardTypeSummarySectionProps = {
  type: TransactionType;
  rows: CategorySummaryRow[];
  totals: TotalsByType[TransactionType];
  typeLabel: string;
  isMobile: boolean;
  tableHorizontalSpacing: "xs" | "sm";
  tableVerticalSpacing: number;
  tableColumnWidths: {
    category: string;
    real: string;
    budget?: string;
    execution: string;
    deviation: string;
  };
  executionBarWidth: number | string;
  compactFormatter: Intl.NumberFormat;
  currencyFormatter: Intl.NumberFormat;
  percentageFormatter: Intl.NumberFormat;
  categoryDrilldownHref: (type: TransactionType, categoryId: string) => string;
  t: TranslationFn;
};

export function DashboardTypeSummarySection({
  type,
  rows,
  totals,
  typeLabel,
  isMobile,
  tableHorizontalSpacing,
  tableVerticalSpacing,
  tableColumnWidths,
  executionBarWidth,
  compactFormatter,
  currencyFormatter,
  percentageFormatter,
  categoryDrilldownHref,
  t,
}: DashboardTypeSummarySectionProps) {
  const totalExecutionPercent = Math.abs(totals.budget) < 0.005 ? null : (totals.real / totals.budget) * 100;

  return (
    <Paper
      radius="sm"
      style={{
        border: "1px solid var(--encaja-border-soft)",
        backgroundColor: "var(--encaja-surface)",
      }}
    >
      <Box
        px={isMobile ? "xs" : "sm"}
        py={6}
        style={{
          backgroundColor: "var(--encaja-surface-subtle)",
          borderBottom: "1px solid var(--encaja-border-faint)",
        }}
      >
        <Group justify="space-between" wrap={isMobile ? "wrap" : "nowrap"} gap={6}>
          <Text size="xs" fw={800} c={typeTheme[type].header}>
            {typeLabel}
          </Text>
          <Text size="xs" c="var(--encaja-text-muted)">
            {isMobile
              ? t("dashboard.realBudgetCompact", undefined, {
                  real: compactFormatter.format(totals.real),
                  budget: compactFormatter.format(totals.budget),
                })
              : t("dashboard.realBudgetFull", undefined, {
                  real: currencyFormatter.format(totals.real),
                  budget: currencyFormatter.format(totals.budget),
                })}
          </Text>
        </Group>
      </Box>

      <Table
        horizontalSpacing={tableHorizontalSpacing}
        verticalSpacing={tableVerticalSpacing}
        style={{ color: "var(--encaja-text-strong)", tableLayout: "fixed", width: "100%" }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ color: "var(--encaja-text-secondary)", width: tableColumnWidths.category }}>
              {t("dashboard.category")}
            </Table.Th>
            <Table.Th style={{ color: "var(--encaja-text-secondary)", textAlign: "right", width: tableColumnWidths.real }}>
              {t("dashboard.real")}
            </Table.Th>
            {!isMobile ? (
              <Table.Th style={{ color: "var(--encaja-text-secondary)", textAlign: "right", width: tableColumnWidths.budget }}>
                {t("dashboard.budgetAbbrevWithDot")}
              </Table.Th>
            ) : null}
            <Table.Th
              style={{
                color: "var(--encaja-text-secondary)",
                textAlign: isMobile ? "left" : "right",
                width: tableColumnWidths.execution,
              }}
            >
              {t("dashboard.executionAbbrev")}
            </Table.Th>
            <Table.Th
              style={{
                color: "var(--encaja-text-secondary)",
                textAlign: "right",
                width: tableColumnWidths.deviation,
              }}
            >
              {t("dashboard.deviation")}
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={isMobile ? 4 : 5}>
                <Text size="xs" c="var(--encaja-text-faint)">
                  {t("dashboard.noCategoriesForType")}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => {
              const deviationColor = getDeviationColor(type, row.deviation);

              return (
                <Table.Tr key={row.categoryId}>
                  <Table.Td>
                    <Group gap={6} wrap={isMobile ? "wrap" : "nowrap"}>
                      <Text
                        component={Link}
                        href={categoryDrilldownHref(type, row.categoryId)}
                        size="xs"
                        c="var(--encaja-text-strong)"
                        lineClamp={isMobile ? 2 : 1}
                        style={{ textDecoration: "none" }}
                      >
                        {row.categoryName}
                      </Text>
                      {!isMobile && !row.categoryIsActive ? (
                        <Text size="xs" c="var(--encaja-text-faint)">
                          {t("dashboard.inactive")}
                        </Text>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
                    <Text size="xs" c="var(--encaja-text-strong)">
                      {compactFormatter.format(row.realAmount)}
                    </Text>
                  </Table.Td>
                  {!isMobile ? (
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="xs" c="var(--encaja-text-secondary)">
                        {compactFormatter.format(row.budgetAmount)}
                      </Text>
                    </Table.Td>
                  ) : null}
                  <Table.Td style={{ textAlign: "right" }}>
                    <Box
                      style={{
                        width: executionBarWidth,
                        marginLeft: isMobile ? 0 : "auto",
                      }}
                    >
                      <ProgressCell
                        type={type}
                        value={row.executionPercent}
                        percentageFormatter={percentageFormatter}
                        compact={isMobile}
                      />
                    </Box>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Text size="xs" c={deviationColor} fw={700}>
                      {formatSignedCurrency(row.deviation, compactFormatter)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}

          <Table.Tr
            style={{
              backgroundColor: "var(--encaja-info-bg)",
              borderTop: "1px solid var(--encaja-border-soft)",
            }}
          >
            <Table.Td>
              <Text size="xs" fw={800} c="var(--encaja-text-primary)">
                {t("dashboard.totalUpper")}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
              <Text size="xs" fw={800} c="var(--encaja-text-primary)">
                {compactFormatter.format(totals.real)}
              </Text>
            </Table.Td>
            {!isMobile ? (
              <Table.Td style={{ textAlign: "right" }}>
                <Text size="xs" fw={800} c="var(--encaja-text-primary)">
                  {compactFormatter.format(totals.budget)}
                </Text>
              </Table.Td>
            ) : null}
            <Table.Td style={{ textAlign: "right" }}>
              <Box
                style={{
                  width: executionBarWidth,
                  marginLeft: isMobile ? 0 : "auto",
                }}
              >
                <ProgressCell
                  type={type}
                  value={totalExecutionPercent}
                  percentageFormatter={percentageFormatter}
                  compact={isMobile}
                />
              </Box>
            </Table.Td>
            <Table.Td style={{ textAlign: "right" }}>
              <Text size="xs" fw={800} c={getDeviationColor(type, totals.deviation)}>
                {formatSignedCurrency(totals.deviation, compactFormatter)}
              </Text>
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
