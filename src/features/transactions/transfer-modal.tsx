"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Group,
  Modal,
  NativeSelect,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
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
  const [showOptional, setShowOptional] = useState(false);

  const transferCategories = categories.filter((c) => c.type === "transfer" && c.is_active);
  const activePaymentMethods = paymentMethods.filter((pm) => pm.is_active);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    mode: "onChange",
    defaultValues: {
      amount: "",
      categoryId: transferCategories[0]?.id ?? "",
      fromPaymentMethodId: "",
      toPaymentMethodId: "",
      transactionDate: toDateInputValue(new Date()),
      effectiveDate: "",
      description: "",
      notes: "",
    },
  });

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

    reset();
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
        <Stack gap="md">
          <Controller
            name="amount"
            control={control}
            render={({ field }) => (
              <TextInput
                label={t("transactions.form.amount")}
                placeholder="0.00"
                required
                data-autofocus
                value={field.value}
                onChange={(e) => field.onChange(sanitizeBudgetTypingValue(e.target.value))}
                error={errors.amount?.message}
              />
            )}
          />

          <Controller
            name="fromPaymentMethodId"
            control={control}
            render={({ field }) => (
              <NativeSelect
                label={t("transactions.form.fromPaymentMethod")}
                required
                data={[{ label: t("transactions.form.noPaymentMethod"), value: "" }].concat(
                  activePaymentMethods.map((pm) => ({ label: pm.name, value: pm.id }))
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
                  activePaymentMethods.map((pm) => ({ label: pm.name, value: pm.id }))
                )}
                {...field}
                error={errors.toPaymentMethodId?.message}
              />
            )}
          />

          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <NativeSelect
                label={t("transactions.category")}
                required
                data={transferCategories.map((c) => ({ label: c.name, value: c.id }))}
                {...field}
                error={errors.categoryId?.message}
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

          <Button
            variant="subtle"
            size="xs"
            onClick={() => setShowOptional(!showOptional)}
            fullWidth={false}
          >
            {t("transactions.form.optionalFields")}
          </Button>

          {showOptional ? (
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
                    {...field}
                  />
                )}
              />
            </Stack>
          ) : null}

          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
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
