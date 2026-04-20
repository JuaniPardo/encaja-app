import Link from "next/link";
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";

import type { TranslationFn } from "@/features/dashboard/types/dashboard";

type DashboardOnboardingCtaCardProps = {
  onboardingHref: string;
  demoWorkspaceHref: string | null;
  hasDemoWorkspace: boolean;
  canCreateDemoWorkspace: boolean;
  isCreatingDemoWorkspace: boolean;
  onCreateDemoWorkspace: () => void;
  t: TranslationFn;
};

export function DashboardOnboardingCtaCard({
  onboardingHref,
  demoWorkspaceHref,
  hasDemoWorkspace,
  canCreateDemoWorkspace,
  isCreatingDemoWorkspace,
  onCreateDemoWorkspace,
  t,
}: DashboardOnboardingCtaCardProps) {
  return (
    <Paper
      radius="sm"
      p="md"
      style={{
        border: "1px solid #a5d8ff",
        background:
          "linear-gradient(135deg, rgba(232, 244, 255, 0.95) 0%, rgba(230, 250, 255, 0.9) 100%)",
        boxShadow: "0 8px 20px rgba(12, 74, 110, 0.08)",
      }}
    >
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={3} size="h4" c="#1f2937">
            {t("dashboard.gettingStarted.title")}
          </Title>
          <Text size="sm" c="#334155">
            {t("dashboard.gettingStarted.description")}
          </Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Button component={Link} href={onboardingHref} variant="default" radius="md">
            {t("dashboard.gettingStarted.guideCta")}
          </Button>
          {hasDemoWorkspace && demoWorkspaceHref ? (
            <Button component={Link} href={demoWorkspaceHref} color="blue" radius="md">
              {t("dashboard.gettingStarted.openDemoWorkspace")}
            </Button>
          ) : null}
          {!hasDemoWorkspace && canCreateDemoWorkspace ? (
            <Button color="blue" radius="md" onClick={onCreateDemoWorkspace} loading={isCreatingDemoWorkspace}>
              {t("dashboard.gettingStarted.createDemoWorkspace")}
            </Button>
          ) : null}
        </Group>

        {hasDemoWorkspace ? (
          <Text size="xs" c="dimmed">
            {t("dashboard.gettingStarted.demoWorkspaceExists")}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
