"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useForm, useWatch } from "react-hook-form";

import {
  createPaymentMethodFormSchema,
  type PaymentMethodFormInputValues,
  type PaymentMethodFormValues,
} from "@/features/payment-methods/schema";
import { localeCompareByName, mapPaymentMethodTypeLabel } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { canManagePaymentMethods } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, PaymentMethodType, TransactionType } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type PaymentMethodTransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "payment_method_id" | "amount" | "type" | "transaction_date" | "effective_date"
>;
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "currency_code" | "show_cents"
>;
type PaymentMethodCardRow = PaymentMethodRow & {
  displayedBalance: number;
};

type StatusFilter = "all" | "active" | "inactive";

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

function buildMonthRange(year: number, month: number) {
  const monthStart = String(month).padStart(2, "0");
  const start = `${year}-${monthStart}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = String(nextMonth).padStart(2, "0");
  const end = `${nextYear}-${nextMonthStart}-01`;
  return { start, end };
}

function DotsIcon({ size = 14 }: { size?: number }) {
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
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function toDefaults(row?: PaymentMethodRow): PaymentMethodFormValues {
  if (!row) {
    return {
      name: "",
      type: "cash",
      currentBalance: 0,
      includeInBalance: true,
      closingDay: null,
      dueDay: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
    currentBalance: row.type === "credit_card" ? Math.abs(row.current_balance) : row.current_balance,
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
      bank_transfer: mapPaymentMethodTypeLabel("bank_transfer", t),
      other: mapPaymentMethodTypeLabel("other", t),
    }),
    [t],
  );
  const paymentTypeSelectData = useMemo(
    () => [
      { value: "cash", label: mapPaymentMethodTypeLabel("cash", t) },
      { value: "debit_card", label: mapPaymentMethodTypeLabel("debit_card", t) },
      { value: "credit_card", label: mapPaymentMethodTypeLabel("credit_card", t) },
      { value: "bank_transfer", label: mapPaymentMethodTypeLabel("bank_transfer", t) },
      { value: "other", label: mapPaymentMethodTypeLabel("other", t) },
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
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
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
    const { start, end } = buildMonthRange(currentYear, currentMonth);
    const periodFilter = [
      `and(effective_date.gte.${start},effective_date.lt.${end})`,
      `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
    ].join(",");
    const [paymentMethodsResponse, settingsResponse, transactionsResponse] = await Promise.all([
      supabase
        .from("payment_methods")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("currency_code, show_cents")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("payment_method_id, amount, type, transaction_date, effective_date")
        .eq("workspace_id", workspace.id)
        .not("payment_method_id", "is", null)
        .or(periodFilter),
    ]);

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
    } else {
      const movementCounter: Record<string, number> = {};
      const movementRows = (transactionsResponse.data ?? []) as PaymentMethodTransactionLiteRow[];

      for (const row of movementRows) {
        const methodId = row.payment_method_id;
        if (!methodId) {
          continue;
        }

        const signedAmount = getSignedMovementAmount(row.type, row.amount);
        movementCounter[methodId] = roundMoney((movementCounter[methodId] ?? 0) + signedAmount);
      }

      setMovementByMethodId(movementCounter);
    }

    setRows(paymentMethodsResponse.data);
  }, [currentMonth, currentYear, getSignedMovementAmount, supabase, t, workspace.id]);

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

  const computedRows = useMemo<PaymentMethodCardRow[]>(() => {
    return rows.map((row) => {
      const movementBalance = roundMoney(movementByMethodId[row.id] ?? 0);

      return {
        ...row,
        displayedBalance: movementBalance,
      };
    });
  }, [movementByMethodId, rows]);

  const visibleRows = useMemo<PaymentMethodCardRow[]>(() => {
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
        year: currentYear,
        month: currentMonth,
        paymentMethodId,
      }),
    [currentMonth, currentYear, workspace.slug],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const normalizedCurrentBalance = normalizeBalanceByType(values.type, values.currentBalance);
    const isCreditCard = values.type === "credit_card";

    const payload = {
      name: values.name.trim(),
      type: values.type,
      current_balance: normalizedCurrentBalance,
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
        color: "green",
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
        color: "green",
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
      color: "green",
      title: row.is_active
        ? t("paymentMethods.notifications.deactivatedTitle")
        : t("paymentMethods.notifications.activatedTitle"),
      message: t("paymentMethods.notifications.statusUpdatedMessage"),
    });

    await loadRows();
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
            c={
              consolidatedBalance > 0
                ? "#087f5b"
                : consolidatedBalance < 0
                  ? "#c92a2a"
                  : "#475467"
            }
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
              <Paper key={row.id} withBorder radius="md" p="md" bg="#ffffff">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                    <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                      <Text fw={700} size="lg" lineClamp={1} style={{ lineHeight: 1.2 }}>
                        {row.name}
                      </Text>
                      <Group gap={6} wrap="wrap">
                        <Badge variant="light">{paymentTypeLabels[row.type]}</Badge>
                        <Badge color={row.is_active ? "teal" : "gray"} variant="outline">
                          {row.is_active
                            ? t("paymentMethods.status.active")
                            : t("paymentMethods.status.inactive")}
                        </Badge>
                      </Group>
                    </Stack>

                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={t("paymentMethods.actionsFor", undefined, { name: row.name })}
                        >
                          <DotsIcon />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Item disabled={!canManageStructure} onClick={() => openEditModal(row)}>
                          {t("paymentMethods.edit")}
                        </Menu.Item>
                        <Menu.Item
                          color={row.is_active ? "gray" : "teal"}
                          disabled={!canManageStructure}
                          onClick={() => void toggleActive(row)}
                        >
                          {row.is_active ? t("paymentMethods.deactivate") : t("paymentMethods.activate")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>

                  <Text
                    fw={900}
                    size="2rem"
                    lh={1}
                    c={
                      row.displayedBalance > 0
                        ? "#087f5b"
                        : row.displayedBalance < 0
                          ? "#c92a2a"
                          : "#475467"
                    }
                  >
                    {currencyFormatter.format(row.displayedBalance)}
                  </Text>

                  <Group justify="space-between" wrap="wrap" gap={6}>
                    <Badge variant={row.include_in_balance ? "light" : "outline"} color="blue">
                      {row.include_in_balance
                        ? t("paymentMethods.includedInBalance")
                        : t("paymentMethods.excludedFromBalance")}
                    </Badge>
                    {row.type === "credit_card" ? (
                      <Text size="xs" c="dimmed">
                        {t("paymentMethods.creditCardDays", undefined, {
                          closingDay: row.closing_day ?? "-",
                          dueDay: row.due_day ?? "-",
                        })}
                      </Text>
                    ) : null}
                  </Group>

                  <Button
                    component={Link}
                    href={paymentMethodDrilldownHref(row.id)}
                    variant="subtle"
                    color="gray"
                    size="compact-xs"
                    px={0}
                    justify="flex-start"
                  >
                    {t("paymentMethods.viewMovements")}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        )}
      </Paper>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRow ? t("paymentMethods.edit") : t("paymentMethods.new")}
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
                  : t("paymentMethods.form.currentBalance")
              }
              type="number"
              step="0.01"
              placeholder={
                selectedType === "credit_card"
                  ? t("paymentMethods.form.currentDebtPlaceholder")
                  : t("paymentMethods.form.currentBalancePlaceholder")
              }
              disabled={!canManageStructure}
              error={errors.currentBalance?.message}
              {...register("currentBalance")}
            />

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
              <Button
                type="button"
                variant="light"
                color="gray"
                onClick={() => setIsModalOpen(false)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!canManageStructure}>
                {editingRow ? t("common.actions.save") : t("common.actions.create")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
