"use client";

import { Button, Paper, Group, Stack, Text } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";
import { transactionTypeColorCssVar } from "@/features/transactions/type-colors";
import type { Database, TransactionType } from "@/types/database";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

export type TransactionGroup = {
  key: string;
  label: string;
  rows: TransactionRow[];
};

const transactionTypeCardBackgrounds: Record<TransactionType, string> = {
  income: transactionTypeColorCssVar("income", 0),
  expense: transactionTypeColorCssVar("expense", 0),
  saving: transactionTypeColorCssVar("saving", 0),
  transfer: transactionTypeColorCssVar("transfer", 0),
};

function EditIcon({ size = 14 }: { size?: number }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ size = 14 }: { size?: number }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

type TransactionsListProps = {
  groupedRows: TransactionGroup[];
  isMobile: boolean;
  categoryById: Map<string, CategoryRow>;
  paymentMethodById: Map<string, PaymentMethodRow>;
  visibleAmountFormatter: Intl.NumberFormat;
  formatCompactDate: (dateValue: string) => string;
  deletingId: string | null;
  onOpenEditModal: (row: TransactionRow) => void;
  onConfirmDelete: (row: TransactionRow) => void;
};

export function TransactionsList({
  groupedRows,
  isMobile,
  categoryById,
  paymentMethodById,
  visibleAmountFormatter,
  formatCompactDate,
  deletingId,
  onOpenEditModal,
  onConfirmDelete,
}: TransactionsListProps) {
  const { t } = useI18n();

  return (
    <Paper withBorder radius="md" p={6}>
      {groupedRows.length === 0 ? (
        <Text size="sm" c="dimmed" p="xs">
          {t("transactions.emptyState")}
        </Text>
      ) : (
        <Stack gap={8}>
          {groupedRows.map((group) => (
            <Stack key={group.key} gap={5}>
              <Text
                size="10px"
                fw={700}
                c="dimmed"
                px={6}
                tt="uppercase"
                style={{ letterSpacing: "0.04em" }}
              >
                {group.label}
              </Text>

              <Stack gap={5}>
                {group.rows.map((row) => {
                  const category = categoryById.get(row.category_id);
                  const paymentMethod = row.payment_method_id
                    ? paymentMethodById.get(row.payment_method_id)
                    : null;
                  const isInstallment =
                    row.installment_purchase_id !== null &&
                    row.installment_number !== null &&
                    row.installment_count !== null;
                  const operationalDate = row.effective_date ?? row.transaction_date;

                  const metaParts = [formatCompactDate(operationalDate)];
                  if (paymentMethod?.name) {
                    metaParts.push(paymentMethod.name);
                  }
                  if (row.effective_date) {
                    metaParts.push(
                      `${t("transactions.realPrefix")} ${formatCompactDate(row.transaction_date)}`,
                    );
                  }
                  if (isInstallment) {
                    metaParts.push(
                      t("transactions.installmentBadge", undefined, {
                        current: Number(row.installment_number ?? 0),
                        total: Number(row.installment_count ?? 0),
                      }),
                    );
                  }

                  return (
                    <Paper
                      key={row.id}
                      withBorder
                      radius={6}
                      p={isMobile ? 7 : 8}
                      style={{
                        backgroundColor: transactionTypeCardBackgrounds[row.type],
                        borderColor: "var(--mantine-color-gray-3)",
                      }}
                    >
                      <Stack gap={3}>
                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap={6}>
                          <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={600} size="sm" lineClamp={1} style={{ lineHeight: 1.15 }}>
                              {category?.name ?? t("transactions.categoryUnavailable")}
                            </Text>

                            {row.description ? (
                              <Text size="11px" c="dimmed" lineClamp={1} style={{ lineHeight: 1.15 }}>
                                {row.description}
                              </Text>
                            ) : null}
                          </Stack>

                          <Stack
                            align="flex-end"
                            gap={1}
                            style={{ minWidth: isMobile ? 132 : 196, flexShrink: 0 }}
                          >
                            <Text
                              fw={800}
                              style={{
                                fontSize: isMobile ? "1.2rem" : "1.5rem",
                                textAlign: "right",
                                lineHeight: 1,
                                letterSpacing: "-0.01em",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {visibleAmountFormatter.format(row.amount)}
                            </Text>
                          </Stack>
                        </Group>

                        <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                          <Text size="11px" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
                            {metaParts.join(" · ")}
                          </Text>

                          <Group gap={1} wrap="nowrap">
                            {!isInstallment ? (
                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                leftSection={<EditIcon size={11} />}
                                onClick={() => onOpenEditModal(row)}
                                aria-label={t("transactions.edit")}
                                px={isMobile ? 6 : 8}
                                styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                              >
                                {isMobile ? null : t("transactions.edit")}
                              </Button>
                            ) : null}
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              leftSection={<TrashIcon size={11} />}
                              loading={deletingId === row.id}
                              onClick={() => onConfirmDelete(row)}
                              aria-label={t("transactions.delete")}
                              px={isMobile ? 6 : 8}
                              styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                            >
                              {isMobile ? null : t("transactions.delete")}
                            </Button>
                          </Group>
                        </Group>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
