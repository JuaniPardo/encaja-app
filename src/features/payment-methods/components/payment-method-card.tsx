"use client";

import Link from "next/link";
import { ActionIcon, Badge, Button, Group, Menu, Paper, Stack, Text } from "@mantine/core";

import type { Database, PaymentMethodType } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

export type PaymentMethodCardData = PaymentMethodRow & {
  displayedBalance: number;
  movementCount: number;
  canDelete: boolean;
};

type PaymentMethodCardProps = {
  row: PaymentMethodCardData;
  canManageStructure: boolean;
  paymentTypeLabels: Record<PaymentMethodType, string>;
  currencyFormatter: Intl.NumberFormat;
  paymentMethodDrilldownHref: (paymentMethodId: string) => string;
  onEdit: (row: PaymentMethodRow) => void;
  onToggleActive: (row: PaymentMethodRow) => void;
  onDelete: (row: PaymentMethodCardData) => void;
  t: TranslationFn;
};

function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function PaymentMethodCard({
  row,
  canManageStructure,
  paymentTypeLabels,
  currencyFormatter,
  paymentMethodDrilldownHref,
  onEdit,
  onToggleActive,
  onDelete,
  t,
}: PaymentMethodCardProps) {
  return (
    <Paper withBorder radius="md" p="md" bg="#ffffff">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
            <Text fw={700} size="lg" lineClamp={1} style={{ lineHeight: 1.2 }}>
              {row.name}
            </Text>
            <Group gap={6} wrap="wrap">
              <Badge variant="light">{paymentTypeLabels[row.type]}</Badge>
              <Badge color={row.is_active ? "cyan" : "gray"} variant="outline">
                {row.is_active ? t("paymentMethods.status.active") : t("paymentMethods.status.inactive")}
              </Badge>
            </Group>
          </Stack>

          <Menu position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t("paymentMethods.actionsFor", undefined, { name: row.name })}
              >
                <DotsIcon />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item disabled={!canManageStructure} onClick={() => onEdit(row)}>
                {t("paymentMethods.edit")}
              </Menu.Item>
              <Menu.Item
                color={row.is_active ? "gray" : "cyan"}
                disabled={!canManageStructure}
                onClick={() => onToggleActive(row)}
              >
                {row.is_active ? t("paymentMethods.deactivate") : t("paymentMethods.activate")}
              </Menu.Item>
              <Menu.Item
                color="red"
                disabled={!canManageStructure || !row.canDelete}
                onClick={() => onDelete(row)}
              >
                {t("paymentMethods.delete")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text
          fw={900}
          size="2rem"
          lh={1}
          c={row.displayedBalance > 0 ? "#087f5b" : row.displayedBalance < 0 ? "#c92a2a" : "#475467"}
        >
          {currencyFormatter.format(row.displayedBalance)}
        </Text>

        <Group justify="space-between" wrap="wrap" gap={6}>
          <Badge variant={row.include_in_balance ? "light" : "outline"} color="blue">
            {row.include_in_balance
              ? t("paymentMethods.includedInBalance")
              : t("paymentMethods.excludedFromBalance")}
          </Badge>
          {row.type === "credit_card" ? (
            <Text size="xs" c="dimmed">
              {t("paymentMethods.creditCardDays", undefined, {
                closingDay: row.closing_day ?? "-",
                dueDay: row.due_day ?? "-",
              })}
            </Text>
          ) : null}
        </Group>

        {!row.canDelete ? (
          <Text size="xs" c="dimmed">
            {t("paymentMethods.deleteBlockedMessage", undefined, { count: row.movementCount })}
          </Text>
        ) : null}

        <Button
          component={Link}
          href={paymentMethodDrilldownHref(row.id)}
          variant="subtle"
          color="gray"
          size="compact-xs"
          px={0}
          justify="flex-start"
        >
          {t("paymentMethods.viewMovements")}
        </Button>
      </Stack>
    </Paper>
  );
}
