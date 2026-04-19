"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import { useI18n } from "@/features/i18n/provider";
import { resolveTransferSystemCategoryKey } from "@/features/transactions/transfer-category";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

function createTransferSchema(t: ReturnType<typeof useI18n>["t"]) {
  return z.object({
    amount: z
      .string()
      .refine((value) => {
        const parsed = parseBudgetAmount(value);
        return parsed !== null && parsed > 0;
      }, t("common.validation.amountGtZero")),
    fromPaymentMethodId: z.string().min(1, t("common.validation.invalidOption")),
    toPaymentMethodId: z.string().min(1, t("common.validation.invalidOption")),
    transactionDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, t("common.forms.transaction.requiredTransactionDate")),
    effectiveDate: z
      .string()
      .optional()
      .refine(
        (value) => value === undefined || value === "" || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value),
        t("common.validation.invalidDate"),
      ),
    description: z.string().max(120, t("common.forms.transaction.descriptionMaxLength")).optional(),
    notes: z.string().max(240, t("common.forms.transaction.notesMaxLength")).optional(),
  });
}

type TransferFormValues = z.infer<ReturnType<typeof createTransferSchema>>;

function toTransferDefaults(): TransferFormValues {
  return {
    amount: "",
    fromPaymentMethodId: "",
    toPaymentMethodId: "",
    transactionDate: toDateInputValue(new Date()),
    effectiveDate: "",
    description: "",
    notes: "",
  };
}

interface TransferModalProps {
  opened: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethodRow[];
  onSuccess: () => void;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TransferModal({
  opened,
  onClose,
  paymentMethods,
  onSuccess,
}: TransferModalProps) {
  const { supabase, workspace } = useWorkspace();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transferSchema = useMemo(() => createTransferSchema(t), [t]);

  const activePaymentMethods = useMemo(
    () => paymentMethods.filter((pm) => pm.is_active),
    [paymentMethods],
  );
  const paymentMethodById = useMemo(
    () => new Map(activePaymentMethods.map((pm) => [pm.id, pm])),
    [activePaymentMethods],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    mode: "onChange",
    defaultValues: toTransferDefaults(),
  });

  const fromPaymentMethodId = useWatch({ control, name: "fromPaymentMethodId" });
  const toPaymentMethodId = useWatch({ control, name: "toPaymentMethodId" });

  const inferredTransfer = useMemo(() => {
    if (!fromPaymentMethodId || !toPaymentMethodId) {
      return {
        systemKey: null,
        message: t("transactions.transferInference.pending"),
        isError: false,
      };
    }

    if (fromPaymentMethodId === toPaymentMethodId) {
      return {
        systemKey: null,
        message: t("transactions.notifications.samePaymentMethodError"),
        isError: true,
      };
    }

    const fromMethod = paymentMethodById.get(fromPaymentMethodId);
    const toMethod = paymentMethodById.get(toPaymentMethodId);

    if (!fromMethod || !toMethod) {
      return {
        systemKey: null,
        message: t("transactions.notifications.invalidPaymentMethodMessage"),
        isError: true,
      };
    }

    try {
      const systemKey = resolveTransferSystemCategoryKey(fromMethod.type, toMethod.type);
      return {
        systemKey,
        message: t(`transactions.transferInference.${systemKey}`),
        isError: false,
      };
    } catch {
      return {
        systemKey: null,
        message: t("transactions.notifications.invalidTransferCombinationError"),
        isError: true,
      };
    }
  }, [fromPaymentMethodId, paymentMethodById, t, toPaymentMethodId]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    reset(toTransferDefaults());
  }, [opened, reset]);

  const onSubmit = async (values: TransferFormValues) => {
    if (values.fromPaymentMethodId === values.toPaymentMethodId) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.registerError"),
        message: t("transactions.notifications.samePaymentMethodError"),
      });
      return;
    }

    const amount = parseBudgetAmount(values.amount);
    if (amount == null) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.registerError"),
        message: t("transactions.notifications.invalidAmountError"),
      });
      return;
    }

    if (inferredTransfer.isError || !inferredTransfer.systemKey) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.registerError"),
        message: inferredTransfer.message,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc("create_transfer_transaction", {
        p_workspace_id: workspace.id,
        p_from_payment_method_id: values.fromPaymentMethodId,
        p_to_payment_method_id: values.toPaymentMethodId,
        p_amount: Math.round(amount * 100) / 100,
        p_transaction_date: values.transactionDate,
        p_effective_date: values.effectiveDate || null,
        p_description: values.description || null,
        p_notes: values.notes || null,
      });

      if (error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.registerError"),
          message: error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.transferCreatedTitle"),
        message: t("transactions.notifications.transferCreatedMessage"),
      });

      reset(toTransferDefaults());
      onSuccess();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("transactions.transfer")}
      size="md"
      centered
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="sm">
          <Group grow align="start">
            <Controller
              name="fromPaymentMethodId"
              control={control}
              render={({ field }) => (
                <NativeSelect
                  label={t("transactions.form.fromPaymentMethod")}
                  required
                  data={[{ label: t("transactions.form.noPaymentMethod"), value: "" }].concat(
                    activePaymentMethods.map((pm) => ({ label: pm.name, value: pm.id })),
                  )}
                  {...field}
                  error={errors.fromPaymentMethodId?.message}
                />
              )}
            />

            <Controller
              name="toPaymentMethodId"
              control={control}
              render={({ field }) => (
                <NativeSelect
                  label={t("transactions.form.toPaymentMethod")}
                  required
                  data={[{ label: t("transactions.form.noPaymentMethod"), value: "" }].concat(
                    activePaymentMethods.map((pm) => ({ label: pm.name, value: pm.id })),
                  )}
                  {...field}
                  error={errors.toPaymentMethodId?.message}
                />
              )}
            />
          </Group>

          <Alert color={inferredTransfer.isError ? "red" : "cyan"} variant="light">
            {inferredTransfer.message}
          </Alert>

          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextInput
                label={t("transactions.form.amount")}
                inputMode="decimal"
                placeholder="0"
                required
                data-autofocus
                error={errors.amount?.message}
                value={field.value}
                onChange={(event) => {
                  field.onChange(sanitizeBudgetTypingValue(event.currentTarget.value));
                }}
                onBlur={(event) => {
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

          <Controller
            name="transactionDate"
            control={control}
            render={({ field }) => (
              <TextInput
                type="date"
                label={t("transactions.form.transactionDate")}
                required
                {...field}
                error={errors.transactionDate?.message}
              />
            )}
          />

          <Paper withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Text size="xs" c="dimmed" fw={600}>
                {t("transactions.form.optionalFields")}
              </Text>

              <Stack gap="md">
                <Controller
                  name="effectiveDate"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      type="date"
                      label={t("transactions.form.effectiveDate")}
                      {...field}
                    />
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label={t("transactions.form.description")}
                      placeholder={t("transactions.form.descriptionPlaceholder")}
                      {...field}
                    />
                  )}
                />

                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      label={t("transactions.form.notes")}
                      placeholder={t("transactions.form.notesPlaceholder")}
                      minRows={2}
                      autosize
                      {...field}
                    />
                  )}
                />
              </Stack>
            </Stack>
          </Paper>

          <Group justify="flex-end" mt="sm">
            <Button
              type="button"
              variant="light"
              color="gray"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!isValid || inferredTransfer.systemKey === null || inferredTransfer.isError}
            >
              {t("transactions.transfer")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
