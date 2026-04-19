"use client";

import { Alert, LoadingOverlay, Stack, Text, Title } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";
import { useWorkspace } from "@/features/workspace/workspace-provider";

import { CreateWorkspaceModal } from "./components/create-workspace-modal";
import { DeleteWorkspaceModal } from "./components/delete-workspace-modal";
import { WorkspaceDangerZoneSection } from "./components/workspace-danger-zone-section";
import { WorkspaceGeneralSettingsSection } from "./components/workspace-general-settings-section";
import { WorkspaceLinksSection } from "./components/workspace-links-section";
import { WorkspaceMembersSection } from "./components/workspace-members-section";
import { useSettingsGeneral } from "./hooks/use-settings-general";
import { useSettingsLifecycle } from "./hooks/use-settings-lifecycle";
import { useSettingsLinks } from "./hooks/use-settings-links";
import { useSettingsMembers } from "./hooks/use-settings-members";

export default function SettingsPage() {
  const { t } = useI18n();
  const { workspace, workspaces, user } = useWorkspace();

  const links = useSettingsLinks();
  const general = useSettingsGeneral({
    onWorkspaceCurrenciesRefresh: links.loadWorkspaceCurrencies,
  });
  const members = useSettingsMembers();
  const lifecycle = useSettingsLifecycle();

  return (
    <Stack gap="lg" pos="relative">
      <LoadingOverlay visible={general.isLoading} />

      <CreateWorkspaceModal
        opened={general.isCreateWorkspaceOpen}
        onClose={general.closeCreateWorkspace}
        onSubmit={general.onSubmitCreateWorkspace}
        onCreateDemoWorkspace={() => {
          void general.onCreateDemoWorkspace();
        }}
        nameInputProps={general.registerCreateWorkspace("name")}
        nameError={general.createWorkspaceErrors.name?.message}
        isSubmitting={general.isCreatingWorkspace}
        isCreatingDemoWorkspace={general.isCreatingDemoWorkspace}
      />

      <DeleteWorkspaceModal
        opened={lifecycle.isDeleteWorkspaceOpen}
        onClose={lifecycle.closeDeleteWorkspace}
        workspaceName={workspace.name}
        confirmation={lifecycle.deleteWorkspaceConfirmation}
        onConfirmationChange={lifecycle.setDeleteWorkspaceConfirmation}
        isDeleting={lifecycle.isDeletingWorkspace}
        onConfirmDelete={() => {
          void lifecycle.onDeleteWorkspace();
        }}
      />

      <Stack gap={2}>
        <Title order={2} component="h1">
          {t("workspaceSettings.title")}
        </Title>
        <Text c="dimmed" size="sm">
          {t("workspaceSettings.subtitle", undefined, {
            workspaceName: workspace.name,
            role: lifecycle.currentRoleLabel,
          })}
        </Text>
      </Stack>

      {!general.canEditWorkspaceSettings ? (
        <Alert color="yellow" variant="light" title={t("workspaceSettings.readOnly.title")}>
          {t("workspaceSettings.readOnly.message", undefined, {
            role: lifecycle.currentRoleLabel,
          })}
        </Alert>
      ) : null}

      <Stack gap="md">
        <WorkspaceGeneralSettingsSection
          canEditWorkspaceSettings={general.canEditWorkspaceSettings}
          canCreateWorkspace={general.canCreateWorkspace}
          onOpenCreateWorkspace={general.openCreateWorkspace}
          onSubmitWorkspace={general.onSubmitWorkspace}
          workspaceNameInputProps={general.registerWorkspace("name")}
          workspaceNameError={general.workspaceErrors.name?.message}
          isWorkspaceSubmitting={general.isWorkspaceSubmitting}
          onSubmitSettings={general.onSubmitSettings}
          workspaceCurrencyOptions={general.workspaceCurrencyOptions}
          currencyInputProps={general.register("currencyCode")}
          currencyError={general.errors.currencyCode?.message}
          showCents={general.showCentsValue}
          onShowCentsChange={general.onShowCentsChange}
          savingsRateModeSelectData={general.savingsRateModeSelectData}
          savingsModeInputProps={general.register("savingsRateMode")}
          savingsModeError={general.errors.savingsRateMode?.message}
          isSettingsSubmitting={general.isSubmitting}
          onReloadSettings={() => {
            void general.loadSettings();
          }}
        />

        <WorkspaceMembersSection
          canManageMembers={members.canManageMembers}
          members={members.members}
          isMembersLoading={members.isMembersLoading}
          onSubmitInviteMember={members.onSubmitInviteMember}
          inviteEmailInputProps={members.registerInviteMember("email")}
          inviteEmailError={members.inviteMemberErrors.email?.message}
          isInvitingMember={members.isInvitingMember}
          currentUserId={user.id}
          removingMemberUserId={members.removingMemberUserId}
          onRemoveMember={(member) => {
            void members.onRemoveMember(member);
          }}
        />

        <WorkspaceLinksSection
          canManageLinks={links.canManageLinks}
          canUseMultiWorkspace={links.canUseMultiWorkspace}
          sourceWorkspaceCurrency={general.workspaceCurrencyCode.toUpperCase()}
          onSubmitWorkspaceLink={links.onSubmitWorkspaceLink}
          workspaceLinkControl={links.workspaceLinkControl}
          workspaceLinkError={links.workspaceLinkErrors.targetWorkspaceId?.message}
          workspaceLinkTargetOptions={links.workspaceLinkTargetOptions}
          isWorkspaceLinkSubmitting={links.isWorkspaceLinkSubmitting}
          isWorkspaceCurrenciesLoading={links.isWorkspaceCurrenciesLoading}
          canCreateAnyWorkspaceLink={links.canCreateAnyWorkspaceLink}
          isWorkspaceLinksLoading={links.isWorkspaceLinksLoading}
          workspaceLinks={links.workspaceLinks}
          deactivatingLinkId={links.deactivatingLinkId}
          onDeactivateWorkspaceLink={(workspaceLink) => {
            void links.onDeactivateWorkspaceLink(workspaceLink);
          }}
        />

        <WorkspaceDangerZoneSection
          workspaceRole={workspace.role}
          workspacesCount={workspaces.length}
          canDeleteCurrentWorkspace={lifecycle.canDeleteCurrentWorkspace}
          canDeleteWorkspaceByRole={lifecycle.canDeleteWorkspaceByRole}
          isLeavingWorkspace={lifecycle.isLeavingWorkspace}
          onLeaveWorkspace={() => {
            void lifecycle.onLeaveWorkspace();
          }}
          onOpenDeleteWorkspace={lifecycle.openDeleteWorkspace}
        />
      </Stack>
    </Stack>
  );
}
