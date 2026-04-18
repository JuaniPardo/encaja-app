"use client";

import type { FormEventHandler } from "react";
import { Alert, Badge, Button, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { Controller, type Control } from "react-hook-form";

import { useI18n } from "@/features/i18n/provider";
import type { WorkspaceLinkFormInputValues } from "@/features/workspace/links-schema";

import type { WorkspaceLinkSummary } from "../types";

type WorkspaceLinkOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type WorkspaceLinksSectionProps = {
  canManageLinks: boolean;
  canUseMultiWorkspace: boolean;
  sourceWorkspaceCurrency: string;
  onSubmitWorkspaceLink: FormEventHandler<HTMLFormElement>;
  workspaceLinkControl: Control<WorkspaceLinkFormInputValues>;
  workspaceLinkError?: string;
  workspaceLinkTargetOptions: WorkspaceLinkOption[];
  isWorkspaceLinkSubmitting: boolean;
  isWorkspaceCurrenciesLoading: boolean;
  canCreateAnyWorkspaceLink: boolean;
  isWorkspaceLinksLoading: boolean;
  workspaceLinks: WorkspaceLinkSummary[];
  deactivatingLinkId: string | null;
  onDeactivateWorkspaceLink: (workspaceLink: WorkspaceLinkSummary) => void;
};

export function WorkspaceLinksSection({
  canManageLinks,
  canUseMultiWorkspace,
  sourceWorkspaceCurrency,
  onSubmitWorkspaceLink,
  workspaceLinkControl,
  workspaceLinkError,
  workspaceLinkTargetOptions,
  isWorkspaceLinkSubmitting,
  isWorkspaceCurrenciesLoading,
  canCreateAnyWorkspaceLink,
  isWorkspaceLinksLoading,
  workspaceLinks,
  deactivatingLinkId,
  onDeactivateWorkspaceLink,
}: WorkspaceLinksSectionProps) {
  const { t } = useI18n();

  const activeWorkspaceLinksCount = workspaceLinks.filter((workspaceLink) => workspaceLink.is_active)
    .length;

  return (
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
          <Alert color="blue" variant="light" title={t("workspaceSettings.workspaceLinks.noAdminTitle")}>
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
                  error={workspaceLinkError}
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

        {canUseMultiWorkspace && canManageLinks && !isWorkspaceCurrenciesLoading && !canCreateAnyWorkspaceLink ? (
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
                        <Badge variant="light" color={workspaceLink.is_active ? "cyan" : "gray"}>
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
                            onClick={() => onDeactivateWorkspaceLink(workspaceLink)}
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
  );
}
