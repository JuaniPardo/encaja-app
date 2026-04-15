"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

const transferSchema = z.object({
  amount: z.string().min(1),
  categoryId: z.string().min(1),
  fromPaymentMethodId: z.string().min(1),
  toPaymentMethodId: z.string().min(1),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveDate: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

function toTransferDefaults(categories: CategoryRow[]): TransferFormValues {
  return {
    amount: "",
    categoryId: categories[0]?.id ?? "",
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
  categories: CategoryRow[];
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
  categories,
  paymentMethods,
  onSuccess,
}: TransferModalProps) {
  const { supabase, workspace, user } = useWorkspace();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const transferCategories = useMemo(
    () => categories.filter((c) => c.type === "transfer" && c.is_active),
    [categories],
  );
  const activePaymentMethods = useMemo(
    () => paymentMethods.filter((pm) => pm.is_active),
    [paymentMethods],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    mode: "onChange",
    defaultValues: toTransferDefaults(transferCategories),
  });

  useEffect(() => {
    if (!opened) {
      return;
    }

    reset(toTransferDefaults(transferCategories));
  }, [opened, reset, transferCategories]);

  const onSubmit = async (values: TransferFormValues) => {
    if (values.fromPaymentMethodId === values.toPaymentMethodId) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.registerError"),
        message: t("transactions.notifications.samePaymentMethodError"),
      });
      return;
    }

    setIsSubmitting(true);
    const amount = parseBudgetAmount(values.amount);
    if (amount == null) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.registerError"),
        message: t("transactions.notifications.invalidAmountError"),
      });
      setIsSubmitting(false);
      return;
    }
    const transferGroupId = crypto.randomUUID();

    const common = {
      workspace_id: workspace.id,
      type: "transfer" as const,
      category_id: values.categoryId,
      amount: Math.round(amount * 100) / 100,
      transaction_date: values.transactionDate,
      effective_date: values.effectiveDate || null,
      description: values.description || null,
      notes: values.notes || null,
      transfer_group_id: transferGroupId,
      created_by: user.id,
    };

    const outMovement = {
      ...common,
      direction: "out" as const,
      payment_method_id: values.fromPaymentMethodId,
    };

    const inMovement = {
      ...common,
      direction: "in" as const,
      payment_method_id: values.toPaymentMethodId,
    };

    const { error } = await supabase.from("transactions").insert([outMovement, inMovement]);

    setIsSubmitting(false);

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

    reset(toTransferDefaults(transferCategories));
    onSuccess();
    onClose();
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

          <Group grow align="start">
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <NativeSelect
                  label={t("transactions.category")}
                  required
                  data={[{ label: t("transactions.form.selectCategory"), value: "" }].concat(
                    transferCategories.map((c) => ({ label: c.name, value: c.id })),
                  )}
                  {...field}
                  error={errors.categoryId?.message}
                />
              )}
            />

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
          </Group>

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
            <Button type="submit" loading={isSubmitting} disabled={!isValid}>
              {t("transactions.transfer")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
