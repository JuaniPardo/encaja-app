"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";
import {
  createWorkspaceLinkFormSchema,
  type WorkspaceLinkFormInputValues,
  type WorkspaceLinkFormValues,
} from "@/features/workspace/links-schema";
import { canManageWorkspaceLinks } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";

import type { WorkspaceLinkSummary, WorkspaceSettingsCurrencyRow } from "../types";

export function useSettingsLinks() {
  const { t } = useI18n();
  const { supabase, workspace, workspaces, canUseWorkspaceFeature } = useWorkspace();

  const canManageLinks = canManageWorkspaceLinks(workspace.role);
  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");

  const [workspaceLinks, setWorkspaceLinks] = useState<WorkspaceLinkSummary[]>([]);
  const [isWorkspaceLinksLoading, setIsWorkspaceLinksLoading] = useState(true);
  const [deactivatingLinkId, setDeactivatingLinkId] = useState<string | null>(null);
  const [workspaceCurrenciesById, setWorkspaceCurrenciesById] = useState<Record<string, string>>({});
  const [isWorkspaceCurrenciesLoading, setIsWorkspaceCurrenciesLoading] = useState(true);

  const workspaceLinkSchema = useMemo(
    () =>
      createWorkspaceLinkFormSchema({
        requiredTargetWorkspace: t("common.forms.workspace.requiredTargetWorkspace"),
        invalidTargetWorkspace: t("common.forms.workspace.invalidTargetWorkspace"),
      }),
    [t],
  );

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
  }, [supabase, t, workspaces]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWorkspaceCurrencies();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
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
    const timeoutId = window.setTimeout(() => {
      void loadWorkspaceLinks();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadWorkspaceLinks]);

  useEffect(() => {
    resetWorkspaceLink({
      targetWorkspaceId: "",
    });
  }, [resetWorkspaceLink, workspace.id]);

  const activeLinksByTargetWorkspaceId = useMemo(
    () =>
      new Map(
        workspaceLinks
          .filter((workspaceLink) => workspaceLink.is_active)
          .map((workspaceLink) => [workspaceLink.target_workspace_id, workspaceLink]),
      ),
    [workspaceLinks],
  );

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
  }, [activeLinksByTargetWorkspaceId, t, workspace.id, workspaceCurrenciesById, workspaces]);

  const canCreateAnyWorkspaceLink = workspaceLinkTargetOptions.some((option) => !option.disabled);

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

  return {
    canManageLinks,
    canUseMultiWorkspace,
    workspaceLinkControl,
    workspaceLinkErrors,
    isWorkspaceLinkSubmitting,
    workspaceLinkTargetOptions,
    canCreateAnyWorkspaceLink,
    isWorkspaceCurrenciesLoading,
    isWorkspaceLinksLoading,
    workspaceLinks,
    deactivatingLinkId,
    onSubmitWorkspaceLink,
    onDeactivateWorkspaceLink,
    loadWorkspaceCurrencies,
  };
}
