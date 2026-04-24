"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useForm, useWatch } from "react-hook-form";

import {
  createPaymentMethodFormSchema,
  type PaymentMethodFormInputValues,
  type PaymentMethodFormValues,
} from "@/features/payment-methods/schema";
import {
  PaymentMethodCard,
  type PaymentMethodCardData,
} from "@/features/payment-methods/components/payment-method-card";
import { localeCompareByName, mapPaymentMethodTypeLabel } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { canManagePaymentMethods } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, PaymentMethodType, TransactionType } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type PaymentMethodTransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "payment_method_id" | "amount" | "type"
>;
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "currency_code" | "show_cents"
>;

type StatusFilter = "all" | "active" | "inactive";

const PaymentMethodFormModal = dynamic(() =>
  import("@/features/payment-methods/components/payment-method-form-modal").then(
    (mod) => mod.PaymentMethodFormModal,
  ),
);

function normalizeBalanceByType(type: PaymentMethodType, value: number) {
  if (Math.abs(value) < 0.005) {
    return 0;
  }

  if (type === "credit_card") {
    return -Math.abs(value);
  }

  return value;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toDefaults(row?: PaymentMethodRow): PaymentMethodFormValues {
  if (!row) {
    return {
      name: "",
      type: "cash",
      startingBalance: 0,
      includeInBalance: true,
      closingDay: null,
      dueDay: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
    startingBalance: row.type === "credit_card" ? Math.abs(row.current_balance) : row.current_balance,
    includeInBalance: row.include_in_balance,
    closingDay: row.closing_day,
    dueDay: row.due_day,
  };
}

export default function PaymentMethodsPage() {
  const { supabase, workspace, user } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const canManageStructure = canManagePaymentMethods(workspace.role);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const now = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [movementByMethodId, setMovementByMethodId] = useState<Record<string, number>>({});
  const [movementCountByMethodId, setMovementCountByMethodId] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PaymentMethodRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const roleLabel = t(`common.role.${workspace.role}`, workspace.role);
  const paymentTypeLabels = useMemo<Record<PaymentMethodType, string>>(
    () => ({
      cash: mapPaymentMethodTypeLabel("cash", t),
      debit_card: mapPaymentMethodTypeLabel("debit_card", t),
      credit_card: mapPaymentMethodTypeLabel("credit_card", t),
    }),
    [t],
  );
  const paymentTypeSelectData = useMemo<Array<{ value: PaymentMethodType; label: string }>>(
    () => [
      { value: "cash", label: mapPaymentMethodTypeLabel("cash", t) },
      { value: "debit_card", label: mapPaymentMethodTypeLabel("debit_card", t) },
      { value: "credit_card", label: mapPaymentMethodTypeLabel("credit_card", t) },
    ],
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormInputValues, unknown, PaymentMethodFormValues>({
    resolver: zodResolver(
      createPaymentMethodFormSchema({
        integerNumber: t("common.validation.integerNumber"),
        minDay: t("common.validation.minDay1"),
        maxDay: t("common.validation.maxDay31"),
        invalidBalance: t("common.validation.invalidAmount"),
        requiredName: t("common.validation.requiredName"),
        maxNameLength: t("common.validation.maxName80"),
      }),
    ),
    defaultValues: toDefaults(),
  });

  const selectedType = useWatch({ control, name: "type" });
  const currentPeriodLabel = useMemo(() => {
    return new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" })
      .format(now)
      .replace(/^./, (value) => value.toUpperCase());
  }, [intlLocale, now]);
  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, intlLocale, showCents]);

  const getSignedMovementAmount = useCallback((type: TransactionType, amount: unknown) => {
    const parsedAmount = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      return 0;
    }

    return type === "income" ? parsedAmount : -parsedAmount;
  }, []);

  const loadRows = useCallback(async () => {
    setIsLoading(true);

    const paymentMethodsResponse = await supabase
      .from("payment_methods")
      .select("id, name, type, current_balance, include_in_balance, closing_day, due_day, is_active")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const settingsResponse = await supabase
      .from("workspace_settings")
      .select("currency_code, show_cents")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    const transactionsResponse = await supabase
      .from("transactions")
      .select("payment_method_id, amount, type")
      .eq("workspace_id", workspace.id)
      .not("payment_method_id", "is", null);

    setIsLoading(false);

    if (paymentMethodsResponse.error) {
      notifications.show({
        color: "red",
        title: t("paymentMethods.notifications.loadError"),
        message: paymentMethodsResponse.error.message,
      });
      return;
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: t("paymentMethods.notifications.loadSettingsError"),
        message: settingsResponse.error.message,
      });
      setCurrencyCode("ARS");
      setShowCents(false);
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setCurrencyCode(settings?.currency_code ?? "ARS");
      setShowCents(settings?.show_cents ?? false);
    }

    if (transactionsResponse.error) {
      notifications.show({
        color: "red",
        title: t("paymentMethods.notifications.loadMovementsError"),
        message: transactionsResponse.error.message,
      });
      setMovementByMethodId({});
      setMovementCountByMethodId({});
    } else {
      const movementCounter: Record<string, number> = {};
      const movementCountCounter: Record<string, number> = {};
      const movementRows = (transactionsResponse.data ?? []) as PaymentMethodTransactionLiteRow[];

      for (const row of movementRows) {
        const methodId = row.payment_method_id;
        if (!methodId) {
          continue;
        }

        const signedAmount = getSignedMovementAmount(row.type, row.amount);
        movementCounter[methodId] = roundMoney((movementCounter[methodId] ?? 0) + signedAmount);
        movementCountCounter[methodId] = (movementCountCounter[methodId] ?? 0) + 1;
      }

      setMovementByMethodId(movementCounter);
      setMovementCountByMethodId(movementCountCounter);
    }

    setRows((paymentMethodsResponse.data ?? []) as PaymentMethodRow[]);
  }, [getSignedMovementAmount, supabase, t, workspace.id]);

  const showPermissionDenied = useCallback(() => {
    notifications.show({
      color: "red",
      title: t("paymentMethods.notifications.permissionDeniedTitle"),
      message: t("paymentMethods.notifications.permissionDeniedMessage"),
    });
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  function openCreateModal() {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(null);
    reset(toDefaults());
    setIsModalOpen(true);
  }

  function openEditModal(row: PaymentMethodRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(row);
    reset(toDefaults(row));
    setIsModalOpen(true);
  }

  const computedRows = useMemo<PaymentMethodCardData[]>(() => {
    return rows.map((row) => {
      const movementBalance = roundMoney(movementByMethodId[row.id] ?? 0);
      const movementCount = movementCountByMethodId[row.id] ?? 0;
      const startingBalance = row.current_balance ?? 0;

      return {
        ...row,
        movementCount,
        canDelete: movementCount === 0,
        displayedBalance: roundMoney(startingBalance + movementBalance),
      };
    });
  }, [movementByMethodId, movementCountByMethodId, rows]);

  const visibleRows = useMemo<PaymentMethodCardData[]>(() => {
    return computedRows
      .filter((row) => {
        if (statusFilter === "all") {
          return true;
        }

        return statusFilter === "active" ? row.is_active : !row.is_active;
      })
      .sort((a, b) => {
        if (b.displayedBalance !== a.displayedBalance) {
          return b.displayedBalance - a.displayedBalance;
        }

        return localeCompareByName(a.name, b.name, locale);
      });
  }, [computedRows, locale, statusFilter]);

  const consolidatedBalance = useMemo(() => {
    const total = computedRows
      .filter((row) => row.is_active && row.include_in_balance)
      .reduce((sum, row) => sum + row.displayedBalance, 0);
    return roundMoney(total);
  }, [computedRows]);

  const paymentMethodDrilldownHref = useCallback(
    (paymentMethodId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug: workspace.slug,
        paymentMethodId,
      }),
    [workspace.slug],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const normalizedStartingBalance = normalizeBalanceByType(values.type, values.startingBalance);
    const isCreditCard = values.type === "credit_card";

    const payload = {
      name: values.name.trim(),
      type: values.type,
      current_balance: normalizedStartingBalance,
      include_in_balance: values.includeInBalance,
      closing_day: isCreditCard ? values.closingDay : null,
      due_day: isCreditCard ? values.dueDay : null,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("payment_methods")
        .update(payload)
        .eq("id", editingRow.id)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: t("paymentMethods.notifications.saveError"),
          message: updateResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("paymentMethods.notifications.updatedTitle"),
        message: t("paymentMethods.notifications.updatedMessage"),
      });
    } else {
      const insertResponse = await supabase.from("payment_methods").insert({
        workspace_id: workspace.id,
        name: payload.name,
        type: payload.type,
        current_balance: payload.current_balance,
        include_in_balance: payload.include_in_balance,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        is_active: true,
        created_by: user.id,
      });

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: t("paymentMethods.notifications.createError"),
          message: insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("paymentMethods.notifications.createdTitle"),
        message: t("paymentMethods.notifications.createdMessage"),
      });
    }

    setIsModalOpen(false);
    setEditingRow(null);
    reset(toDefaults());
    await loadRows();
  });

  async function toggleActive(row: PaymentMethodRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const response = await supabase
      .from("payment_methods")
      .update({
        is_active: !row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("workspace_id", workspace.id);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("paymentMethods.notifications.toggleError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: row.is_active
        ? t("paymentMethods.notifications.deactivatedTitle")
        : t("paymentMethods.notifications.activatedTitle"),
      message: t("paymentMethods.notifications.statusUpdatedMessage"),
    });

    await loadRows();
  }

  async function deletePaymentMethod(row: PaymentMethodCardData) {
    const response = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", row.id)
      .eq("workspace_id", workspace.id);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("paymentMethods.notifications.deleteError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: t("paymentMethods.notifications.deletedTitle"),
      message: t("paymentMethods.notifications.deletedMessage"),
    });

    await loadRows();
  }

  function confirmDelete(row: PaymentMethodCardData) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    if (!row.canDelete) {
      notifications.show({
        color: "yellow",
        title: t("paymentMethods.notifications.deleteBlockedTitle"),
        message: t("paymentMethods.notifications.deleteBlockedMessage", undefined, {
          count: row.movementCount,
        }),
      });
      return;
    }

    modals.openConfirmModal({
      title: t("paymentMethods.confirmDeleteTitle"),
      centered: true,
      labels: {
        confirm: t("paymentMethods.delete"),
        cancel: t("common.actions.cancel"),
      },
      confirmProps: {
        color: "red",
      },
      children: t("paymentMethods.confirmDeleteBody", undefined, {
        name: row.name,
      }),
      onConfirm: () => {
        void deletePaymentMethod(row);
      },
    });
  }

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2} component="h1">{t("paymentMethods.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("paymentMethods.subtitle")}
          </Text>
        </Stack>

        <Button onClick={openCreateModal} disabled={!canManageStructure} fullWidth={isMobile}>
          {t("paymentMethods.new")}
        </Button>
      </Group>

      {!canManageStructure ? (
        <Alert color="yellow" variant="light" title={t("paymentMethods.readOnlyTitle")}>
          {t("paymentMethods.readOnlyMessage", undefined, { role: roleLabel })}
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="md">
        <NativeSelect
          w={isMobile ? "100%" : 220}
          label={t("paymentMethods.filters.status")}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
          data={[
            { value: "all", label: t("paymentMethods.filters.all") },
            { value: "active", label: t("paymentMethods.filters.active") },
            { value: "inactive", label: t("paymentMethods.filters.inactive") },
          ]}
        />
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="#475467">
            {t("paymentMethods.totalBalanceTitle", undefined, { period: currentPeriodLabel })}
          </Text>
          <Text
            fw={900}
            size="2rem"
            lh={1}
            c={consolidatedBalance > 0 ? "#087f5b" : consolidatedBalance < 0 ? "#c92a2a" : "#475467"}
          >
            {currencyFormatter.format(consolidatedBalance)}
          </Text>
          <Text size="xs" c="dimmed">
            {t("paymentMethods.totalBalanceDescription")}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="md">
        {visibleRows.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("paymentMethods.emptyState")}
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="sm">
            {visibleRows.map((row) => (
              <PaymentMethodCard
                key={row.id}
                row={row}
                canManageStructure={canManageStructure}
                paymentTypeLabels={paymentTypeLabels}
                currencyFormatter={currencyFormatter}
                paymentMethodDrilldownHref={paymentMethodDrilldownHref}
                onEdit={openEditModal}
                onToggleActive={toggleActive}
                onDelete={confirmDelete}
                t={t}
              />
            ))}
          </SimpleGrid>
        )}
      </Paper>

      {isModalOpen ? (
        <PaymentMethodFormModal
          opened={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isEditing={editingRow !== null}
          isMobile={isMobile}
          canManageStructure={canManageStructure}
          isSubmitting={isSubmitting}
          selectedType={selectedType}
          paymentTypeSelectData={paymentTypeSelectData}
          register={register}
          errors={errors}
          onSubmit={onSubmit}
          t={t}
        />
      ) : null}
    </Stack>
  );
}
