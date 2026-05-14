"use client";

import { Paper, Stack, Text } from "@mantine/core";

import { formatCategoryWithOptionalSubcategory } from "@/features/categories/subcategories";
import { useI18n } from "@/features/i18n/provider";
import { TransactionInlineActions } from "@/features/transactions/transaction-detail-panel";
import { transactionTypeMantineColor } from "@/features/transactions/type-colors";
import { resolveOperationalDate } from "@/features/transactions/utils";
import type { Database } from "@/types/database";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategorySubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

export type TransactionGroup = {
  key: string;
  label: string;
  rows: TransactionRow[];
};

type TransactionsListProps = {
  groupedRows: TransactionGroup[];
  selectedTransactionId: string | null;
  isMobile: boolean;
  categoryById: Map<string, CategoryRow>;
  subcategoryById: Map<string, CategorySubcategoryRow>;
  paymentMethodById: Map<string, PaymentMethodRow>;
  visibleAmountFormatter: Intl.NumberFormat;
  formatCompactDate: (dateValue: string) => string;
  deletingId: string | null;
  onSelectTransaction: (row: TransactionRow) => void;
  onOpenEditModal: (row: TransactionRow) => void;
  onConfirmDelete: (row: TransactionRow) => void;
};

export function TransactionsList({
  groupedRows,
  selectedTransactionId,
  isMobile,
  categoryById,
  subcategoryById,
  paymentMethodById,
  visibleAmountFormatter,
  formatCompactDate,
  deletingId,
  onSelectTransaction,
  onOpenEditModal,
  onConfirmDelete,
}: TransactionsListProps) {
  const { t } = useI18n();

  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      {groupedRows.length === 0 ? (
        <Text size="sm" c="dimmed" p="md">
          {t("transactions.emptyState")}
        </Text>
      ) : (
        <Stack gap={0}>
          {groupedRows.map((group, groupIndex) => (
            <Stack key={group.key} gap={0}>
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  padding: "0.7rem 1rem 0.45rem",
                  backgroundColor: "color-mix(in srgb, var(--mantine-color-body) 94%, white 6%)",
                  borderTop:
                    groupIndex === 0 ? "none" : "1px solid var(--mantine-color-gray-2)",
                  borderBottom: "1px solid var(--mantine-color-gray-2)",
                }}
              >
                <Text
                  size="10px"
                  fw={800}
                  c="dimmed"
                  tt="uppercase"
                  style={{ letterSpacing: "0.08em" }}
                >
                  {group.label}
                </Text>
              </div>

              {group.rows.map((row) => {
                const category = categoryById.get(row.category_id);
                const subcategory = row.subcategory_id
                  ? subcategoryById.get(row.subcategory_id)
                  : null;
                const paymentMethod = row.payment_method_id
                  ? paymentMethodById.get(row.payment_method_id)
                  : null;
                const operationalDate = resolveOperationalDate(row);
                const isSelected = row.id === selectedTransactionId;
                const typeColor = transactionTypeMantineColor[row.type];
                const metaParts = [];

                if (paymentMethod?.name) {
                  metaParts.push(paymentMethod.name);
                }
                metaParts.push(formatCompactDate(operationalDate));

                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectTransaction(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectTransaction(row);
                      }
                    }}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid var(--mantine-color-gray-2)",
                      backgroundColor: isSelected
                        ? `var(--mantine-color-${typeColor}-0)`
                        : "transparent",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr auto" : "1fr auto auto",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: isMobile ? "0.8rem 0.85rem" : "0.8rem 1rem",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Text fw={650} size="sm" lineClamp={1} style={{ lineHeight: 1.15 }}>
                          {category
                            ? formatCategoryWithOptionalSubcategory(
                                category.name,
                                subcategory?.name ?? null,
                              )
                            : t("transactions.categoryUnavailable")}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1} mt={4} style={{ lineHeight: 1.2 }}>
                          {row.description?.trim() ? `${row.description} · ${metaParts.join(" · ")}` : metaParts.join(" · ")}
                        </Text>
                      </div>

                      <Text
                        fw={800}
                        c={`${typeColor}.7`}
                        ta="right"
                        style={{
                          fontSize: isMobile ? "1rem" : "1.15rem",
                          lineHeight: 1,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {visibleAmountFormatter.format(row.amount)}
                      </Text>

                      <TransactionInlineActions
                        isMobile={isMobile}
                        hidden={!isSelected}
                        deletingId={deletingId}
                        rowId={row.id}
                        onEdit={() => {
                          void onOpenEditModal(row);
                        }}
                        onDelete={() => onConfirmDelete(row)}
                      />
                    </div>
                  </div>
                );
              })}
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
