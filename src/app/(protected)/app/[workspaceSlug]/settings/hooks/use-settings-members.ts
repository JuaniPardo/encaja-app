"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";
import {
  createInviteWorkspaceMemberSchema,
  type InviteWorkspaceMemberInputValues,
  type InviteWorkspaceMemberValues,
} from "@/features/workspace/members-schema";
import { canManageWorkspaceMembers } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";

import type { WorkspaceMemberSummary } from "../types";

export function useSettingsMembers() {
  const { t } = useI18n();
  const { supabase, workspace } = useWorkspace();
  const canManageMembers = canManageWorkspaceMembers(workspace.role);

  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<string | null>(null);

  const inviteMemberSchema = useMemo(
    () =>
      createInviteWorkspaceMemberSchema({
        requiredEmail: t("common.forms.workspace.requiredEmail"),
        longEmail: t("common.forms.workspace.longEmail"),
        invalidEmail: t("auth.validation.invalidEmail"),
      }),
    [t],
  );

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
    const timeoutId = window.setTimeout(() => {
      void loadMembers();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadMembers]);

  useEffect(() => {
    resetInviteMember({
      email: "",
    });
  }, [resetInviteMember, workspace.id]);

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

  return {
    canManageMembers,
    members,
    isMembersLoading,
    registerInviteMember,
    inviteMemberErrors,
    isInvitingMember,
    onSubmitInviteMember,
    removingMemberUserId,
    onRemoveMember,
  };
}
