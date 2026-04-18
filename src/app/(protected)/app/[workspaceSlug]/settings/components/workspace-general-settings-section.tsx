"use client";

import type { FormEventHandler } from "react";
import { Button, Checkbox, Divider, Group, NativeSelect, Paper, Stack, Text, TextInput } from "@mantine/core";
import type { UseFormRegisterReturn } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";

type SelectOption = {
  value: string;
  label: string;
};

type WorkspaceGeneralSettingsSectionProps = {
  canEditWorkspaceSettings: boolean;
  canCreateWorkspace: boolean;
  onOpenCreateWorkspace: () => void;
  onSubmitWorkspace: FormEventHandler<HTMLFormElement>;
  workspaceNameInputProps: UseFormRegisterReturn;
  workspaceNameError?: string;
  isWorkspaceSubmitting: boolean;
  onSubmitSettings: FormEventHandler<HTMLFormElement>;
  workspaceCurrencyOptions: SelectOption[];
  currencyInputProps: UseFormRegisterReturn;
  currencyError?: string;
  showCents: boolean;
  onShowCentsChange: (checked: boolean) => void;
  savingsRateModeSelectData: SelectOption[];
  savingsModeInputProps: UseFormRegisterReturn;
  savingsModeError?: string;
  isSettingsSubmitting: boolean;
  onReloadSettings: () => void;
};

export function WorkspaceGeneralSettingsSection({
  canEditWorkspaceSettings,
  canCreateWorkspace,
  onOpenCreateWorkspace,
  onSubmitWorkspace,
  workspaceNameInputProps,
  workspaceNameError,
  isWorkspaceSubmitting,
  onSubmitSettings,
  workspaceCurrencyOptions,
  currencyInputProps,
  currencyError,
  showCents,
  onShowCentsChange,
  savingsRateModeSelectData,
  savingsModeInputProps,
  savingsModeError,
  isSettingsSubmitting,
  onReloadSettings,
}: WorkspaceGeneralSettingsSectionProps) {
  const { t } = useI18n();

  return (
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
                <Button variant="subtle" size="xs" onClick={onOpenCreateWorkspace}>
                  {t("workspaceSettings.identity.createWorkspaceButton")}
                </Button>
              ) : null}
            </Group>
            <TextInput
              label={t("workspaceSettings.forms.workspaceDisplayName")}
              placeholder={t("workspaceSettings.forms.workspaceDisplayNamePlaceholderShort")}
              disabled={!canEditWorkspaceSettings}
              error={workspaceNameError}
              {...workspaceNameInputProps}
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

        <form onSubmit={onSubmitSettings}>
          <Stack gap="sm">
            <NativeSelect
              label={t("workspaceSettings.forms.currency")}
              data={workspaceCurrencyOptions}
              disabled={!canEditWorkspaceSettings}
              error={currencyError}
              {...currencyInputProps}
            />
            <Text size="xs" c="dimmed">
              {t("workspaceSettings.forms.currencyDescription")}
            </Text>

            <Checkbox
              checked={showCents}
              disabled={!canEditWorkspaceSettings}
              onChange={(event) => onShowCentsChange(event.currentTarget.checked)}
              label={t("workspaceSettings.forms.showCents")}
            />
            <Text size="xs" c="dimmed">
              {t("workspaceSettings.forms.showCentsDescription")}
            </Text>

            <NativeSelect
              label={t("workspaceSettings.forms.savingsMode")}
              data={savingsRateModeSelectData}
              disabled={!canEditWorkspaceSettings}
              error={savingsModeError}
              {...savingsModeInputProps}
            />

            <Group justify="flex-end">
              <Button
                type="button"
                variant="light"
                color="gray"
                onClick={onReloadSettings}
                disabled={!canEditWorkspaceSettings}
              >
                {t("workspaceSettings.forms.revertButton")}
              </Button>
              <Button
                type="submit"
                loading={isSettingsSubmitting}
                disabled={!canEditWorkspaceSettings}
              >
                {t("workspaceSettings.forms.saveSettingsButton")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
