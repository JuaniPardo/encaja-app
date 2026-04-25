import Link from "next/link";
import { Box, Button, Group, Progress, Stack, Text, TextInput } from "@mantine/core";
import { Controller, useFormContext, useWatch } from "react-hook-form";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import { useI18n } from "@/features/i18n/provider";
import { transactionTypeColorShade, transactionTypeMantineColor } from "@/features/transactions/type-colors";
import type { BudgetFormInputValues } from "@/features/budget/schema";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

type CategoryBudgetRowProps = {
  category: CategoryRow;
  index: number;
  spentAmount: number;
  currencyFormatter: Intl.NumberFormat;
  isMobile: boolean;
  canManageStructure: boolean;
  drilldownHref: string;
};

export function CategoryBudgetRow({
  category,
  index,
  spentAmount,
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

  const watchedAmount = useWatch({
    control,
    name: `items.${index}.amount` as const,
  });

  const budgetedAmount = parseBudgetAmount(watchedAmount) ?? 0;
  const consumptionPercent =
    budgetedAmount > 0 ? Math.round((spentAmount / budgetedAmount) * 100) : spentAmount > 0 ? 100 : 0;
  const clampedPercent = Math.min(consumptionPercent, 100);
  const isOverSpent = budgetedAmount > 0 && spentAmount > budgetedAmount;
  const accentColor = transactionTypeMantineColor[category.type];

  return (
    <Box
      style={{
        padding: isMobile ? "0.8rem 0" : "0.9rem 0",
        borderBottom: "1px solid var(--mantine-color-gray-2)",
      }}
    >
      <input type="hidden" {...register(`items.${index}.categoryId` as const)} />

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

          <Controller
            name={`items.${index}.amount` as const}
            control={control}
            render={({ field }) => (
              <TextInput
                aria-label={t("budget.amountForCategory", undefined, {
                  categoryName: category.name,
                })}
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
                    fontWeight: 700,
                  },
                }}
                style={{ width: isMobile ? 118 : 152, flexShrink: 0 }}
              />
            )}
          />
        </Group>

        <Group justify="space-between" align="center" wrap="nowrap" gap="md">
          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={600} c={isOverSpent ? "red.7" : "dimmed"} lineClamp={1}>
              {t("budget.spentFeedback", undefined, {
                amount: currencyFormatter.format(spentAmount),
                percent: consumptionPercent,
              })}
            </Text>

            {budgetedAmount > 0 ? (
              <Text size="10px" c={isOverSpent ? "red.7" : `${accentColor}.7`} fw={700}>
                {t("budget.remainingFeedback", undefined, {
                  amount: currencyFormatter.format(Math.abs(budgetedAmount - spentAmount)),
                  state:
                    budgetedAmount - spentAmount >= 0
                      ? t("budget.remainingStates.available")
                      : t("budget.remainingStates.over"),
                })}
              </Text>
            ) : null}
          </Stack>

          <div style={{ width: isMobile ? 88 : 120, flexShrink: 0 }}>
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
              {t("budget.consumptionFeedback", undefined, { percent: consumptionPercent })}
            </Text>
          </div>
        </Group>
      </Stack>
    </Box>
  );
}
