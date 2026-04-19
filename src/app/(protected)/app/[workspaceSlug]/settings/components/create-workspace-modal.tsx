"use client";

import type { FormEventHandler } from "react";
import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import type { UseFormRegisterReturn } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";

type CreateWorkspaceModalProps = {
  opened: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCreateDemoWorkspace: () => void;
  nameInputProps: UseFormRegisterReturn;
  nameError?: string;
  isSubmitting: boolean;
  isCreatingDemoWorkspace: boolean;
};

export function CreateWorkspaceModal({
  opened,
  onClose,
  onSubmit,
  onCreateDemoWorkspace,
  nameInputProps,
  nameError,
  isSubmitting,
  isCreatingDemoWorkspace,
}: CreateWorkspaceModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("workspaceSettings.modals.createWorkspace.title")}
      centered
    >
      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <TextInput
            label={t("workspaceSettings.forms.workspaceDisplayName")}
            placeholder={t("workspaceSettings.forms.workspaceDisplayNamePlaceholderLong")}
            error={nameError}
            {...nameInputProps}
          />
          <Group justify="flex-end">
            <Button type="button" variant="light" color="gray" onClick={onClose}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              variant="light"
              color="blue"
              onClick={onCreateDemoWorkspace}
              loading={isCreatingDemoWorkspace}
              disabled={isSubmitting}
            >
              {t("workspaceSettings.modals.createWorkspace.createDemoButton")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("common.actions.create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
