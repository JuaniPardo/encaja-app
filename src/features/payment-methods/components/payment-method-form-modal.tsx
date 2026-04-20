"use client";

import { Button, Checkbox, Group, Modal, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { BaseSyntheticEvent } from "react";

import type { PaymentMethodFormInputValues } from "@/features/payment-methods/schema";
import type { PaymentMethodType } from "@/types/database";

type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

type PaymentMethodFormModalProps = {
  opened: boolean;
  onClose: () => void;
  isEditing: boolean;
  isMobile: boolean;
  canManageStructure: boolean;
  isSubmitting: boolean;
  selectedType: PaymentMethodType | undefined;
  paymentTypeSelectData: Array<{ value: PaymentMethodType; label: string }>;
  register: UseFormRegister<PaymentMethodFormInputValues>;
  errors: FieldErrors<PaymentMethodFormInputValues>;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  t: TranslationFn;
};

export function PaymentMethodFormModal({
  opened,
  onClose,
  isEditing,
  isMobile,
  canManageStructure,
  isSubmitting,
  selectedType,
  paymentTypeSelectData,
  register,
  errors,
  onSubmit,
  t,
}: PaymentMethodFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? t("paymentMethods.edit") : t("paymentMethods.new")}
      fullScreen={isMobile}
    >
      <form onSubmit={onSubmit}>
        <Stack>
          <TextInput
            label={t("paymentMethods.form.name")}
            placeholder={t("paymentMethods.form.namePlaceholder")}
            disabled={!canManageStructure}
            error={errors.name?.message}
            {...register("name")}
          />

          <NativeSelect
            label={t("paymentMethods.form.type")}
            data={paymentTypeSelectData}
            disabled={!canManageStructure}
            error={errors.type?.message}
            {...register("type")}
          />

          <TextInput
            label={
              selectedType === "credit_card"
                ? t("paymentMethods.form.currentDebt")
                : t("paymentMethods.form.startingBalance")
            }
            type="number"
            step="0.01"
            placeholder={
              selectedType === "credit_card"
                ? t("paymentMethods.form.currentDebtPlaceholder")
                : t("paymentMethods.form.startingBalancePlaceholder")
            }
            disabled={!canManageStructure}
            error={errors.startingBalance?.message}
            {...register("startingBalance")}
          />

          <Text size="xs" c="dimmed">
            {t("paymentMethods.form.initialBalanceHint")}
          </Text>

          {selectedType === "credit_card" ? (
            <Text size="xs" c="dimmed">
              {t("paymentMethods.form.creditCardHint")}
            </Text>
          ) : null}

          <Checkbox
            label={t("paymentMethods.form.includeInBalance")}
            description={t("paymentMethods.form.includeInBalanceDescription")}
            disabled={!canManageStructure}
            {...register("includeInBalance")}
          />

          <TextInput
            label={t("paymentMethods.form.closingDay")}
            type="number"
            placeholder={t("paymentMethods.form.closingDayPlaceholder")}
            disabled={!canManageStructure || selectedType !== "credit_card"}
            error={errors.closingDay?.message}
            {...register("closingDay")}
          />

          <TextInput
            label={t("paymentMethods.form.dueDay")}
            type="number"
            placeholder={t("paymentMethods.form.dueDayPlaceholder")}
            disabled={!canManageStructure || selectedType !== "credit_card"}
            error={errors.dueDay?.message}
            {...register("dueDay")}
          />

          <Group justify="flex-end" mt="sm">
            <Button type="button" variant="light" color="gray" onClick={onClose}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!canManageStructure}>
              {isEditing ? t("common.actions.save") : t("common.actions.create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
