"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import { useForm } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";
import {
  createSettingsFormSchema,
  type SettingsFormInputValues,
  type SettingsFormValues,
} from "@/features/settings/schema";
import {
  createWorkspaceFormSchema,
  type WorkspaceFormInputValues,
  type WorkspaceFormValues,
} from "@/features/workspace/schema";
import { canManageWorkspaceSettings } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";

import { DEFAULT_CURRENCY_CODE, WORKSPACE_CURRENCY_CODES } from "../types";

type UseSettingsGeneralOptions = {
  onWorkspaceCurrenciesRefresh?: () => Promise<void>;
};

export function useSettingsGeneral(options?: UseSettingsGeneralOptions) {
  const { t } = useI18n();
  const {
    supabase,
    workspace,
    refreshWorkspace,
    createWorkspace,
    switchWorkspace,
    canUseWorkspaceFeature,
  } = useWorkspace();
  const canEditWorkspaceSettings = canManageWorkspaceSettings(workspace.role);
  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");
  const canCreateWorkspace = canUseMultiWorkspace && canEditWorkspaceSettings;

  const [isLoading, setIsLoading] = useState(true);
  const [workspaceCurrencyCode, setWorkspaceCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isCreateWorkspaceOpen, { open: openCreateWorkspace, close: closeCreateWorkspace }] =
    useDisclosure(false);

  const savingsRateModeSelectData = useMemo(
    () => [
      { value: "manual", label: t("workspaceSettings.savingsRateMode.manual") },
      { value: "percentage", label: t("workspaceSettings.savingsRateMode.percentage") },
    ],
    [t],
  );

  const workspaceCurrencyOptions = useMemo(() => {
    const options = WORKSPACE_CURRENCY_CODES.map((currencyCode) => ({
      value: currencyCode,
      label: t(`workspaceSettings.currencyOptions.${currencyCode.toLowerCase()}`, currencyCode),
    }));
    const normalizedCurrentCurrency = workspaceCurrencyCode.trim().toUpperCase();

    if (
      normalizedCurrentCurrency.length === 3 &&
      !options.some((option) => option.value === normalizedCurrentCurrency)
    ) {
      return [
        {
          value: normalizedCurrentCurrency,
          label: t("workspaceSettings.currencyOptions.custom", normalizedCurrentCurrency, {
            code: normalizedCurrentCurrency,
          }),
        },
        ...options,
      ];
    }

    return options;
  }, [t, workspaceCurrencyCode]);

  const settingsSchema = useMemo(
    () =>
      createSettingsFormSchema({
        integerNumber: t("common.validation.integerNumber"),
        minDay: t("common.validation.minDay1"),
        maxDay: t("common.validation.maxDay31"),
        startYearInteger: t("common.forms.settings.startYearInteger"),
        startYearMin: t("common.forms.settings.startYearMin"),
        startYearMax: t("common.forms.settings.startYearMax"),
        currencyLength: t("common.forms.settings.currencyLength"),
        requiredDeferredIncomeDay: t("common.forms.settings.requiredDeferredIncomeDay"),
      }),
    [t],
  );

  const workspaceSchema = useMemo(
    () =>
      createWorkspaceFormSchema({
        minNameLength: t("common.forms.workspace.minNameLength"),
        maxNameLength: t("common.forms.workspace.maxNameLength"),
      }),
    [t],
  );

  const {
    register,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormInputValues, unknown, SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      startYear: new Date().getFullYear(),
      savingsRateMode: "manual",
      deferredIncomeEnabled: false,
      deferredIncomeDay: null,
      showCents: false,
      currencyCode: DEFAULT_CURRENCY_CODE,
    },
  });
  const [showCentsValue, setShowCentsValue] = useState(false);

  const {
    register: registerWorkspace,
    handleSubmit: handleSubmitWorkspace,
    reset: resetWorkspace,
    formState: {
      errors: workspaceErrors,
      isSubmitting: isWorkspaceSubmitting,
    },
  } = useForm<WorkspaceFormInputValues, unknown, WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: workspace.name,
    },
  });

  const {
    register: registerCreateWorkspace,
    handleSubmit: handleSubmitCreateWorkspace,
    reset: resetCreateWorkspace,
    formState: {
      errors: createWorkspaceErrors,
      isSubmitting: isCreatingWorkspace,
    },
  } = useForm<WorkspaceFormInputValues, unknown, WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    resetWorkspace({
      name: workspace.name,
    });
  }, [resetWorkspace, workspace.name]);

  useEffect(() => {
    if (!isCreateWorkspaceOpen) {
      resetCreateWorkspace({
        name: "",
      });
    }
  }, [isCreateWorkspaceOpen, resetCreateWorkspace]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);

    const response = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    setIsLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.loadSettingsError"),
        message: response.error.message,
      });
      return;
    }

    if (!response.data) {
      setSettingsId(null);
      setWorkspaceCurrencyCode(DEFAULT_CURRENCY_CODE);
      setShowCentsValue(false);
      reset({
        startYear: new Date().getFullYear(),
        savingsRateMode: "manual",
        deferredIncomeEnabled: false,
        deferredIncomeDay: null,
        showCents: false,
        currencyCode: DEFAULT_CURRENCY_CODE,
      });
      return;
    }

    setSettingsId(response.data.id);
    setWorkspaceCurrencyCode(response.data.currency_code);
    setShowCentsValue(response.data.show_cents ?? false);
    reset({
      startYear: response.data.start_year,
      savingsRateMode: response.data.savings_rate_mode,
      deferredIncomeEnabled: response.data.deferred_income_enabled,
      deferredIncomeDay: response.data.deferred_income_day,
      showCents: response.data.show_cents ?? false,
      currencyCode: response.data.currency_code,
    });
  }, [reset, supabase, t, workspace.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadSettings]);

  const onSubmitSettings = handleSubmit(async (values) => {
    if (!canEditWorkspaceSettings) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.editSettingsPermissionDenied"),
      });
      return;
    }

    const payload = {
      start_year: values.startYear,
      savings_rate_mode: values.savingsRateMode,
      deferred_income_enabled: values.deferredIncomeEnabled,
      deferred_income_day: values.deferredIncomeEnabled ? values.deferredIncomeDay : null,
      show_cents: values.showCents,
      currency_code: values.currencyCode.toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      const updateResponse = await supabase
        .from("workspace_settings")
        .update(payload)
        .eq("id", settingsId)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: t("workspaceSettings.notifications.updateSettingsError"),
          message: updateResponse.error.message,
        });
        return;
      }
    } else {
      const insertResponse = await supabase
        .from("workspace_settings")
        .insert({
          workspace_id: workspace.id,
          start_year: payload.start_year,
          savings_rate_mode: payload.savings_rate_mode,
          deferred_income_enabled: payload.deferred_income_enabled,
          deferred_income_day: payload.deferred_income_day,
          show_cents: payload.show_cents,
          currency_code: payload.currency_code,
        })
        .select("id")
        .single();

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: t("workspaceSettings.notifications.createSettingsError"),
          message: insertResponse.error.message,
        });
        return;
      }

      setSettingsId(insertResponse.data.id);
    }

    notifications.show({
      color: "cyan",
      title: t("workspaceSettings.notifications.settingsSavedTitle"),
      message: t("workspaceSettings.notifications.settingsSavedMessage"),
    });

    setWorkspaceCurrencyCode(payload.currency_code);
    if (options?.onWorkspaceCurrenciesRefresh) {
      await options.onWorkspaceCurrenciesRefresh();
    }
  });

  const onSubmitWorkspace = handleSubmitWorkspace(async (values) => {
    if (!canEditWorkspaceSettings) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.editWorkspaceIdentityPermissionDenied"),
      });
      return;
    }

    const response = await supabase
      .from("workspaces")
      .update({
        name: values.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workspace.id);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.updateWorkspaceError"),
        message: response.error.message,
      });
      return;
    }

    await refreshWorkspace();

    notifications.show({
      color: "cyan",
      title: t("workspaceSettings.notifications.workspaceUpdatedTitle"),
      message: t("workspaceSettings.notifications.workspaceUpdatedMessage"),
    });
  });

  const onSubmitCreateWorkspace = handleSubmitCreateWorkspace(async (values) => {
    if (!canCreateWorkspace) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.createWorkspacePermissionDenied"),
      });
      return;
    }

    try {
      const createdWorkspace = await createWorkspace(values.name);
      notifications.show({
        color: "cyan",
        title: t("workspaceSettings.notifications.workspaceCreatedTitle"),
        message: t("workspaceSettings.notifications.workspaceCreatedMessage", undefined, {
          workspaceName: createdWorkspace.name,
        }),
      });
      closeCreateWorkspace();
      switchWorkspace(createdWorkspace.slug, "/settings");
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.createWorkspaceError"),
        message:
          error instanceof Error
            ? error.message
            : t("workspaceSettings.notifications.unexpectedCreateWorkspaceError"),
      });
    }
  });

  const onShowCentsChange = useCallback(
    (checked: boolean) => {
      setShowCentsValue(checked);
      setValue("showCents", checked, { shouldDirty: true });
    },
    [setValue],
  );

  return {
    canEditWorkspaceSettings,
    canCreateWorkspace,
    isLoading,
    workspaceCurrencyCode,
    savingsRateModeSelectData,
    workspaceCurrencyOptions,
    showCentsValue,
    onShowCentsChange,
    register,
    errors,
    isSubmitting,
    registerWorkspace,
    workspaceErrors,
    isWorkspaceSubmitting,
    registerCreateWorkspace,
    createWorkspaceErrors,
    isCreatingWorkspace,
    onSubmitSettings,
    onSubmitWorkspace,
    onSubmitCreateWorkspace,
    loadSettings,
    isCreateWorkspaceOpen,
    openCreateWorkspace,
    closeCreateWorkspace,
  };
}
