"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  LoadingOverlay,
  Modal,
  NativeSelect,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Controller, useForm } from "react-hook-form";

import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { useI18n } from "@/features/i18n/provider";
import {
  createSettingsFormSchema,
  type SettingsFormInputValues,
  type SettingsFormValues,
} from "@/features/settings/schema";
import {
  createInviteWorkspaceMemberSchema,
  type InviteWorkspaceMemberInputValues,
  type InviteWorkspaceMemberValues,
} from "@/features/workspace/members-schema";
import {
  createWorkspaceFormSchema,
  type WorkspaceFormInputValues,
  type WorkspaceFormValues,
} from "@/features/workspace/schema";
import {
  createWorkspaceLinkFormSchema,
  type WorkspaceLinkFormInputValues,
  type WorkspaceLinkFormValues,
} from "@/features/workspace/links-schema";
import {
  canDeleteWorkspace,
  canManageWorkspaceLinks,
  canManageWorkspaceMembers,
  canManageWorkspaceSettings,
} from "@/features/workspace/permissions";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { ROUTES } from "@/lib/routes";
import type { Database } from "@/types/database";

type WorkspaceMemberSummary =
  Database["public"]["Functions"]["list_workspace_members"]["Returns"][number];
type WorkspaceLinkSummary =
  Database["public"]["Functions"]["list_workspace_links"]["Returns"][number];
type WorkspaceSettingsCurrencyRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "workspace_id" | "currency_code"
>;

const DEFAULT_CURRENCY_CODE = "ARS";
const WORKSPACE_CURRENCY_CODES = ["ARS", "USD", "EUR", "CLP", "UYU", "BRL", "MXN", "COP", "PEN"] as const;
type SettingsTabValue = "workspace" | "account";
const settingsTabAccentColor: Record<SettingsTabValue, string> = {
  workspace: "cyan",
  account: "indigo",
};

function getMemberDisplayName(member: WorkspaceMemberSummary) {
  if (member.full_name && member.full_name.trim().length > 0) {
    return member.full_name.trim();
  }

  return member.email;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const {
    supabase,
    user,
    workspace,
    workspaces,
    refreshWorkspace,
    createWorkspace,
    deleteWorkspace,
    switchWorkspace,
    canUseWorkspaceFeature,
  } = useWorkspace();
  const canEditWorkspaceSettings = canManageWorkspaceSettings(workspace.role);
  const canManageMembers = canManageWorkspaceMembers(workspace.role);
  const canManageLinks = canManageWorkspaceLinks(workspace.role);
  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");
  const canCreateWorkspace = canUseMultiWorkspace && canEditWorkspaceSettings;
  const canDeleteCurrentWorkspace =
    canUseMultiWorkspace && canDeleteWorkspace(workspace.role) && workspaces.length > 1;
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const currentRoleLabel = t(`common.role.${workspace.role}`, workspace.role);
  const [isCreateWorkspaceOpen, { open: openCreateWorkspace, close: closeCreateWorkspace }] =
    useDisclosure(false);
  const [isDeleteWorkspaceOpen, { open: openDeleteWorkspace, close: closeDeleteWorkspace }] =
    useDisclosure(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceConfirmation, setDeleteWorkspaceConfirmation] = useState("");
  const [isLeavingWorkspace, setIsLeavingWorkspace] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<string | null>(null);
  const [workspaceLinks, setWorkspaceLinks] = useState<WorkspaceLinkSummary[]>([]);
  const [isWorkspaceLinksLoading, setIsWorkspaceLinksLoading] = useState(true);
  const [deactivatingLinkId, setDeactivatingLinkId] = useState<string | null>(null);
  const [workspaceCurrenciesById, setWorkspaceCurrenciesById] = useState<
    Record<string, string>
  >({});
  const [isWorkspaceCurrenciesLoading, setIsWorkspaceCurrenciesLoading] = useState(true);
  const [workspaceCurrencyCode, setWorkspaceCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabValue>("workspace");
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
  const inviteMemberSchema = useMemo(
    () =>
      createInviteWorkspaceMemberSchema({
        requiredEmail: t("common.forms.workspace.requiredEmail"),
        longEmail: t("common.forms.workspace.longEmail"),
        invalidEmail: t("auth.validation.invalidEmail"),
      }),
    [t],
  );
  const workspaceLinkSchema = useMemo(
    () =>
      createWorkspaceLinkFormSchema({
        requiredTargetWorkspace: t("common.forms.workspace.requiredTargetWorkspace"),
        invalidTargetWorkspace: t("common.forms.workspace.invalidTargetWorkspace"),
      }),
    [t],
  );

  const {
    register,
    control,
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
  const {
    register: registerInviteMember,
    handleSubmit: handleSubmitInviteMember,
    reset: resetInviteMember,
    formState: {
      errors: inviteMemberErrors,
      isSubmitting: isInvitingMember,
    },
  } = useForm<InviteWorkspaceMemberInputValues, unknown, InviteWorkspaceMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: "",
    },
  });
  const {
    control: workspaceLinkControl,
    handleSubmit: handleSubmitWorkspaceLink,
    reset: resetWorkspaceLink,
    formState: {
      errors: workspaceLinkErrors,
      isSubmitting: isWorkspaceLinkSubmitting,
    },
  } = useForm<WorkspaceLinkFormInputValues, unknown, WorkspaceLinkFormValues>({
    resolver: zodResolver(workspaceLinkSchema),
    defaultValues: {
      targetWorkspaceId: "",
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

  useEffect(() => {
    if (!isDeleteWorkspaceOpen) {
      setDeleteWorkspaceConfirmation("");
    }
  }, [isDeleteWorkspaceOpen]);

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
    void loadSettings();
  }, [loadSettings]);

  const loadMembers = useCallback(async () => {
    setIsMembersLoading(true);

    const response = await supabase.rpc("list_workspace_members", {
      p_workspace_id: workspace.id,
    });

    setIsMembersLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.loadMembersError"),
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceMemberSummary[];
    setMembers(rows);
  }, [supabase, t, workspace.id]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const loadWorkspaceCurrencies = useCallback(async () => {
    const workspaceIds = Array.from(new Set(workspaces.map((workspaceItem) => workspaceItem.id)));
    if (workspaceIds.length === 0) {
      setWorkspaceCurrenciesById({});
      setIsWorkspaceCurrenciesLoading(false);
      return;
    }

    setIsWorkspaceCurrenciesLoading(true);

    const response = await supabase
      .from("workspace_settings")
      .select("workspace_id, currency_code")
      .in("workspace_id", workspaceIds);

    setIsWorkspaceCurrenciesLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.loadWorkspaceCurrenciesError"),
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceSettingsCurrencyRow[];
    const nextCurrenciesById: Record<string, string> = {};

    for (const row of rows) {
      nextCurrenciesById[row.workspace_id] = row.currency_code;
    }

    setWorkspaceCurrenciesById(nextCurrenciesById);
    if (nextCurrenciesById[workspace.id]) {
      setWorkspaceCurrencyCode(nextCurrenciesById[workspace.id]);
    }
  }, [supabase, t, workspace.id, workspaces]);

  useEffect(() => {
    void loadWorkspaceCurrencies();
  }, [loadWorkspaceCurrencies]);

  const loadWorkspaceLinks = useCallback(async () => {
    setIsWorkspaceLinksLoading(true);

    const response = await supabase.rpc("list_workspace_links", {
      p_source_workspace_id: workspace.id,
    });

    setIsWorkspaceLinksLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.loadLinksError"),
        message: response.error.message,
      });
      return;
    }

    const rows = (response.data ?? []) as WorkspaceLinkSummary[];
    setWorkspaceLinks(rows);
  }, [supabase, t, workspace.id]);

  useEffect(() => {
    void loadWorkspaceLinks();
  }, [loadWorkspaceLinks]);

  useEffect(() => {
    resetInviteMember({
      email: "",
    });
  }, [resetInviteMember, workspace.id]);

  useEffect(() => {
    resetWorkspaceLink({
      targetWorkspaceId: "",
    });
  }, [resetWorkspaceLink, workspace.id]);

  const onSubmit = handleSubmit(async (values) => {
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
    await loadWorkspaceCurrencies();
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

  const onDeleteWorkspace = async () => {
    if (!canDeleteCurrentWorkspace) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.deleteWorkspacePermissionDenied"),
      });
      return;
    }

    if (deleteWorkspaceConfirmation.trim() !== workspace.name.trim()) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.invalidConfirmationTitle"),
        message: t("workspaceSettings.notifications.invalidConfirmationMessage"),
      });
      return;
    }

    setIsDeletingWorkspace(true);

    try {
      const fallbackWorkspace = await deleteWorkspace(workspace.id);
      closeDeleteWorkspace();
      notifications.show({
        color: "cyan",
        title: t("workspaceSettings.notifications.workspaceDeletedTitle"),
        message: t("workspaceSettings.notifications.workspaceDeletedMessage", undefined, {
          workspaceName: fallbackWorkspace.name,
        }),
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.deleteWorkspaceError"),
        message: getErrorMessage(
          error,
          t("workspaceSettings.notifications.unexpectedDeleteWorkspaceError"),
        ),
      });
    } finally {
      setIsDeletingWorkspace(false);
    }
  };
  
  const onLeaveWorkspace = async () => {
    if (workspace.role === "owner") {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.ownerCannotLeaveMessage"),
      });
      return;
    }

    if (workspaces.length <= 1) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.leaveWorkspaceError"),
        message: t("workspaceSettings.dangerZone.needAnotherWorkspaceMessage"),
      });
      return;
    }

    setIsLeavingWorkspace(true);

    try {
      const { error } = await supabase.rpc("leave_workspace", {
        p_workspace_id: workspace.id,
      });

      if (error) {
        setIsLeavingWorkspace(false);
        notifications.show({
          color: "red",
          title: t("workspaceSettings.notifications.leaveWorkspaceError"),
          message: getErrorMessage(
            error,
            t("workspaceSettings.notifications.unexpectedLeaveWorkspaceError"),
          ),
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("workspaceSettings.notifications.workspaceLeftTitle"),
        message: t("workspaceSettings.notifications.workspaceLeftMessage", undefined, {
          workspaceName: workspace.name,
        }),
      });

      // Redirigir al primer workspace disponible que no sea el actual
      const nextWorkspace = workspaces.find((w) => w.id !== workspace.id);
      if (nextWorkspace) {
        window.location.href = buildWorkspaceHref(nextWorkspace.slug);
      } else {
        window.location.href = ROUTES.LOGIN;
      }
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.leaveWorkspaceError"),
        message: getErrorMessage(
          error,
          t("workspaceSettings.notifications.unexpectedLeaveWorkspaceError"),
        ),
      });
    } finally {
      setIsLeavingWorkspace(false);
    }
  };

  const onSubmitInviteMember = handleSubmitInviteMember(async (values) => {
    if (!canManageMembers) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.inviteMemberPermissionDenied"),
      });
      return;
    }

    const response = await supabase.rpc("invite_workspace_member_by_email", {
      p_workspace_id: workspace.id,
      p_email: values.email,
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.inviteMemberError"),
        message: response.error.message,
      });
      return;
    }

    const invitedMember = response.data?.[0];
    if (!invitedMember) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.inviteMemberError"),
        message: t("workspaceSettings.notifications.inviteMemberMissingBackendConfirmation"),
      });
      return;
    }

    notifications.show({
      color: invitedMember.was_created ? "cyan" : "blue",
      title: invitedMember.was_created
        ? t("workspaceSettings.notifications.memberInvitedTitle")
        : t("workspaceSettings.notifications.memberAlreadyExistsTitle"),
      message: invitedMember.was_created
        ? t("workspaceSettings.notifications.memberInvitedMessage", undefined, {
            email: invitedMember.email,
          })
        : t("workspaceSettings.notifications.memberAlreadyExistsMessage", undefined, {
            email: invitedMember.email,
          }),
    });

    resetInviteMember({
      email: "",
    });
    await loadMembers();
  });

  const onRemoveMember = async (member: WorkspaceMemberSummary) => {
    if (!canManageMembers) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.removeMemberPermissionDenied"),
      });
      return;
    }

    setRemovingMemberUserId(member.user_id);

    const response = await supabase.rpc("remove_workspace_member", {
      p_workspace_id: workspace.id,
      p_member_user_id: member.user_id,
    });

    setRemovingMemberUserId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.removeMemberError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: t("workspaceSettings.notifications.memberAccessRemovedTitle"),
      message: t("workspaceSettings.notifications.memberAccessRemovedMessage", undefined, {
        email: member.email,
      }),
    });

    await loadMembers();
  };

  const activeLinksByTargetWorkspaceId = useMemo(
    () =>
      new Map(
        workspaceLinks
          .filter((workspaceLink) => workspaceLink.is_active)
          .map((workspaceLink) => [workspaceLink.target_workspace_id, workspaceLink]),
      ),
    [workspaceLinks],
  );

  const sourceWorkspaceCurrency = workspaceCurrencyCode.toUpperCase();
  const activeWorkspaceLinksCount = workspaceLinks.filter(
    (workspaceLink) => workspaceLink.is_active,
  ).length;
  const selectedSettingsTabColor = settingsTabAccentColor[activeSettingsTab];

  const workspaceLinkTargetOptions = useMemo(() => {
    return workspaces
      .filter((workspaceItem) => workspaceItem.id !== workspace.id)
      .map((workspaceItem) => {
        const targetCurrency = workspaceCurrenciesById[workspaceItem.id] ?? null;
        const hasCurrencyConfigured = Boolean(targetCurrency);
        const hasActiveLink = activeLinksByTargetWorkspaceId.has(workspaceItem.id);

        let disabledReason: string | null = null;
        if (!hasCurrencyConfigured) {
          disabledReason = t("workspaceSettings.workspaceLinks.disabledReason.noCurrencyConfigured");
        } else if (hasActiveLink) {
          disabledReason = t("workspaceSettings.workspaceLinks.disabledReason.alreadyLinked");
        }

        const roleLabel = t(`common.role.${workspaceItem.role}`, workspaceItem.role);
        const currencyLabel = targetCurrency ?? t("workspaceSettings.notApplicable");

        return {
          value: workspaceItem.id,
          label: `${workspaceItem.name} · ${roleLabel} · ${currencyLabel}${disabledReason ? ` (${disabledReason})` : ""}`,
          disabled: disabledReason !== null,
        };
      });
  }, [
    activeLinksByTargetWorkspaceId,
    t,
    workspace.id,
    workspaceCurrenciesById,
    workspaces,
  ]);

  const canCreateAnyWorkspaceLink = workspaceLinkTargetOptions.some((option) => !option.disabled);

  const getSettingsTabStyle = useCallback(
    (tabValue: SettingsTabValue) => {
      const accentColor = settingsTabAccentColor[tabValue];
      const isActive = activeSettingsTab === tabValue;

      return {
        border: isActive
          ? `1px solid var(--mantine-color-${accentColor}-2)`
          : "1px solid var(--mantine-color-gray-2)",
        backgroundColor: isActive
          ? `var(--mantine-color-${accentColor}-0)`
          : "var(--mantine-color-gray-0)",
        color: isActive ? `var(--mantine-color-${accentColor}-7)` : "var(--mantine-color-gray-7)",
        fontWeight: isActive ? 700 : 500,
        borderRadius: 8,
        minHeight: isMobile ? 34 : 36,
        fontSize: isMobile ? "0.78rem" : undefined,
        lineHeight: 1.15,
        textAlign: "center" as const,
        paddingInline: isMobile ? 6 : 8,
        whiteSpace: "nowrap" as const,
      };
    },
    [activeSettingsTab, isMobile],
  );

  const onSubmitWorkspaceLink = handleSubmitWorkspaceLink(async (values) => {
    if (!canManageLinks) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.createWorkspaceLinkPermissionDenied"),
      });
      return;
    }

    const selectedTargetWorkspace = workspaces.find(
      (workspaceItem) => workspaceItem.id === values.targetWorkspaceId,
    );
    if (!selectedTargetWorkspace) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.invalidWorkspaceTitle"),
        message: t("workspaceSettings.notifications.invalidWorkspaceMessage"),
      });
      return;
    }

    if (selectedTargetWorkspace.id === workspace.id) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.invalidLinkTitle"),
        message: t("workspaceSettings.notifications.invalidLinkMessage"),
      });
      return;
    }

    const selectedTargetCurrency = workspaceCurrenciesById[selectedTargetWorkspace.id];
    if (!selectedTargetCurrency) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.workspaceWithoutCurrencyTitle"),
        message: t("workspaceSettings.notifications.workspaceWithoutCurrencyMessage"),
      });
      return;
    }

    if (activeLinksByTargetWorkspaceId.has(selectedTargetWorkspace.id)) {
      notifications.show({
        color: "yellow",
        title: t("workspaceSettings.notifications.activeLinkAlreadyExistsTitle"),
        message: t("workspaceSettings.notifications.activeLinkAlreadyExistsMessage"),
      });
      return;
    }

    const response = await supabase.rpc("create_workspace_link", {
      p_source_workspace_id: workspace.id,
      p_target_workspace_id: selectedTargetWorkspace.id,
      p_visibility_mode: "summary_only",
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.createLinkError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: t("workspaceSettings.notifications.workspaceLinkedTitle"),
      message: t("workspaceSettings.notifications.workspaceLinkedMessage", undefined, {
        workspaceName: selectedTargetWorkspace.name,
      }),
    });

    resetWorkspaceLink({
      targetWorkspaceId: "",
    });
    await loadWorkspaceLinks();
  });

  const onDeactivateWorkspaceLink = async (workspaceLink: WorkspaceLinkSummary) => {
    if (!canManageLinks) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.permissionDeniedTitle"),
        message: t("workspaceSettings.notifications.deactivateLinkPermissionDenied"),
      });
      return;
    }

    setDeactivatingLinkId(workspaceLink.link_id);

    const response = await supabase.rpc("deactivate_workspace_link", {
      p_source_workspace_id: workspace.id,
      p_link_id: workspaceLink.link_id,
    });

    setDeactivatingLinkId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("workspaceSettings.notifications.deactivateLinkError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: t("workspaceSettings.notifications.linkDeactivatedTitle"),
      message: t("workspaceSettings.notifications.linkDeactivatedMessage"),
    });

    await loadWorkspaceLinks();
  };

  return (
    <Stack gap="lg" pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Modal
        opened={isCreateWorkspaceOpen}
        onClose={closeCreateWorkspace}
        title={t("workspaceSettings.modals.createWorkspace.title")}
        centered
      >
        <form onSubmit={onSubmitCreateWorkspace}>
          <Stack gap="sm">
            <TextInput
              label={t("workspaceSettings.forms.workspaceDisplayName")}
              placeholder={t("workspaceSettings.forms.workspaceDisplayNamePlaceholderLong")}
              error={createWorkspaceErrors.name?.message}
              {...registerCreateWorkspace("name")}
            />
            <Group justify="flex-end">
              <Button type="button" variant="light" color="gray" onClick={closeCreateWorkspace}>
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" loading={isCreatingWorkspace}>
                {t("common.actions.create")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal
        opened={isDeleteWorkspaceOpen}
        onClose={closeDeleteWorkspace}
        title={t("workspaceSettings.modals.deleteWorkspace.title")}
        centered
      >
        <Stack gap="sm">
          <Alert color="red" variant="light" title={t("workspaceSettings.modals.deleteWorkspace.irreversibleTitle")}>
            {t("workspaceSettings.modals.deleteWorkspace.irreversibleBody")}
          </Alert>
          <Text size="sm">
            {t("workspaceSettings.modals.deleteWorkspace.confirmPrompt", undefined, {
              workspaceName: workspace.name,
            })}
          </Text>
          <TextInput
            value={deleteWorkspaceConfirmation}
            onChange={(event) => setDeleteWorkspaceConfirmation(event.currentTarget.value)}
            placeholder={workspace.name}
          />
          <Group justify="flex-end">
            <Button
              type="button"
              variant="light"
              color="gray"
              onClick={closeDeleteWorkspace}
              disabled={isDeletingWorkspace}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              color="red"
              loading={isDeletingWorkspace}
              disabled={deleteWorkspaceConfirmation.trim() !== workspace.name.trim()}
              onClick={() => void onDeleteWorkspace()}
            >
              {t("workspaceSettings.modals.deleteWorkspace.confirmButton")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap={2}>
        <Title order={2} component="h1">{t("workspaceSettings.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("workspaceSettings.subtitle", undefined, {
            workspaceName: workspace.name,
            role: currentRoleLabel,
          })}
        </Text>
      </Stack>

      {!canEditWorkspaceSettings ? (
        <Alert color="yellow" variant="light" title={t("workspaceSettings.readOnly.title")}>
          {t("workspaceSettings.readOnly.message", undefined, {
            role: currentRoleLabel,
          })}
        </Alert>
      ) : null}

      <Tabs
        value={activeSettingsTab}
        onChange={(value) => setActiveSettingsTab((value as SettingsTabValue) ?? "workspace")}
        variant="default"
        keepMounted={false}
      >
        <Tabs.List
          style={{
            position: isMobile ? "sticky" : undefined,
            top: isMobile ? 0 : undefined,
            zIndex: isMobile ? 20 : undefined,
            backgroundColor: "var(--mantine-color-body)",
            border: `1px solid var(--mantine-color-${selectedSettingsTabColor}-2)`,
            borderRadius: 10,
            padding: 6,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: isMobile ? 4 : 6,
            boxShadow: isMobile ? "0 1px 0 rgba(0,0,0,0.04)" : undefined,
          }}
        >
          <Tabs.Tab value="workspace" style={getSettingsTabStyle("workspace")}>
            {t("workspaceSettings.tabs.workspace")}
          </Tabs.Tab>
          <Tabs.Tab value="account" style={getSettingsTabStyle("account")}>
            {t("workspaceSettings.tabs.account")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="workspace" pt="sm">
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Stack gap="md">
                <Stack gap={2}>
                  <Text fw={600}>{t("workspaceSettings.general.title")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("workspaceSettings.general.description")}
                  </Text>
                </Stack>

                <form onSubmit={onSubmitWorkspace}>
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Text fw={500}>{t("workspaceSettings.identity.title")}</Text>
                      {canCreateWorkspace ? (
                        <Button variant="subtle" size="xs" onClick={openCreateWorkspace}>
                          {t("workspaceSettings.identity.createWorkspaceButton")}
                        </Button>
                      ) : null}
                    </Group>
                    <TextInput
                      label={t("workspaceSettings.forms.workspaceDisplayName")}
                      placeholder={t("workspaceSettings.forms.workspaceDisplayNamePlaceholderShort")}
                      disabled={!canEditWorkspaceSettings}
                      error={workspaceErrors.name?.message}
                      {...registerWorkspace("name")}
                    />
                    <Group justify="flex-end">
                      <Button
                        type="submit"
                        loading={isWorkspaceSubmitting}
                        disabled={!canEditWorkspaceSettings}
                      >
                        {t("workspaceSettings.identity.saveNameButton")}
                      </Button>
                    </Group>
                  </Stack>
                </form>

                <Divider />

                <form onSubmit={onSubmit}>
                  <Stack gap="sm">
                    <NativeSelect
                      label={t("workspaceSettings.forms.currency")}
                      data={workspaceCurrencyOptions}
                      disabled={!canEditWorkspaceSettings}
                      error={errors.currencyCode?.message}
                      {...register("currencyCode")}
                    />
                    <Text size="xs" c="dimmed">
                      {t("workspaceSettings.forms.currencyDescription")}
                    </Text>

                    <Controller
                      control={control}
                      name="showCents"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          disabled={!canEditWorkspaceSettings}
                          onChange={(event) => field.onChange(event.currentTarget.checked)}
                          label={t("workspaceSettings.forms.showCents")}
                        />
                      )}
                    />
                    <Text size="xs" c="dimmed">
                      {t("workspaceSettings.forms.showCentsDescription")}
                    </Text>

                    <NativeSelect
                      label={t("workspaceSettings.forms.savingsMode")}
                      data={savingsRateModeSelectData}
                      disabled={!canEditWorkspaceSettings}
                      error={errors.savingsRateMode?.message}
                      {...register("savingsRateMode")}
                    />

                    <Group justify="flex-end">
                      <Button
                        type="button"
                        variant="light"
                        color="gray"
                        onClick={() => void loadSettings()}
                        disabled={!canEditWorkspaceSettings}
                      >
                        {t("workspaceSettings.forms.revertButton")}
                      </Button>
                      <Button
                        type="submit"
                        loading={isSubmitting}
                        disabled={!canEditWorkspaceSettings}
                      >
                        {t("workspaceSettings.forms.saveSettingsButton")}
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("workspaceSettings.members.title")}</Text>
                <Badge variant="light" color="gray">
                  {t("workspaceSettings.members.count", undefined, {
                    count: members.length,
                    pluralSuffix: members.length === 1 ? "" : "s",
                  })}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("workspaceSettings.members.description")}
              </Text>

              {!canManageMembers ? (
                <Alert color="blue" variant="light" title={t("workspaceSettings.members.noAdminTitle")}>
                  {t("workspaceSettings.members.noAdminMessage")}
                </Alert>
              ) : null}

              <form onSubmit={onSubmitInviteMember}>
                <Group align="flex-end" wrap="wrap">
                  <TextInput
                    label={t("workspaceSettings.members.inviteEmailLabel")}
                    placeholder={t("workspaceSettings.members.inviteEmailPlaceholder")}
                    error={inviteMemberErrors.email?.message}
                    disabled={!canManageMembers}
                    style={{ flex: 1, minWidth: 220 }}
                    {...registerInviteMember("email")}
                  />
                  <Button type="submit" loading={isInvitingMember} disabled={!canManageMembers}>
                    {t("workspaceSettings.members.inviteButton")}
                  </Button>
                </Group>
              </form>

              {isMembersLoading ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.members.loading")}
                </Text>
              ) : members.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.members.empty")}
                </Text>
              ) : (
                <Stack gap="xs">
                  {members.map((member) => {
                    const canRemoveMember = canManageMembers && member.role !== "owner";
                    const isCurrentUser = member.user_id === user.id;

                    return (
                      <Paper key={member.member_id} withBorder radius="sm" p="sm">
                        <Group justify="space-between" align="center" wrap="wrap">
                          <Stack gap={2}>
                            <Group gap="xs">
                              <Text fw={600}>{getMemberDisplayName(member)}</Text>
                              {isCurrentUser ? (
                                <Badge size="xs" variant="outline" color="blue">
                                  {t("common.you", "Vos")}
                                </Badge>
                              ) : null}
                            </Group>
                            <Text size="sm" c="dimmed">
                              {member.email}
                            </Text>
                          </Stack>
                          <Group gap="xs" align="center">
                            <Badge variant="light" color={member.role === "owner" ? "cyan" : "gray"}>
                              {t(`common.role.${member.role}`, member.role)}
                            </Badge>
                            {canRemoveMember ? (
                              <Button
                                type="button"
                                size="xs"
                                color="red"
                                variant="light"
                                loading={removingMemberUserId === member.user_id}
                                onClick={() => void onRemoveMember(member)}
                              >
                                {t("workspaceSettings.members.removeButton")}
                              </Button>
                            ) : null}
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Paper>

            <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{t("workspaceSettings.workspaceLinks.title")}</Text>
                <Badge variant="light" color="blue">
                  {t("workspaceSettings.workspaceLinks.activeCount", undefined, {
                    count: activeWorkspaceLinksCount,
                  })}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {t("workspaceSettings.workspaceLinks.description")}
              </Text>
              <Text size="sm" c="dimmed">
                {t("workspaceSettings.workspaceLinks.currentCurrency", undefined, {
                  currencyCode: sourceWorkspaceCurrency,
                })}
              </Text>

              {!canManageLinks ? (
                <Alert
                  color="blue"
                  variant="light"
                  title={t("workspaceSettings.workspaceLinks.noAdminTitle")}
                >
                  {t("workspaceSettings.workspaceLinks.noAdminMessage")}
                </Alert>
              ) : null}

              <form onSubmit={onSubmitWorkspaceLink}>
                <Group align="flex-end" wrap="wrap">
                  <Controller
                    control={workspaceLinkControl}
                    name="targetWorkspaceId"
                    render={({ field }) => (
                      <Select
                        label={t("workspaceSettings.workspaceLinks.targetWorkspaceLabel")}
                        placeholder={
                          canUseMultiWorkspace
                            ? t("workspaceSettings.workspaceLinks.targetWorkspacePlaceholder")
                            : t("workspaceSettings.workspaceLinks.planWithoutAccess")
                        }
                        data={workspaceLinkTargetOptions}
                        error={workspaceLinkErrors.targetWorkspaceId?.message}
                        disabled={
                          !canUseMultiWorkspace ||
                          !canManageLinks ||
                          isWorkspaceCurrenciesLoading ||
                          !canCreateAnyWorkspaceLink
                        }
                        style={{ flex: 1, minWidth: 260 }}
                        searchable
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "")}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Button
                    type="submit"
                    loading={isWorkspaceLinkSubmitting}
                    disabled={
                      !canUseMultiWorkspace ||
                      !canManageLinks ||
                      isWorkspaceCurrenciesLoading ||
                      !canCreateAnyWorkspaceLink
                    }
                  >
                    {t("workspaceSettings.workspaceLinks.linkButton")}
                  </Button>
                </Group>
              </form>

              {!canUseMultiWorkspace ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.workspaceLinks.planWithoutMultiWorkspace")}
                </Text>
              ) : null}

              {canUseMultiWorkspace &&
              canManageLinks &&
              !isWorkspaceCurrenciesLoading &&
              !canCreateAnyWorkspaceLink ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.workspaceLinks.noCompatibleWorkspaces")}
                </Text>
              ) : null}

              {isWorkspaceLinksLoading ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.workspaceLinks.loading")}
                </Text>
              ) : workspaceLinks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.workspaceLinks.empty")}
                </Text>
              ) : (
                <Stack gap="xs">
                  {workspaceLinks.map((workspaceLink) => {
                    const linkName =
                      workspaceLink.target_workspace_name ??
                      t("workspaceSettings.workspaceLinks.workspaceWithoutAccess");
                    const linkSlug = workspaceLink.target_workspace_slug;
                    const linkCurrency =
                      workspaceLink.target_currency_code ?? t("workspaceSettings.notApplicable");
                    const canDeactivateLink = canManageLinks && workspaceLink.is_active;

                    return (
                      <Paper key={workspaceLink.link_id} withBorder radius="sm" p="sm">
                        <Stack gap={6}>
                          <Group justify="space-between" align="center" wrap="wrap">
                            <Stack gap={2}>
                              <Text fw={600}>{linkName}</Text>
                              <Text size="sm" c="dimmed">
                                {t("workspaceSettings.workspaceLinks.linkMeta", undefined, {
                                  slugPrefix: linkSlug ? `${linkSlug} · ` : "",
                                  currencyCode: linkCurrency,
                                  visibilityMode: workspaceLink.visibility_mode,
                                })}
                              </Text>
                            </Stack>
                            <Group gap="xs" align="center">
                              <Badge
                                variant="light"
                                color={workspaceLink.is_active ? "cyan" : "gray"}
                              >
                                {workspaceLink.is_active
                                  ? t("workspaceSettings.status.active")
                                  : t("workspaceSettings.status.inactive")}
                              </Badge>
                              {canDeactivateLink ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  color="gray"
                                  variant="light"
                                  loading={deactivatingLinkId === workspaceLink.link_id}
                                  onClick={() => void onDeactivateWorkspaceLink(workspaceLink)}
                                >
                                  {t("workspaceSettings.workspaceLinks.deactivateButton")}
                                </Button>
                              ) : null}
                            </Group>
                          </Group>
                          {!workspaceLink.has_target_access ? (
                            <Alert
                              color="yellow"
                              variant="light"
                              title={t("workspaceSettings.workspaceLinks.noTargetAccessTitle")}
                            >
                              {t("workspaceSettings.workspaceLinks.noTargetAccessMessage")}
                            </Alert>
                          ) : null}
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Paper>

            <Paper
              withBorder
              radius="md"
              p="md"
              style={{ borderColor: "var(--mantine-color-red-3)" }}
            >
            <Stack gap="sm">
              <Text fw={600} c="red.6">
                {t("workspaceSettings.dangerZone.title")}
              </Text>
              <Text size="sm" c="dimmed">
                {t("workspaceSettings.dangerZone.description")}
              </Text>
              {!canDeleteWorkspace(workspace.role) ? (
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">
                    {t("workspaceSettings.dangerZone.ownerOnlyMessage")}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t("workspaceSettings.dangerZone.leaveWorkspaceDescription")}
                  </Text>
                </Stack>
              ) : null}
              {workspaces.length <= 1 ? (
                <Text size="sm" c="dimmed">
                  {t("workspaceSettings.dangerZone.needAnotherWorkspaceMessage")}
                </Text>
              ) : null}
              <Group justify="flex-end">
                {workspace.role !== "owner" ? (
                  <Button
                    color="red"
                    variant="outline"
                    onClick={() => void onLeaveWorkspace()}
                    loading={isLeavingWorkspace}
                    disabled={workspaces.length <= 1}
                  >
                    {t("workspaceSettings.dangerZone.leaveWorkspaceButton")}
                  </Button>
                ) : (
                  <Button
                    color="red"
                    variant="outline"
                    onClick={openDeleteWorkspace}
                    disabled={!canDeleteCurrentWorkspace}
                  >
                    {t("workspaceSettings.dangerZone.deleteWorkspaceButton")}
                  </Button>
                )}
              </Group>
            </Stack>
          </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="account" pt="sm">
          <Stack gap="md">
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
                <Stack gap={2}>
                  <Text fw={600}>{t("settings.profile.title")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("settings.profile.description")}
                  </Text>
                </Stack>
                <Button
                  component={Link}
                  href={buildWorkspaceHref(workspace.slug, ROUTES.PROFILE)}
                  variant="light"
                >
                  {t("settings.profile.openButton")}
                </Button>
              </Group>
            </Paper>

            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  {t("settings.feedback.secondaryHint")}
                </Text>
                <FeedbackForm />
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
