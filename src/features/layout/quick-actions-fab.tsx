"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionIcon, Button, Stack, Transition } from "@mantine/core";
import { useMemo, useState } from "react";

import { useI18n } from "@/features/i18n/provider";
import { buildWorkspaceHref, getWorkspaceScopedSectionPath } from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";

const hiddenSections = ["/transactions", "/settings", "/profile"];

function shouldShowFab(sectionPath: string) {
  return !hiddenSections.some((path) => sectionPath === path || sectionPath.startsWith(`${path}/`));
}

export function QuickActionsFab() {
  const pathname = usePathname();
  const { workspace } = useWorkspace();
  const { t } = useI18n();
  const [opened, setOpened] = useState(false);

  const sectionPath = getWorkspaceScopedSectionPath(pathname ?? "");
  const isVisible = shouldShowFab(sectionPath);

  const transactionHref = useMemo(() => {
    const params = new URLSearchParams({
      new: "1",
      prefillType: "expense",
    });

    return `${buildWorkspaceHref(workspace.slug, "/transactions")}?${params.toString()}`;
  }, [workspace.slug]);

  const transferHref = useMemo(() => {
    const params = new URLSearchParams({
      newTransfer: "1",
    });

    return `${buildWorkspaceHref(workspace.slug, "/transactions")}?${params.toString()}`;
  }, [workspace.slug]);

  if (!isVisible) {
    return null;
  }

  return (
    <Stack
      gap="xs"
      align="flex-end"
      style={{
        position: "fixed",
        right: 18,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
        zIndex: 55,
      }}
    >
      <Transition mounted={opened} transition="pop-bottom-right" duration={160} timingFunction="ease">
        {(styles) => (
          <Stack gap={8} style={styles}>
            <Button
              component={Link}
              href={transferHref}
              radius="xl"
              color="gray"
              variant="light"
              onClick={() => setOpened(false)}
            >
              {t("common.quickActions.transfer")}
            </Button>
            <Button
              component={Link}
              href={transactionHref}
              radius="xl"
              color="cyan"
              onClick={() => setOpened(false)}
            >
              {t("common.quickActions.transaction")}
            </Button>
          </Stack>
        )}
      </Transition>

      <ActionIcon
        size={56}
        radius="xl"
        variant="filled"
        color="cyan"
        onClick={() => setOpened((previous) => !previous)}
        aria-label={opened ? t("common.quickActions.close") : t("common.quickActions.open")}
        style={{
          boxShadow: "0 14px 26px rgba(8, 127, 91, 0.28)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: opened ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 150ms ease" }}
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </ActionIcon>
    </Stack>
  );
}
