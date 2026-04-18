"use client";

import type { FormEventHandler } from "react";
import { Alert, Badge, Button, Group, Paper, Stack, Text, TextInput } from "@mantine/core";
import type { UseFormRegisterReturn } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";

import { getMemberDisplayName, type WorkspaceMemberSummary } from "../types";

type WorkspaceMembersSectionProps = {
  canManageMembers: boolean;
  members: WorkspaceMemberSummary[];
  isMembersLoading: boolean;
  onSubmitInviteMember: FormEventHandler<HTMLFormElement>;
  inviteEmailInputProps: UseFormRegisterReturn;
  inviteEmailError?: string;
  isInvitingMember: boolean;
  currentUserId: string;
  removingMemberUserId: string | null;
  onRemoveMember: (member: WorkspaceMemberSummary) => void;
};

export function WorkspaceMembersSection({
  canManageMembers,
  members,
  isMembersLoading,
  onSubmitInviteMember,
  inviteEmailInputProps,
  inviteEmailError,
  isInvitingMember,
  currentUserId,
  removingMemberUserId,
  onRemoveMember,
}: WorkspaceMembersSectionProps) {
  const { t } = useI18n();

  return (
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
              error={inviteEmailError}
              disabled={!canManageMembers}
              style={{ flex: 1, minWidth: 220 }}
              {...inviteEmailInputProps}
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
              const isCurrentUser = member.user_id === currentUserId;

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
                          onClick={() => onRemoveMember(member)}
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
  );
}
