"use client";

import { Button, Center, Paper, Stack, Text } from "@mantine/core";
import type { ErrorInfo } from "next/error";

import { useI18n } from "@/features/i18n/provider";

export default function ProtectedError({ retry }: Pick<ErrorInfo, "retry">) {
  const { t } = useI18n();

  return (
    <Center h="100vh" p="md">
      <Paper withBorder radius="md" p="lg" maw={480}>
        <Stack gap="sm">
          <Text fw={600}>{t("workspace.sessionErrorTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("workspace.sessionUnavailable")}
          </Text>
          <Button onClick={() => retry()}>{t("common.actions.retry")}</Button>
        </Stack>
      </Paper>
    </Center>
  );
}
