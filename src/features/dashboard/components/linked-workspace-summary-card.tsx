import { Badge, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";

import type { Database } from "@/types/database";

type LinkedWorkspaceSummaryRow =
  Database["public"]["Functions"]["list_linked_workspace_summaries"]["Returns"][number];

type NormalizedLinkedWorkspaceSummaryRow = LinkedWorkspaceSummaryRow & {
  incomeTotal: number;
  expenseTotal: number;
  savingTotal: number;
  balanceTotal: number;
};

type LinkedWorkspaceSummaryGroup = {
  currencyCode: string;
  rows: NormalizedLinkedWorkspaceSummaryRow[];
};

type LinkedWorkspaceSummaryCardProps = {
  isMobile: boolean;
  currencyFormatter: Intl.NumberFormat;
  normalizedLinkedWorkspaceSummaries: NormalizedLinkedWorkspaceSummaryRow[];
  linkedWorkspaceSummariesByCurrency: LinkedWorkspaceSummaryGroup[];
  linkedWorkspaceCurrencyFormatters: Map<string, Intl.NumberFormat>;
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string;
};

export function LinkedWorkspaceSummaryCard({
                                             isMobile,
                                             currencyFormatter,
                                             normalizedLinkedWorkspaceSummaries,
                                             linkedWorkspaceSummariesByCurrency,
                                             linkedWorkspaceCurrencyFormatters,
                                             t,
                                           }: LinkedWorkspaceSummaryCardProps) {
  return (
    <Paper
      p={isMobile ? "xs" : "sm"}
      radius="sm"
      style={{
        border: "1px dashed #9ec5fe",
        backgroundColor: "#f5f9ff",
      }}
    >
      <Stack gap={isMobile ? 6 : "xs"}>
        <Group justify="space-between" align="center" wrap="wrap" gap={6}>
          <Stack gap={1}>
            <Text size="xs" fw={800} c="#1d4ed8">
              {t("dashboard.linkedWorkspacesExternalSummary")}
            </Text>
            <Text size="xs" c="#475467">
              {t("dashboard.linkedWorkspacesExternalSummaryDescription")}
            </Text>
          </Stack>
          <Badge variant="light" color="blue">
            {t("dashboard.linkedCount", undefined, {
              count: normalizedLinkedWorkspaceSummaries.length,
            })}
          </Badge>
        </Group>

        <Text size="xs" c="#475467">
          {t("dashboard.linkedWorkspacesNoConversion")}
        </Text>

        <Stack gap={6}>
          {linkedWorkspaceSummariesByCurrency.map((group) => {
            const groupCurrencyFormatter =
              linkedWorkspaceCurrencyFormatters.get(group.currencyCode) ?? currencyFormatter;

            return (
              <Stack key={group.currencyCode} gap={6}>
                <Text size="xs" fw={700} c="#475467">
                  — {group.currencyCode} —
                </Text>

                {group.rows.map((row) => (
                  <Paper
                    key={row.link_id}
                    withBorder
                    radius="sm"
                    p={isMobile ? "xs" : "sm"}
                    bg="#ffffff"
                  >
                    <Stack gap={4}>
                      <Group justify="space-between" align="center" wrap="wrap" gap={6}>
                        <Text size="sm" fw={700} c="#1f2937">
                          {row.target_workspace_name}
                        </Text>
                        <Badge variant="light" color="gray">
                          {row.target_currency_code} · {row.visibility_mode}
                        </Badge>
                      </Group>
                      <SimpleGrid cols={isMobile ? 2 : 4} spacing={isMobile ? 6 : "xs"}>
                        <Text size="xs" c="#344054">
                          {t("dashboard.incomeLabel")}: {groupCurrencyFormatter.format(row.incomeTotal)}
                        </Text>
                        <Text size="xs" c="#344054">
                          {t("dashboard.expenseLabel")}: {groupCurrencyFormatter.format(row.expenseTotal)}
                        </Text>
                        <Text size="xs" c="#344054">
                          {t("dashboard.savingLabel")}: {groupCurrencyFormatter.format(row.savingTotal)}
                        </Text>
                        <Text size="xs" fw={700} c={row.balanceTotal >= 0 ? "#087f5b" : "#c92a2a"}>
                          {t("dashboard.balanceLabel")}: {groupCurrencyFormatter.format(row.balanceTotal)}
                        </Text>
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            );
          })}
        </Stack>
      </Stack>
    </Paper>
  );
}