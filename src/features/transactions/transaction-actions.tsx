"use client";

import { Button, Group, Paper } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";

type TransactionsActionsProps = {
  isMobile: boolean;
  canCreateTransaction: boolean;
  canCreateTransfer: boolean;
  onCreateTransaction: () => void;
  onCreateTransfer: () => void;
};

export function TransactionsHeaderActions({
  isMobile,
  canCreateTransaction,
  canCreateTransfer,
  onCreateTransaction,
  onCreateTransfer,
}: TransactionsActionsProps) {
  const { t } = useI18n();

  if (isMobile) {
    return null;
  }

  return (
    <Group gap="xs">
      <Button onClick={onCreateTransaction} disabled={!canCreateTransaction}>
        {t("transactions.new")}
      </Button>
      <Button variant="outline" onClick={onCreateTransfer} disabled={!canCreateTransfer}>
        {t("transactions.transfer")}
      </Button>
    </Group>
  );
}

export function TransactionsMobileActionsBar({
  isMobile,
  canCreateTransaction,
  canCreateTransfer,
  onCreateTransaction,
  onCreateTransfer,
}: TransactionsActionsProps) {
  const { t } = useI18n();

  if (!isMobile) {
    return null;
  }

  return (
    <Paper
      withBorder
      radius={8}
      p={6}
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        zIndex: 40,
        backgroundColor: "var(--mantine-color-body)",
        boxShadow: "0 -8px 18px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Group grow wrap="nowrap" gap={6}>
        <Button onClick={onCreateTransaction} disabled={!canCreateTransaction}>
          {t("transactions.new")}
        </Button>
        <Button variant="outline" onClick={onCreateTransfer} disabled={!canCreateTransfer}>
          {t("transactions.transfer")}
        </Button>
      </Group>
    </Paper>
  );
}
