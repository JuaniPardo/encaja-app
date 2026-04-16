import { Group, Paper, Stack, Text } from "@mantine/core";

import type { PaymentMethodType } from "@/types/database";

type LinkedWorkspaceBalanceGroup = {
  linkId: string;
  workspaceId: string;
  workspaceName: string;
  currencyCode: string;
  visibilityMode: string;
  totalBalance: number;
  paymentMethods: Array<{
    id: string;
    name: string;
    type: PaymentMethodType;
    balance: number;
  }>;
};

type LinkedWorkspaceSummaryCardProps = {
  isMobile: boolean;
  linkedWorkspaceBalanceGroups: LinkedWorkspaceBalanceGroup[];
  linkedWorkspaceCurrencyFormatters: Map<string, Intl.NumberFormat>;
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string;
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
        border: "1px dashed #9ec5fe",
        backgroundColor: "#f5f9ff",
      }}
    >
      <Stack gap={isMobile ? 8 : "sm"}>
        <Stack gap={1}>
          <Text size="xs" fw={800} c="#1d4ed8">
            {t("dashboard.linkedWorkspacesExternalSummary")}
          </Text>
          <Text size="xs" c="#475467">
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
              bg="#ffffff"
            >
              <Stack gap={6}>
                <Stack gap={1}>
                  <Text size="sm" fw={700} c="#1f2937">
                    {group.workspaceName}
                  </Text>
                  <Text size="xs" c="#667085">
                    {group.currencyCode} · {group.visibilityMode}
                  </Text>
                </Stack>

                <Stack gap={4}>
                  {group.paymentMethods.map((paymentMethod) => (
                    <Group key={paymentMethod.id} justify="space-between" wrap="nowrap" gap={8}>
                      <Text size="sm" c="#344054" truncate>
                        {paymentMethod.name}
                      </Text>
                      <Text
                        size="sm"
                        fw={700}
                        c={paymentMethod.balance >= 0 ? "#087f5b" : "#c92a2a"}
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
                  style={{ borderTop: "1px solid #e4e7ec" }}
                >
                  <Text size="sm" fw={800} c="#1f2937">
                    {t("dashboard.totalBalance")}
                  </Text>
                  <Text
                    size="sm"
                    fw={800}
                    c={group.totalBalance >= 0 ? "#087f5b" : "#c92a2a"}
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