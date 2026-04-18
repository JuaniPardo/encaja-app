"use client";

import type { WorkspaceRole } from "@/types/database";
import { Button, Group, Paper, Stack, Text } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";

type WorkspaceDangerZoneSectionProps = {
  workspaceRole: WorkspaceRole;
  workspacesCount: number;
  canDeleteCurrentWorkspace: boolean;
  canDeleteWorkspaceByRole: boolean;
  isLeavingWorkspace: boolean;
  onLeaveWorkspace: () => void;
  onOpenDeleteWorkspace: () => void;
};

export function WorkspaceDangerZoneSection({
  workspaceRole,
  workspacesCount,
  canDeleteCurrentWorkspace,
  canDeleteWorkspaceByRole,
  isLeavingWorkspace,
  onLeaveWorkspace,
  onOpenDeleteWorkspace,
}: WorkspaceDangerZoneSectionProps) {
  const { t } = useI18n();

  return (
    <Paper withBorder radius="md" p="md" style={{ borderColor: "var(--mantine-color-red-3)" }}>
      <Stack gap="sm">
        <Text fw={600} c="red.6">
          {t("workspaceSettings.dangerZone.title")}
        </Text>
        <Text size="sm" c="dimmed">
          {t("workspaceSettings.dangerZone.description")}
        </Text>
        {!canDeleteWorkspaceByRole ? (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t("workspaceSettings.dangerZone.ownerOnlyMessage")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("workspaceSettings.dangerZone.leaveWorkspaceDescription")}
            </Text>
          </Stack>
        ) : null}
        {workspacesCount <= 1 ? (
          <Text size="sm" c="dimmed">
            {t("workspaceSettings.dangerZone.needAnotherWorkspaceMessage")}
          </Text>
        ) : null}
        <Group justify="flex-end">
          {workspaceRole !== "owner" ? (
            <Button
              color="red"
              variant="outline"
              onClick={onLeaveWorkspace}
              loading={isLeavingWorkspace}
              disabled={workspacesCount <= 1}
            >
              {t("workspaceSettings.dangerZone.leaveWorkspaceButton")}
            </Button>
          ) : (
            <Button
              color="red"
              variant="outline"
              onClick={onOpenDeleteWorkspace}
              disabled={!canDeleteCurrentWorkspace}
            >
              {t("workspaceSettings.dangerZone.deleteWorkspaceButton")}
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
