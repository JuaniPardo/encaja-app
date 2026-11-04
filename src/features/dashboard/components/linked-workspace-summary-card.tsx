import { Group, Paper, Stack, Text } from "@mantine/core";

import type { LinkedWorkspaceBalanceGroup, TranslationFn } from "@/features/dashboard/types/dashboard";
import { mapWorkspaceVisibilityModeLabel } from "@/features/i18n/formatting";

type LinkedWorkspaceSummaryCardProps = {
  isMobile: boolean;
  linkedWorkspaceBalanceGroups: LinkedWorkspaceBalanceGroup[];
  linkedWorkspaceCurrencyFormatters: Map<string, Intl.NumberFormat>;
  t: TranslationFn;
};

export function LinkedWorkspaceSummaryCard({
  isMobile,
  linkedWorkspaceBalanceGroups,
  linkedWorkspaceCurrencyFormatters,
  t,
}: LinkedWorkspaceSummaryCardProps) {
  return (
    <Paper
      p={isMobile ? "xs" : "sm"}
      radius="sm"
      style={{
        border: "1px dashed var(--encaja-info-border-strong)",
        backgroundColor: "var(--encaja-info-bg)",
      }}
    >
      <Stack gap={isMobile ? 8 : "sm"}>
        <Stack gap={1}>
          <Text size="xs" fw={800} c="var(--encaja-info-text)">
            {t("dashboard.linkedWorkspacesExternalSummary")}
          </Text>
          <Text size="xs" c="var(--encaja-text-secondary)">
            {t("dashboard.linkedWorkspacesExternalSummaryDescription")}
          </Text>
        </Stack>

        {linkedWorkspaceBalanceGroups.map((group) => {
          const formatter =
            linkedWorkspaceCurrencyFormatters.get(group.currencyCode) ?? new Intl.NumberFormat();

          return (
            <Paper
              key={group.linkId}
              withBorder
              radius="sm"
              p={isMobile ? "xs" : "sm"}
              bg="var(--encaja-surface)"
            >
              <Stack gap={6}>
                <Stack gap={1}>
                  <Text size="sm" fw={700} c="var(--encaja-text-strong)">
                    {group.workspaceName}
                  </Text>
                  <Text size="xs" c="var(--encaja-text-muted)">
                    {group.currencyCode} · {mapWorkspaceVisibilityModeLabel(group.visibilityMode, t)}
                  </Text>
                </Stack>

                <Stack gap={4}>
                  {group.paymentMethods.map((paymentMethod) => (
                    <Group key={paymentMethod.id} justify="space-between" wrap="nowrap" gap={8}>
                      <Text size="sm" c="var(--encaja-text-primary)" truncate>
                        {paymentMethod.name}
                      </Text>
                      <Text
                        size="sm"
                        fw={700}
                        c={paymentMethod.balance >= 0 ? "var(--encaja-positive-text)" : "var(--encaja-negative-text)"}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {formatter.format(paymentMethod.balance)}
                      </Text>
                    </Group>
                  ))}
                </Stack>

                <Group
                  justify="space-between"
                  wrap="nowrap"
                  pt={4}
                  style={{ borderTop: "1px solid var(--encaja-border)" }}
                >
                  <Text size="sm" fw={800} c="var(--encaja-text-strong)">
                    {t("dashboard.totalBalance")}
                  </Text>
                  <Text
                    size="sm"
                    fw={800}
                    c={group.totalBalance >= 0 ? "var(--encaja-positive-text)" : "var(--encaja-negative-text)"}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {formatter.format(group.totalBalance)}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
}
