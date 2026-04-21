"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  Modal,
  NativeSelect,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo, type CSSProperties } from "react";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import {
  createTransactionFormSchema,
  type TransactionFormInputValues,
  type TransactionFormValues,
} from "@/features/transactions/schema";
import {
  transactionTypeMantineColor,
} from "@/features/transactions/type-colors";
import { useI18n } from "@/features/i18n/provider";
import type { Database, TransactionType } from "@/types/database";
import classes from "./transaction-form-modal.module.css";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type QuickPaymentMethodType = "cash" | "debit_card";
type CategoryOption = { value: string; label: string };
type CategoryOptionGroup = { group: string; items: CategoryOption[] };

type TransactionFormModalProps = {
  opened: boolean;
  onClose: () => void;
  editingRow: TransactionRow | null;
  categories: CategoryRow[];
  paymentMethods: PaymentMethodRow[];
  paymentMethodOptions: Array<{ value: string; label: string }>;
  transactionTypeSelectData: Array<{ value: string; label: string }>;
  isMobile: boolean | undefined;
  quickPaymentMethodType: QuickPaymentMethodType;
  setQuickPaymentMethodType: (value: QuickPaymentMethodType) => void;
  quickPaymentMethodSelectData: Array<{ value: string; label: string }>;
  shouldShowQuickPaymentSetup: boolean;
  initialValues: TransactionFormInputValues;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
};

export function TransactionFormModal({
  opened,
  onClose,
  editingRow,
  categories,
  paymentMethods,
  paymentMethodOptions,
  transactionTypeSelectData,
  isMobile,
  quickPaymentMethodType,
  setQuickPaymentMethodType,
  quickPaymentMethodSelectData,
  shouldShowQuickPaymentSetup,
  initialValues,
  onSubmit,
}: TransactionFormModalProps) {
  const { t } = useI18n();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormInputValues, unknown, TransactionFormValues>({
    resolver: zodResolver(
      createTransactionFormSchema({
        invalidAmount: t("common.validation.invalidAmount"),
        amountGtZero: t("common.validation.amountGtZero"),
        invalidDate: t("common.validation.invalidDate"),
        invalidOption: t("common.validation.invalidOption"),
        requiredCategory: t("common.forms.transaction.requiredCategory"),
        invalidCategory: t("common.forms.transaction.invalidCategory"),
        requiredTransactionDate: t("common.forms.transaction.requiredTransactionDate"),
        descriptionMaxLength: t("common.forms.transaction.descriptionMaxLength"),
        notesMaxLength: t("common.forms.transaction.notesMaxLength"),
        invalidInstallmentsCount: t("common.validation.integerNumber"),
        installmentsCountMin: t("transactions.form.installmentsCountMin"),
        installmentsCountMax: t("transactions.form.installmentsCountMax"),
      }),
    ),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const selectedType = useWatch({ control, name: "type" });
  const selectedPaymentMethodId = useWatch({ control, name: "paymentMethodId" });
  const selectedInstallmentsCount = useWatch({ control, name: "installmentsCount" });

  const paymentMethodById = useMemo(
    () => new Map(paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod])),
    [paymentMethods],
  );

  const selectedPaymentMethod = useMemo(() => {
    if (typeof selectedPaymentMethodId !== "string" || selectedPaymentMethodId.trim() === "") {
      return null;
    }

    return paymentMethodById.get(selectedPaymentMethodId) ?? null;
  }, [paymentMethodById, selectedPaymentMethodId]);

  const shouldShowInstallmentsField =
    selectedType === "expense" && selectedPaymentMethod?.type === "credit_card";

  const categoryOptions = useMemo(() => {
    const currentCategoryId = editingRow?.category_id ?? null;

    const availableRows = categories
      .filter(
        (category) =>
          category.type === (selectedType ?? "expense") &&
          (category.is_active || category.id === currentCategoryId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    const toOption = (category: CategoryRow): CategoryOption => ({
      value: category.id,
      label: category.is_active
        ? `${category.name}${
            category.is_exceptional ? ` (${t("transactions.exceptionalCategory.suffix")})` : ""
          }`
        : `${category.name}${
            category.is_exceptional ? ` (${t("transactions.exceptionalCategory.suffix")})` : ""
          } (${t("transactions.inactiveCategorySuffix")})`,
    });

    const systemItems = availableRows
      .filter((category) => category.source === "system")
      .map(toOption);
    const customItems = availableRows
      .filter((category) => category.source === "custom")
      .map(toOption);
    const groupedOptions: CategoryOptionGroup[] = [];

    if (systemItems.length > 0) {
      groupedOptions.push({ group: t("categories.source.system"), items: systemItems });
    }

    if (customItems.length > 0) {
      groupedOptions.push({ group: t("categories.source.custom"), items: customItems });
    }

    return groupedOptions;
  }, [categories, editingRow?.category_id, selectedType, t]);

  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const selectedExceptionalWarning = selectedCategory?.is_exceptional
    ? selectedCategory.warning_message ?? t("transactions.exceptionalCategory.defaultWarning")
    : null;

  useEffect(() => {
    if (!selectedCategoryId) {
      return;
    }

    const isAvailable = categoryOptions.some((option) =>
      option.items.some((item) => item.value === selectedCategoryId),
    );
    if (!isAvailable) {
      reset(
        {
          ...control._formValues,
          categoryId: "",
        },
        {
          keepErrors: true,
          keepDirty: true,
          keepTouched: true,
        },
      );
    }
  }, [categoryOptions, control._formValues, reset, selectedCategoryId]);

  useEffect(() => {
    if (shouldShowInstallmentsField) {
      return;
    }

    if (Number(selectedInstallmentsCount ?? 1) === 1) {
      return;
    }

    setValue("installmentsCount", 1, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [selectedInstallmentsCount, setValue, shouldShowInstallmentsField]);

  const selectedTypeColor = transactionTypeMantineColor[selectedType ?? "expense"];
  const typeSegmentVars = {
    "--transaction-type-active-label-color": `var(--mantine-color-${selectedTypeColor}-7)`,
    "--transaction-type-indicator-background": `var(--mantine-color-${selectedTypeColor}-0)`,
    "--transaction-type-indicator-border": `var(--mantine-color-${selectedTypeColor}-2)`,
  } as CSSProperties;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingRow ? t("transactions.edit") : t("transactions.new")}
      size="lg"
      fullScreen={isMobile}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="sm">
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {t("transactions.type")}
            </Text>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <SegmentedControl
                  fullWidth
                  data={transactionTypeSelectData}
                  value={field.value}
                  onChange={(value) => field.onChange(value as TransactionType)}
                  classNames={{
                    root: classes.typeSegmentRoot,
                    indicator: classes.typeSegmentIndicator,
                    label: classes.typeSegmentLabel,
                    innerLabel: classes.typeSegmentInnerLabel,
                  }}
                  style={typeSegmentVars}
                />
              )}
            />
            {errors.type?.message ? (
              <Text size="xs" c="red">
                {errors.type.message}
              </Text>
            ) : null}
          </Stack>

          <Group grow align="start">
            <NativeSelect
              label={t("transactions.category")}
              data={[{ value: "", label: t("transactions.form.selectCategory") }, ...categoryOptions]}
              error={errors.categoryId?.message}
              {...register("categoryId")}
            />

            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <TextInput
                  label={t("transactions.form.amount")}
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  error={errors.amount?.message}
                  value={
                    typeof field.value === "string"
                      ? field.value
                      : field.value === null || field.value === undefined
                        ? ""
                        : String(field.value)
                  }
                  onChange={(event) => {
                    field.onChange(sanitizeBudgetTypingValue(event.currentTarget.value));
                  }}
                  onBlur={(event) => {
                    field.onBlur();
                    const parsed = parseBudgetAmount(event.currentTarget.value);
                    field.onChange(parsed === null ? "" : formatBudgetAmount(parsed));
                  }}
                  leftSection={
                    <Text size="xs" c="dimmed" fw={700}>
                      $
                    </Text>
                  }
                  leftSectionWidth={24}
                  styles={{ input: { textAlign: "right", fontVariantNumeric: "tabular-nums" } }}
                />
              )}
            />
          </Group>

          {selectedExceptionalWarning ? (
            <Alert color="yellow" variant="light" title={t("transactions.exceptionalCategory.title")}>
              {selectedExceptionalWarning}
            </Alert>
          ) : null}

          <TextInput
            label={t("transactions.form.transactionDate")}
            type="date"
            error={errors.transactionDate?.message}
            {...register("transactionDate")}
          />

          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Text size="xs" c="dimmed" fw={600}>
                {t("transactions.form.optionalFields")}
              </Text>

              <Group grow align="start">
                <TextInput
                  label={t("transactions.form.effectiveDate")}
                  type="date"
                  error={errors.effectiveDate?.message}
                  {...register("effectiveDate")}
                />

                {shouldShowQuickPaymentSetup ? (
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      {t("transactions.quickPayment.title")}
                    </Text>
                    <SegmentedControl
                      fullWidth
                      data={quickPaymentMethodSelectData}
                      value={quickPaymentMethodType}
                      onChange={(value) => {
                        setQuickPaymentMethodType(value as QuickPaymentMethodType);
                      }}
                    />
                  </Stack>
                ) : (
                  <NativeSelect
                    label={t("transactions.paymentMethod")}
                    data={[
                      { value: "", label: t("transactions.form.noPaymentMethod") },
                      ...paymentMethodOptions,
                    ]}
                    error={errors.paymentMethodId?.message}
                    {...register("paymentMethodId")}
                  />
                )}
              </Group>

              {shouldShowQuickPaymentSetup ? (
                <Text size="xs" c="dimmed">
                  {t("transactions.quickPayment.hint")}
                </Text>
              ) : null}

              {shouldShowInstallmentsField ? (
                <TextInput
                  label={t("transactions.form.installmentsCount")}
                  description={t("transactions.form.installmentsHint")}
                  type="number"
                  min={1}
                  max={120}
                  error={errors.installmentsCount?.message}
                  {...register("installmentsCount")}
                />
              ) : null}

              <TextInput
                label={t("transactions.form.description")}
                placeholder={t("transactions.form.descriptionPlaceholder")}
                error={errors.description?.message}
                {...register("description")}
              />

              <Textarea
                label={t("transactions.form.notes")}
                placeholder={t("transactions.form.notesPlaceholder")}
                minRows={2}
                autosize
                error={errors.notes?.message}
                {...register("notes")}
              />
            </Stack>
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button type="button" variant="light" color="gray" onClick={onClose}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editingRow ? t("common.actions.save") : t("common.actions.create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
