"use client";

import { useEffect } from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";

import { useI18n } from "@/features/i18n/provider";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";

export default function WorkspaceEntryPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { workspace } = useWorkspace();

  useEffect(() => {
    router.replace(buildWorkspaceHref(workspace.slug));
  }, [router, workspace.slug]);

  return (
    <Center h="70vh">
      <Stack align="center" gap="xs">
        <Loader size="md" />
        <Text size="sm" c="dimmed">
          {t("workspace.openWorkspace")}
        </Text>
      </Stack>
    </Center>
  );
}
