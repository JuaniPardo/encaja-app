import Link from "next/link";
import { Box, Button, Group, Progress, Stack, Text, TextInput } from "@mantine/core";
import { Controller, useFormContext } from "react-hook-form";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import type { BudgetFormInputValues } from "@/features/budget/schema";
import type { CategorySubcategoryRow } from "@/features/categories/subcategories";
import { useI18n } from "@/features/i18n/provider";
import { transactionTypeColorShade, transactionTypeMantineColor } from "@/features/transactions/type-colors";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

type BudgetLine = {
  key: string;
  index: number;
  subcategory: CategorySubcategoryRow | null;
};

type CategoryBudgetRowProps = {
  category: CategoryRow;
  rootLine: BudgetLine;
  subcategoryLines: BudgetLine[];
  spentAmount: number;
  spentByLine: Record<string, number>;
  currencyFormatter: Intl.NumberFormat;
  isMobile: boolean;
  canManageStructure: boolean;
  drilldownHref: string;
};

export function CategoryBudgetRow({
  category,
  rootLine,
  subcategoryLines,
  spentAmount,
  spentByLine,
  currencyFormatter,
  isMobile,
  canManageStructure,
  drilldownHref,
}: CategoryBudgetRowProps) {
  const { t } = useI18n();
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<BudgetFormInputValues>();
  const accentColor = transactionTypeMantineColor[category.type];
  const hasSubcategories = subcategoryLines.length > 0;

  const renderBudgetLine = ({
    index,
    label,
    description,
    amountLabel,
    spent,
    subcategoryId,
  }: {
    index: number;
    label: string;
    description?: string;
    amountLabel: string;
    spent: number;
    subcategoryId: string | null;
  }) => (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <input type="hidden" {...register(`items.${index}.categoryId` as const)} />
      <input type="hidden" {...register(`items.${index}.subcategoryId` as const)} />

      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Text fw={hasSubcategories && subcategoryId === null ? 600 : 500} size="sm" lineClamp={1}>
          {label}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {description}
          </Text>
        ) : null}
      </Stack>

      <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
        <Controller
          name={`items.${index}.amount` as const}
          control={control}
          render={({ field }) => {
            const budgetedAmount = parseBudgetAmount(field.value) ?? 0;
            const consumptionPercent =
              budgetedAmount > 0 ? Math.round((spent / budgetedAmount) * 100) : spent > 0 ? 100 : 0;
            const clampedPercent = Math.min(consumptionPercent, 100);
            const isOverSpent = budgetedAmount > 0 && spent > budgetedAmount;

            return (
              <>
                <TextInput
                  aria-label={amountLabel}
                  type="text"
                  inputMode="decimal"
                  size={isMobile ? "sm" : "md"}
                  placeholder="0"
                  value={
                    typeof field.value === "string"
                      ? field.value
                      : typeof field.value === "number"
                        ? formatBudgetAmount(field.value)
                        : ""
                  }
                  onChange={(event) => {
                    field.onChange(sanitizeBudgetTypingValue(event.currentTarget.value));
                  }}
                  onBlur={(event) => {
                    const parsed = parseBudgetAmount(event.currentTarget.value);
                    field.onChange(formatBudgetAmount(parsed ?? 0));
                    field.onBlur();
                  }}
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  disabled={!canManageStructure}
                  error={errors.items?.[index]?.amount?.message}
                  leftSection={
                    <Text size="xs" c="dimmed" fw={700}>
                      $
                    </Text>
                  }
                  leftSectionWidth={24}
                  styles={{
                    input: {
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: subcategoryId === null ? 700 : 600,
                    },
                  }}
                  style={{ width: isMobile ? 118 : 152 }}
                />

                <div style={{ width: isMobile ? 88 : 120 }}>
                  <Progress
                    value={clampedPercent}
                    color={isOverSpent ? "red" : accentColor}
                    size="sm"
                    radius="xl"
                  />
                  <Text
                    size="10px"
                    fw={700}
                    ta="right"
                    mt={4}
                    c={isOverSpent ? "red.7" : transactionTypeColorShade(category.type, 7)}
                  >
                    {t("budget.consumptionFeedback", undefined, {
                      percent: consumptionPercent,
                    })}
                  </Text>
                </div>

                <Stack gap={0} align="flex-end">
                  <Text size="xs" fw={600} c={isOverSpent ? "red.7" : "dimmed"} ta="right">
                    {t("budget.spentFeedback", undefined, {
                      amount: currencyFormatter.format(spent),
                      percent: consumptionPercent,
                    })}
                  </Text>

                  {budgetedAmount > 0 ? (
                    <Text
                      size="10px"
                      c={isOverSpent ? "red.7" : `${accentColor}.7`}
                      fw={700}
                      ta="right"
                    >
                      {t("budget.remainingFeedback", undefined, {
                        amount: currencyFormatter.format(Math.abs(budgetedAmount - spent)),
                        state:
                          budgetedAmount - spent >= 0
                            ? t("budget.remainingStates.available")
                            : t("budget.remainingStates.over"),
                      })}
                    </Text>
                  ) : null}
                </Stack>
              </>
            );
          }}
        />
      </Stack>
    </Group>
  );

  return (
    <Box
      style={{
        padding: isMobile ? "0.8rem 0" : "0.9rem 0",
        borderBottom: "1px solid var(--mantine-color-gray-2)",
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={650} size="sm" lineClamp={1}>
              {category.name}
            </Text>
            <Button
              component={Link}
              href={drilldownHref}
              variant="subtle"
              color="gray"
              size="compact-xs"
              justify="flex-start"
              px={0}
              h="auto"
            >
              {t("budget.viewMovements")}
            </Button>
          </Stack>
        </Group>

        {renderBudgetLine({
          index: rootLine.index,
          label: hasSubcategories ? t("budget.withoutSubcategory") : category.name,
          description: hasSubcategories ? t("budget.directCategoryHint") : undefined,
          amountLabel: t("budget.amountForCategory", undefined, {
            categoryName: category.name,
          }),
          spent: spentAmount,
          subcategoryId: null,
        })}

        {subcategoryLines.length > 0 ? (
          <Stack gap={8} pl={isMobile ? "md" : "lg"}>
            {subcategoryLines.map((line) =>
              renderBudgetLine({
                index: line.index,
                label: line.subcategory?.name ?? "",
                amountLabel: t("budget.amountForSubcategory", undefined, {
                  categoryName: category.name,
                  subcategoryName: line.subcategory?.name ?? "",
                }),
                spent: spentByLine[line.key] ?? 0,
                subcategoryId: line.subcategory?.id ?? null,
              }),
            )}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
