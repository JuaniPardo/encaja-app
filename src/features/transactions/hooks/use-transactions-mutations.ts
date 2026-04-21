"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";

import { formatBudgetAmount } from "@/features/budget/amount-format";
import { localeCompareByName } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import {
  toFormDefaults,
  type CategoryRow,
  type PaymentMethodRow,
  type QuickPaymentMethodType,
  type TransactionRow,
  type TypeFilter,
} from "@/features/transactions/utils";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { TransactionFormInputValues, TransactionFormValues } from "@/features/transactions/schema";
import type { Database, TransactionType } from "@/types/database";
import type { Dispatch, SetStateAction } from "react";

type InstallmentPurchaseRow = Database["public"]["Tables"]["installment_purchases"]["Row"];

type UseTransactionsMutationsOptions = {
  categoryById: Map<string, CategoryRow>;
  paymentMethodById: Map<string, PaymentMethodRow>;
  hasAnyPaymentMethods: boolean;
  typeFilter: TypeFilter;
  categoryFilter: string;
  paymentMethodFilter: string;
  loadTransactions: () => Promise<void>;
  setPaymentMethods: Dispatch<SetStateAction<PaymentMethodRow[]>>;
  isBootstrapping: boolean;
  createModalTypeFromQuery: TransactionType | null;
  setCreateModalTypeFromQuery: Dispatch<SetStateAction<TransactionType | null>>;
  openTransferModalFromQuery: boolean;
  setOpenTransferModalFromQuery: Dispatch<SetStateAction<boolean>>;
};

export function useTransactionsMutations({
  categoryById,
  paymentMethodById,
  hasAnyPaymentMethods,
  typeFilter,
  categoryFilter,
  paymentMethodFilter,
  loadTransactions,
  setPaymentMethods,
  isBootstrapping,
  createModalTypeFromQuery,
  setCreateModalTypeFromQuery,
  openTransferModalFromQuery,
  setOpenTransferModalFromQuery,
}: UseTransactionsMutationsOptions) {
  const { supabase, workspace, user } = useWorkspace();
  const { locale, t } = useI18n();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickPaymentMethodType, setQuickPaymentMethodType] =
    useState<QuickPaymentMethodType>("cash");
  const [formInitialValues, setFormInitialValues] = useState<TransactionFormInputValues>(
    toFormDefaults(),
  );

  function toInstallmentPurchaseDefaults(
    installmentPurchase: InstallmentPurchaseRow,
  ): TransactionFormInputValues {
    return {
      type: "expense",
      categoryId: installmentPurchase.category_id,
      amount: formatBudgetAmount(installmentPurchase.total_amount),
      transactionDate: installmentPurchase.purchase_date,
      effectiveDate: installmentPurchase.effective_date ?? "",
      paymentMethodId: installmentPurchase.payment_method_id,
      installmentsCount: installmentPurchase.installments_count,
      description: installmentPurchase.description ?? "",
      notes: installmentPurchase.notes ?? "",
    };
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    setQuickPaymentMethodType("cash");
  }

  const openCreateModal = useCallback(
    (preferredType?: TransactionType) => {
      const defaultType = preferredType ?? (typeFilter === "all" ? "expense" : typeFilter);
      const filteredCategory = categoryFilter !== "all" ? categoryById.get(categoryFilter) : null;
      const filteredPaymentMethod =
        paymentMethodFilter !== "all" ? paymentMethodById.get(paymentMethodFilter) : null;

      const resolvedType = filteredCategory?.is_active ? filteredCategory.type : defaultType;
      const defaults = toFormDefaults(undefined, resolvedType);

      if (filteredCategory?.is_active && filteredCategory.type === resolvedType) {
        defaults.categoryId = filteredCategory.id;
      }

      if (filteredPaymentMethod?.is_active) {
        defaults.paymentMethodId = filteredPaymentMethod.id;
      }

      if (!hasAnyPaymentMethods) {
        setQuickPaymentMethodType("cash");
      }

      setEditingRow(null);
      setFormInitialValues(defaults);
      setIsModalOpen(true);
    },
    [
      categoryById,
      categoryFilter,
      hasAnyPaymentMethods,
      paymentMethodById,
      paymentMethodFilter,
      typeFilter,
    ],
  );

  async function openEditModal(row: TransactionRow) {
    if (!row.installment_purchase_id) {
      setEditingRow(row);
      setFormInitialValues(toFormDefaults(row));
      setQuickPaymentMethodType("cash");
      setIsModalOpen(true);
      return;
    }

    const installmentPurchaseResponse = await supabase
      .from("installment_purchases")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("id", row.installment_purchase_id)
      .single();

    if (installmentPurchaseResponse.error) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.installmentLoadEditError"),
        message: installmentPurchaseResponse.error.message,
      });
      return;
    }

    setEditingRow(row);
    setFormInitialValues(toInstallmentPurchaseDefaults(installmentPurchaseResponse.data));
    setQuickPaymentMethodType("cash");
    setIsModalOpen(true);
  }

  useEffect(() => {
    if (createModalTypeFromQuery === null || isBootstrapping || isModalOpen) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreateModal(createModalTypeFromQuery);
    setCreateModalTypeFromQuery(null);

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("new");
    params.delete("prefillType");

    const query = params.toString();
    const nextUrl = query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    createModalTypeFromQuery,
    isBootstrapping,
    isModalOpen,
    openCreateModal,
    setCreateModalTypeFromQuery,
  ]);

  useEffect(() => {
    if (!openTransferModalFromQuery || isBootstrapping || isTransferModalOpen) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTransferModalOpen(true);
    setOpenTransferModalFromQuery(false);

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("newTransfer");

    const query = params.toString();
    const nextUrl = query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [isBootstrapping, isTransferModalOpen, openTransferModalFromQuery, setOpenTransferModalFromQuery]);

  const onSubmit = async (values: TransactionFormValues) => {
    const category = categoryById.get(values.categoryId);
    if (!category || category.workspace_id !== workspace.id) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.invalidCategoryTitle"),
        message: t("transactions.notifications.invalidCategoryMessage"),
      });
      return;
    }

    if (category.type !== values.type) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.incompatibleTypeTitle"),
        message: t("transactions.notifications.incompatibleTypeMessage"),
      });
      return;
    }

    if (!category.is_active && (!editingRow || editingRow.category_id !== category.id)) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.inactiveCategoryTitle"),
        message: t("transactions.notifications.inactiveCategoryMessage"),
      });
      return;
    }

    let resolvedPaymentMethodId = values.paymentMethodId;
    let quickCreatedPaymentMethod: PaymentMethodRow | null = null;

    const shouldAutoCreateQuickPaymentMethod =
      !editingRow && !hasAnyPaymentMethods && resolvedPaymentMethodId === null;

    if (shouldAutoCreateQuickPaymentMethod) {
      const quickMethodName = t(`transactions.quickPayment.defaultNames.${quickPaymentMethodType}`);
      const createQuickMethodResponse = await supabase
        .from("payment_methods")
        .insert({
          workspace_id: workspace.id,
          name: quickMethodName,
          type: quickPaymentMethodType,
          current_balance: 0,
          include_in_balance: true,
          is_active: true,
          created_by: user.id,
        })
        .select("*")
        .single();

      if (createQuickMethodResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.quickPaymentCreateError"),
          message: createQuickMethodResponse.error.message,
        });
        return;
      }

      const createdQuickMethod = createQuickMethodResponse.data;
      if (!createdQuickMethod) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.quickPaymentCreateError"),
          message: t("transactions.notifications.unexpectedQuickPaymentCreateError"),
        });
        return;
      }

      quickCreatedPaymentMethod = createdQuickMethod;
      resolvedPaymentMethodId = createdQuickMethod.id;
      setPaymentMethods((previousRows) => [...previousRows, createdQuickMethod]);
    }

    const paymentMethod = resolvedPaymentMethodId
      ? quickCreatedPaymentMethod?.id === resolvedPaymentMethodId
        ? quickCreatedPaymentMethod
        : paymentMethodById.get(resolvedPaymentMethodId)
      : null;

    if (resolvedPaymentMethodId && (!paymentMethod || paymentMethod.workspace_id !== workspace.id)) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.invalidPaymentMethodTitle"),
        message: t("transactions.notifications.invalidPaymentMethodMessage"),
      });
      return;
    }

    if (
      paymentMethod &&
      !paymentMethod.is_active &&
      (!editingRow || editingRow.payment_method_id !== paymentMethod.id)
    ) {
      notifications.show({
        color: "red",
        title: t("transactions.notifications.inactivePaymentMethodTitle"),
        message: t("transactions.notifications.inactivePaymentMethodMessage"),
      });
      return;
    }

    const installmentsCount = values.installmentsCount;
    const isEditingInstallmentPurchase = Boolean(editingRow?.installment_purchase_id);

    if (isEditingInstallmentPurchase) {
      const installmentPurchaseId = editingRow?.installment_purchase_id;
      if (!installmentPurchaseId) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.installmentUpdateError"),
          message: t("transactions.notifications.installmentUpdateError"),
        });
        return;
      }

      if (installmentsCount < 2) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentTypeTitle"),
          message: t("transactions.notifications.installmentsRequireAtLeastTwo"),
        });
        return;
      }

      if (values.type !== "expense") {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentTypeTitle"),
          message: t("transactions.notifications.invalidInstallmentTypeMessage"),
        });
        return;
      }

      if (!paymentMethod) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentPaymentMethodTitle"),
          message: t("transactions.notifications.invalidInstallmentPaymentMethodMessage"),
        });
        return;
      }

      if (paymentMethod.type !== "credit_card") {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentPaymentMethodTitle"),
          message: t("transactions.notifications.installmentsRequireCreditCard"),
        });
        return;
      }

      const updateInstallmentResponse = await supabase.rpc(
        "update_installment_purchase_transaction",
        {
          p_installment_purchase_id: installmentPurchaseId,
          p_workspace_id: workspace.id,
          p_payment_method_id: paymentMethod.id,
          p_category_id: category.id,
          p_amount: Math.round(values.amount * 100) / 100,
          p_installments_count: installmentsCount,
          p_transaction_date: values.transactionDate,
          p_effective_date: values.effectiveDate,
          p_description: values.description,
          p_notes: values.notes,
        },
      );

      if (updateInstallmentResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.installmentUpdateError"),
          message: updateInstallmentResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.installmentUpdatedTitle"),
        message: t("transactions.notifications.installmentUpdatedMessage"),
      });

      closeModal();
      setFormInitialValues(toFormDefaults(undefined, values.type));
      await loadTransactions();
      return;
    }

    if (installmentsCount > 1) {
      if (editingRow) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.installmentCreateFromEditBlockedTitle"),
          message: t("transactions.notifications.installmentCreateFromEditBlockedMessage"),
        });
        return;
      }

      if (values.type !== "expense") {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentTypeTitle"),
          message: t("transactions.notifications.invalidInstallmentTypeMessage"),
        });
        return;
      }

      if (!paymentMethod) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentPaymentMethodTitle"),
          message: t("transactions.notifications.invalidInstallmentPaymentMethodMessage"),
        });
        return;
      }

      if (paymentMethod.type !== "credit_card") {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.invalidInstallmentPaymentMethodTitle"),
          message: t("transactions.notifications.installmentsRequireCreditCard"),
        });
        return;
      }

      const createInstallmentResponse = await supabase.rpc(
        "create_installment_purchase_transaction",
        {
          p_workspace_id: workspace.id,
          p_payment_method_id: paymentMethod.id,
          p_category_id: category.id,
          p_amount: Math.round(values.amount * 100) / 100,
          p_installments_count: installmentsCount,
          p_transaction_date: values.transactionDate,
          p_effective_date: values.effectiveDate,
          p_description: values.description,
          p_notes: values.notes,
        },
      );

      if (createInstallmentResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.installmentRegisterError"),
          message: createInstallmentResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.installmentCreatedTitle"),
        message: t("transactions.notifications.installmentCreatedMessage"),
      });

      closeModal();
      setFormInitialValues(toFormDefaults(undefined, values.type));
      await loadTransactions();
      return;
    }

    const payload = {
      type: values.type,
      category_id: values.categoryId,
      amount: Math.round(values.amount * 100) / 100,
      transaction_date: values.transactionDate,
      effective_date: values.effectiveDate,
      payment_method_id: resolvedPaymentMethodId,
      description: values.description,
      notes: values.notes,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", editingRow.id)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.saveChangesError"),
          message: updateResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.updatedTitle"),
        message: t("transactions.notifications.updatedMessage"),
      });
    } else {
      const insertResponse = await supabase.from("transactions").insert({
        workspace_id: workspace.id,
        type: payload.type,
        category_id: payload.category_id,
        amount: payload.amount,
        transaction_date: payload.transaction_date,
        effective_date: payload.effective_date,
        payment_method_id: payload.payment_method_id,
        description: payload.description,
        notes: payload.notes,
        is_recurring: false,
        created_by: user.id,
      });

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: t("transactions.notifications.registerError"),
          message: insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("transactions.notifications.createdTitle"),
        message: t("transactions.notifications.createdMessage"),
      });
    }

    closeModal();
    setFormInitialValues(toFormDefaults(undefined, values.type));
    await loadTransactions();
  };

  const shouldShowQuickPaymentSetup = !editingRow && !hasAnyPaymentMethods;

  async function deleteTransaction(row: TransactionRow) {
    setDeletingId(row.id);

    let response;

    if (row.installment_purchase_id) {
      response = await supabase
        .from("installment_purchases")
        .delete()
        .eq("id", row.installment_purchase_id)
        .eq("workspace_id", workspace.id);
    } else {
      let query = supabase.from("transactions").delete().eq("workspace_id", workspace.id);

      if (row.type === "transfer" && row.transfer_group_id) {
        query = query.eq("transfer_group_id", row.transfer_group_id);
      } else {
        query = query.eq("id", row.id);
      }

      response = await query;
    }

    setDeletingId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title:
          row.installment_purchase_id
            ? t("transactions.notifications.installmentDeleteError")
            : row.type === "transfer"
              ? t("transactions.notifications.transferDeleteError")
              : t("transactions.notifications.deleteError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title:
        row.installment_purchase_id
          ? t("transactions.notifications.installmentDeletedTitle")
          : row.type === "transfer"
            ? t("transactions.notifications.transferDeletedTitle")
            : t("transactions.notifications.deletedTitle"),
      message:
        row.installment_purchase_id
          ? t("transactions.notifications.installmentDeletedMessage")
          : row.type === "transfer"
            ? t("transactions.notifications.transferDeletedMessage")
            : t("transactions.notifications.deletedMessage"),
    });

    await loadTransactions();
  }

  function confirmDelete(row: TransactionRow) {
    const confirmBody = row.installment_purchase_id
      ? t("transactions.confirmDeleteInstallmentBody")
      : t("transactions.confirmDeleteBody");

    modals.openConfirmModal({
      title: t("transactions.delete"),
      centered: true,
      labels: {
        confirm: t("transactions.delete"),
        cancel: t("common.actions.cancel"),
      },
      confirmProps: {
        color: "red",
      },
      children: confirmBody,
      onConfirm: () => {
        void deleteTransaction(row);
      },
    });
  }

  const paymentMethodOptions = useMemo(() => {
    const currentPaymentMethodId = editingRow?.payment_method_id ?? null;

    return Array.from(paymentMethodById.values())
      .filter(
        (paymentMethod) =>
          paymentMethod.is_active || paymentMethod.id === currentPaymentMethodId,
      )
      .sort((a, b) => localeCompareByName(a.name, b.name, locale))
      .map((paymentMethod) => ({
        value: paymentMethod.id,
        label: paymentMethod.is_active
          ? paymentMethod.name
          : `${paymentMethod.name} (${t("transactions.inactivePaymentMethodSuffix")})`,
      }));
  }, [editingRow?.payment_method_id, locale, paymentMethodById, t]);

  return {
    isModalOpen,
    isTransferModalOpen,
    setIsTransferModalOpen,
    editingRow,
    deletingId,
    quickPaymentMethodType,
    setQuickPaymentMethodType,
    formInitialValues,
    closeModal,
    openCreateModal,
    openEditModal,
    onSubmit,
    confirmDelete,
    shouldShowQuickPaymentSetup,
    paymentMethodOptions,
  };
}
