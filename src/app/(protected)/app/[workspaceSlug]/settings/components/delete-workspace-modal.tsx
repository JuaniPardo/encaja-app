"use client";

import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";

import { useI18n } from "@/features/i18n/provider";

type DeleteWorkspaceModalProps = {
  opened: boolean;
  onClose: () => void;
  workspaceName: string;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  isDeleting: boolean;
  onConfirmDelete: () => void;
};

export function DeleteWorkspaceModal({
  opened,
  onClose,
  workspaceName,
  confirmation,
  onConfirmationChange,
  isDeleting,
  onConfirmDelete,
}: DeleteWorkspaceModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("workspaceSettings.modals.deleteWorkspace.title")}
      centered
    >
      <Stack gap="sm">
        <Alert
          color="red"
          variant="light"
          title={t("workspaceSettings.modals.deleteWorkspace.irreversibleTitle")}
        >
          {t("workspaceSettings.modals.deleteWorkspace.irreversibleBody")}
        </Alert>
        <Text size="sm">
          {t("workspaceSettings.modals.deleteWorkspace.confirmPrompt", undefined, {
            workspaceName,
          })}
        </Text>
        <TextInput
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.currentTarget.value)}
          placeholder={workspaceName}
        />
        <Group justify="flex-end">
          <Button
            type="button"
            variant="light"
            color="gray"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            color="red"
            loading={isDeleting}
            disabled={confirmation.trim() !== workspaceName.trim()}
            onClick={onConfirmDelete}
          >
            {t("workspaceSettings.modals.deleteWorkspace.confirmButton")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
