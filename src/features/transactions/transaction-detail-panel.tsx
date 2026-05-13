"use client";

import { ActionIcon, Button, Group, Modal, Paper, Stack, Text } from "@mantine/core";

import { formatCategoryWithOptionalSubcategory } from "@/features/categories/subcategories";
import { useI18n } from "@/features/i18n/provider";
import { transactionTypeMantineColor } from "@/features/transactions/type-colors";
import { resolveOperationalDate, type CategoryRow, type PaymentMethodRow, type TransactionRow } from "@/features/transactions/utils";
import type { Database } from "@/types/database";

type CategorySubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];

function EditIcon({ size = 16 }: { size?: number }) {
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

function TrashIcon({ size = 16 }: { size?: number }) {
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

type TransactionDetailContentProps = {
  row: TransactionRow | null;
  categoryById: Map<string, CategoryRow>;
  subcategoryById: Map<string, CategorySubcategoryRow>;
  paymentMethodById: Map<string, PaymentMethodRow>;
  visibleAmountFormatter: Intl.NumberFormat;
  formatDate: (dateValue: string | null) => string;
  deletingId: string | null;
  onEdit: (row: TransactionRow) => void;
  onDelete: (row: TransactionRow) => void;
};

function TransactionDetailContent({
  row,
  categoryById,
  subcategoryById,
  paymentMethodById,
  visibleAmountFormatter,
  formatDate,
  deletingId,
  onEdit,
  onDelete,
}: TransactionDetailContentProps) {
  const { t } = useI18n();

  if (!row) {
    return (
      <Paper withBorder radius="md" p="lg">
        <Stack gap={6}>
          <Text fw={600}>{t("transactions.detail.emptyTitle", "Select a transaction")}</Text>
          <Text size="sm" c="dimmed">
            {t(
              "transactions.detail.emptyBody",
              "Choose a movement from the list to see its full detail without losing context.",
            )}
          </Text>
        </Stack>
      </Paper>
    );
  }

  const category = categoryById.get(row.category_id);
  const subcategory = row.subcategory_id ? subcategoryById.get(row.subcategory_id) : null;
  const paymentMethod = row.payment_method_id ? paymentMethodById.get(row.payment_method_id) : null;
  const operationalDate = resolveOperationalDate(row);
  const typeColor = transactionTypeMantineColor[row.type];

  const detailRows = [
    {
      label: t("transactions.detail.category", "Category"),
      value: category
        ? formatCategoryWithOptionalSubcategory(category.name, subcategory?.name ?? null)
        : t("transactions.categoryUnavailable"),
    },
    {
      label: t("transactions.detail.transactionDate", "Transaction date"),
      value: formatDate(row.transaction_date),
    },
    {
      label: t("transactions.detail.effectiveDate", "Effective date"),
      value: formatDate(row.effective_date ?? operationalDate),
    },
    {
      label: t("transactions.detail.paymentMethod", "Method"),
      value: paymentMethod?.name ?? t("transactions.form.noPaymentMethod"),
    },
    {
      label: t("transactions.detail.type", "Type"),
      value: t(`transactions.types.${row.type}`, row.type),
    },
  ];

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.06em" }}>
            {formatDate(operationalDate)}
          </Text>
          <Text fw={700} size="lg" style={{ lineHeight: 1.15 }}>
            {category
              ? formatCategoryWithOptionalSubcategory(category.name, subcategory?.name ?? null)
              : t("transactions.categoryUnavailable")}
          </Text>
          <Text fw={800} c={`${typeColor}.7`} style={{ fontSize: "2rem", lineHeight: 1 }}>
            {visibleAmountFormatter.format(row.amount)}
          </Text>
          {row.description ? (
            <Text size="sm" c="dimmed">
              {row.description}
            </Text>
          ) : null}
        </Stack>

        <Stack gap="sm">
          {detailRows.map((item) => (
            <Group key={item.label} justify="space-between" align="flex-start" wrap="nowrap" gap="md">
              <Text size="sm" c="dimmed">
                {item.label}
              </Text>
              <Text size="sm" fw={600} ta="right">
                {item.value}
              </Text>
            </Group>
          ))}
        </Stack>

        {row.notes ? (
          <Stack gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.06em" }}>
              {t("transactions.detail.notes", "Notes")}
            </Text>
            <Text size="sm">{row.notes}</Text>
          </Stack>
        ) : null}

        <Group grow>
          <Button leftSection={<EditIcon size={14} />} onClick={() => onEdit(row)}>
            {t("transactions.edit")}
          </Button>
          <Button
            variant="outline"
            color="red"
            leftSection={<TrashIcon size={14} />}
            loading={deletingId === row.id}
            onClick={() => onDelete(row)}
          >
            {t("transactions.delete")}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

type TransactionDetailPanelProps = TransactionDetailContentProps;

export function TransactionDetailPanel(props: TransactionDetailPanelProps) {
  return (
    <div style={{ position: "sticky", top: "5.5rem" }}>
      <TransactionDetailContent {...props} />
    </div>
  );
}

type TransactionDetailModalProps = TransactionDetailContentProps & {
  opened: boolean;
  onClose: () => void;
};

export function TransactionDetailModal({ opened, onClose, row, ...rest }: TransactionDetailModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("transactions.detail.title", "Transaction detail")}
      fullScreen
      padding="md"
    >
      <TransactionDetailContent row={row} {...rest} />
    </Modal>
  );
}

type TransactionInlineActionsProps = {
  isMobile: boolean;
  hidden: boolean;
  deletingId: string | null;
  rowId: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function TransactionInlineActions({
  isMobile,
  hidden,
  deletingId,
  rowId,
  onEdit,
  onDelete,
}: TransactionInlineActionsProps) {
  const { t } = useI18n();

  if (isMobile) {
    return (
      <Group gap={4} wrap="nowrap">
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("transactions.edit")}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <EditIcon size={15} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={t("transactions.delete")}
          loading={deletingId === rowId}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <TrashIcon size={15} />
        </ActionIcon>
      </Group>
    );
  }

  return (
    <Group
      gap={4}
      wrap="nowrap"
      style={{
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "opacity 140ms ease",
      }}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={t("transactions.edit")}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <EditIcon size={15} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="red"
        aria-label={t("transactions.delete")}
        loading={deletingId === rowId}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon size={15} />
      </ActionIcon>
    </Group>
  );
}
