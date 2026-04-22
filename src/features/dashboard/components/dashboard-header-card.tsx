import Link from "next/link";
import { Badge, Button, Group, Menu, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";

import type { TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardHeaderCardProps = {
  isMobile: boolean;
  selectedPeriodLabel: string;
  workspaceSlug: string;
  currencyCode: string;
  monthOptions: Array<{ value: string; label: string }>;
  yearOptions: Array<{ value: string; label: string }>;
  selectedMonth: number;
  selectedYear: number;
  onSelectMonth: (month: number) => void;
  onSelectYear: (year: number) => void;
  t: TranslationFn;
};

export function DashboardHeaderCard({
  isMobile,
  selectedPeriodLabel,
  workspaceSlug,
  currencyCode,
  monthOptions,
  yearOptions,
  selectedMonth,
  selectedYear,
  onSelectMonth,
  onSelectYear,
  t,
}: DashboardHeaderCardProps) {
  return (
    <Paper
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      style={{
        border: "1px solid #d6dde7",
        backgroundColor: "#ffffff",
      }}
    >
      <Group justify="space-between" align={isMobile ? "flex-start" : "end"} wrap="wrap" gap="xs">
        <Stack gap={1}>
          <Group gap={6} align="baseline">
            <Title order={2} component="h1" size="h3" c="#1f2937">
              {t("dashboard.financialDashboard")}
            </Title>
            <Text size="sm" fw={600} c="#667085">
              - {currencyCode}
            </Text>
          </Group>
        </Stack>
        <Group gap={6} align="center" wrap="wrap">
          <Button
            component={Link}
            href={`/app/${workspaceSlug}/insights`}
            variant="light"
            color="indigo"
            size="xs"
          >
            {t("dashboard.viewInsights")}
          </Button>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <UnstyledButton
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #d0d5dd",
                  backgroundColor: "#f8fafc",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#344054",
                  cursor: "pointer",
                }}
              >
                {selectedPeriodLabel}
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>{t("dashboard.month")}</Menu.Label>
              {monthOptions.map((option) => {
                const monthValue = Number(option.value);
                const isSelected = monthValue === selectedMonth;

                return (
                  <Menu.Item
                    key={`month-${option.value}`}
                    onClick={() => {
                      if (isSelected) {
                        return;
                      }

                      onSelectMonth(monthValue);
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="xs">{option.label}</Text>
                      {isSelected ? (
                        <Badge variant="light" color="blue" size="xs">
                          {t("dashboard.current")}
                        </Badge>
                      ) : null}
                    </Group>
                  </Menu.Item>
                );
              })}

              <Menu.Divider />
              <Menu.Label>{t("dashboard.year")}</Menu.Label>
              {yearOptions.map((option) => {
                const yearValue = Number(option.value);
                const isSelected = yearValue === selectedYear;

                return (
                  <Menu.Item
                    key={`year-${option.value}`}
                    onClick={() => {
                      if (isSelected) {
                        return;
                      }

                      onSelectYear(yearValue);
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="xs">{option.label}</Text>
                      {isSelected ? (
                        <Badge variant="light" color="blue" size="xs">
                          {t("dashboard.current")}
                        </Badge>
                      ) : null}
                    </Group>
                  </Menu.Item>
                );
              })}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
}
