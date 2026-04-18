"use client";

import { useEffect, useMemo, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { useI18n } from "@/features/i18n/provider";
import { canDeleteWorkspace } from "@/features/workspace/permissions";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { ROUTES } from "@/lib/routes";

import { getErrorMessage } from "../types";

export function useSettingsLifecycle() {
  const { t } = useI18n();
  const {
    supabase,
    workspace,
    workspaces,
    deleteWorkspace,
    canUseWorkspaceFeature,
  } = useWorkspace();

  const canUseMultiWorkspace = canUseWorkspaceFeature("multi_workspace");
  const canDeleteWorkspaceByRole = canDeleteWorkspace(workspace.role);
  const canDeleteCurrentWorkspace =
    canUseMultiWorkspace && canDeleteWorkspaceByRole && workspaces.length > 1;

  const currentRoleLabel = useMemo(
    () => t(`common.role.${workspace.role}`, workspace.role),
    [t, workspace.role],
  );

  const [isDeleteWorkspaceOpen, { open: openDeleteWorkspace, close: closeDeleteWorkspace }] =
    useDisclosure(false);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceConfirmation, setDeleteWorkspaceConfirmation] = useState("");
  const [isLeavingWorkspace, setIsLeavingWorkspace] = useState(false);

  useEffect(() => {
    if (!isDeleteWorkspaceOpen) {
      setDeleteWorkspaceConfirmation("");
    }
  }, [isDeleteWorkspaceOpen]);

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

      const nextWorkspace = workspaces.find((workspaceItem) => workspaceItem.id !== workspace.id);
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

  return {
    currentRoleLabel,
    canDeleteWorkspaceByRole,
    canDeleteCurrentWorkspace,
    isDeleteWorkspaceOpen,
    openDeleteWorkspace,
    closeDeleteWorkspace,
    deleteWorkspaceConfirmation,
    setDeleteWorkspaceConfirmation,
    isDeletingWorkspace,
    onDeleteWorkspace,
    isLeavingWorkspace,
    onLeaveWorkspace,
  };
}
