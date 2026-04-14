"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Container,
  Divider,
  Group,
  NativeSelect,
  Stack,
  Text,
  Tooltip,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";

import { useI18n } from "@/features/i18n/provider";
import {
  buildWorkspaceHref,
  getWorkspaceScopedSectionPath,
  stripWorkspaceSlugFromPathname,
} from "@/features/workspace/routing";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { ROUTES } from "@/lib/routes";
import type { WorkspaceRole } from "@/types/database";

type NavSection = "primary" | "secondary";

interface NavItem {
  section: NavSection;
  sectionPath: string;
  labelKey: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    section: "primary",
    sectionPath: "",
    labelKey: "nav.summary",
    icon: (
      <ShellIcon>
        <path d="M3 10.2 12 4l9 6.2v8.3a1 1 0 0 1-1 1h-5.8v-5.5H9.8v5.5H4a1 1 0 0 1-1-1v-8.3Z" />
      </ShellIcon>
    ),
  },
  {
    section: "primary",
    sectionPath: "/transactions",
    labelKey: "nav.transactions",
    icon: (
      <ShellIcon>
        <path d="M4 8h10" />
        <path d="m11 5 3 3-3 3" />
        <path d="M20 16H10" />
        <path d="m13 13-3 3 3 3" />
      </ShellIcon>
    ),
  },
  {
    section: "primary",
    sectionPath: "/budget",
    labelKey: "nav.budget",
    icon: (
      <ShellIcon>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 14h3" />
      </ShellIcon>
    ),
  },
  {
    section: "primary",
    sectionPath: "/categories",
    labelKey: "nav.categories",
    icon: (
      <ShellIcon>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </ShellIcon>
    ),
  },
  {
    section: "primary",
    sectionPath: "/payment-methods",
    labelKey: "nav.paymentMethods",
    icon: (
      <ShellIcon>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <path d="M2.5 10h19" />
        <path d="M6 14h4" />
      </ShellIcon>
    ),
  },
  {
    section: "secondary",
    sectionPath: "/start",
    labelKey: "nav.start",
    icon: (
      <ShellIcon>
        <path d="M4 6h16" />
        <path d="M4 12h10" />
        <path d="M4 18h7" />
        <path d="m17 14 3 3-3 3" />
      </ShellIcon>
    ),
  },
  {
    section: "secondary",
    sectionPath: "/insights",
    labelKey: "nav.insights",
    icon: (
      <ShellIcon>
        <path d="M4 18V8" />
        <path d="M10 18V4" />
        <path d="M16 18v-6" />
        <path d="M22 18V10" />
      </ShellIcon>
    ),
  },
  {
    section: "secondary",
    sectionPath: "/settings",
    labelKey: "nav.settings",
    icon: (
      <ShellIcon>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
      </ShellIcon>
    ),
  },
  {
    section: "secondary",
    sectionPath: ROUTES.PROFILE,
    labelKey: "profile.navButton",
    icon: (
      <ShellIcon>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.4-2.7 3.8-4 7-4s5.6 1.3 7 4" />
      </ShellIcon>
    ),
  },
];

function isActivePath(currentPath: string, navPath: string) {
  if (navPath === "/app") {
    return currentPath === "/app";
  }

  return currentPath === navPath || currentPath.startsWith(`${navPath}/`);
}

function ShellIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function formatRoleLabel(role: WorkspaceRole, t: (key: string, fallback?: string) => string) {
  return role === "owner" ? t("common.role.owner", "owner") : t("common.role.member", "member");
}

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const { t } = useI18n();
  const { workspace, workspaces, user, switchWorkspace, signOut } = useWorkspace();
  const sectionPath = getWorkspaceScopedSectionPath(pathname ?? "");
  const pathWithoutWorkspace = stripWorkspaceSlugFromPathname(pathname ?? "/app");
  const workspaceSelectData = useMemo(
    () =>
      workspaces.map((item) => ({
        value: item.slug,
        label: `${item.name} · ${formatRoleLabel(item.role, t)}`,
      })),
    [t, workspaces],
  );
  const primaryNavItems = useMemo(
    () => navItems.filter((item) => item.section === "primary"),
    [],
  );
  const secondaryNavItems = useMemo(
    () => navItems.filter((item) => item.section === "secondary"),
    [],
  );

  useEffect(() => {
    close();
  }, [pathname, close]);

  const renderNavItem = (item: NavItem) => {
    const navPath = buildWorkspaceHref(workspace.slug, item.sectionPath);
    const activePath = item.sectionPath ? `/app${item.sectionPath}` : "/app";
    const isActive = isActivePath(pathWithoutWorkspace, activePath);
    const itemLabel = t(item.labelKey);

    return (
      <Tooltip
        key={item.sectionPath || "/"}
        label={itemLabel}
        disabled={!desktopCollapsed}
        position="right"
        withArrow
      >
        <UnstyledButton
          component={Link}
          href={navPath}
          onClick={() => {
            if (opened) {
              close();
            }
          }}
          style={{
            width: "100%",
            padding: desktopCollapsed ? "10px 0" : isMobile ? "10px 10px" : "11px 12px",
            borderRadius: 8,
            display: "block",
            backgroundColor: isActive ? "#dff3ea" : "transparent",
            border: `1px solid ${isActive ? "#9fd7bf" : "transparent"}`,
            color: isActive ? "#087f5b" : "#475467",
            boxShadow: isActive ? "inset 3px 0 0 #0ca678" : "none",
          }}
        >
          <Group
            gap={10}
            justify={desktopCollapsed ? "center" : "flex-start"}
            wrap="nowrap"
          >
            <Box pos="relative">
              {item.icon}
              {desktopCollapsed && isActive ? (
                <Box
                  h={6}
                  w={6}
                  style={{
                    borderRadius: "50%",
                    backgroundColor: "#0ca678",
                    position: "absolute",
                    right: -4,
                    top: -2,
                  }}
                />
              ) : null}
            </Box>
            {!desktopCollapsed ? (
              <Text size={isMobile ? "xs" : "sm"} fw={isActive ? 700 : 600}>
                {itemLabel}
              </Text>
            ) : null}
          </Group>
        </UnstyledButton>
      </Tooltip>
    );
  };

  return (
    <AppShell
      header={{ height: { base: 58, sm: 66 } }}
      navbar={{
        width: { base: 236, sm: desktopCollapsed ? 74 : 256 },
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding={{ base: "xs", sm: "md" }}
    >
      <AppShell.Header
        style={{
          borderBottom: "1px solid #e4e7ec",
          backgroundColor: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
        }}
      >
          <Group h="100%" px={isMobile ? "xs" : "md"} justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <ActionIcon
                variant="light"
                color="gray"
                size="sm"
                visibleFrom="sm"
                aria-label={
                  desktopCollapsed ? t("nav.expandMenu", "Expand menu") : t("nav.collapseMenu", "Collapse menu")
                }
                onClick={() => setDesktopCollapsed((prev) => !prev)}
              >
                <Text size="sm" fw={700}>
                  {desktopCollapsed ? "›" : "‹"}
                </Text>
              </ActionIcon>
              <Box>
                <Title order={isMobile ? 4 : 3}>Encaja</Title>
                {workspaces.length > 1 ? (
                  <NativeSelect
                    value={workspace.slug}
                    onChange={(event) => {
                      const nextSlug = event.currentTarget.value;
                      if (nextSlug && nextSlug !== workspace.slug) {
                        switchWorkspace(nextSlug, sectionPath);
                      }
                    }}
                    data={workspaceSelectData}
                    size="xs"
                    maw={220}
                  />
                ) : (
                  <Text size="xs" c="dimmed">
                    {workspace.name}
                  </Text>
                )}
              </Box>
            </Group>

            <Group gap="sm" visibleFrom="sm">
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
            </Group>
          </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p={isMobile ? "xs" : "sm"}
        style={{
          borderRight: "1px solid #e4e7ec",
          backgroundColor: "#f9fbfa",
        }}
      >
        <Stack gap={isMobile ? 3 : 4}>
            {primaryNavItems.map(renderNavItem)}
            {secondaryNavItems.length > 0 ? (
              <>
                {!desktopCollapsed ? (
                  <Text
                    size="xs"
                    fw={700}
                    c="gray.6"
                    px={isMobile ? 10 : 12}
                    pt={isMobile ? 8 : 10}
                    style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}
                  >
                    {t("nav.more", "Más")}
                  </Text>
                ) : null}
                <Divider
                  my={desktopCollapsed ? (isMobile ? 4 : 6) : 0}
                  mt={!desktopCollapsed ? 4 : undefined}
                  mb={!desktopCollapsed ? (isMobile ? 4 : 6) : undefined}
                  color="gray.3"
                />
                {secondaryNavItems.map(renderNavItem)}
              </>
            ) : null}
        </Stack>

        <Box mt="auto" pt={desktopCollapsed ? "sm" : "lg"}>
            <Tooltip
              label={t("workspace.signOutTooltip", "Sign out")}
              disabled={!desktopCollapsed}
              position="right"
              withArrow
            >
              <UnstyledButton
                onClick={() => {
                  if (opened) {
                    close();
                  }

                  void signOut();
                }}
                style={{
                  width: "100%",
                  padding: desktopCollapsed ? "11px 0" : "11px 12px",
                  borderRadius: 8,
                  color: "#475467",
                  border: "1px solid transparent",
                }}
              >
                <Group gap={10} justify={desktopCollapsed ? "center" : "flex-start"} wrap="nowrap">
                  <ShellIcon>
                    <path d="M15 7.5V5.8a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v12.4a2 2 0 0 0 2 2H13a2 2 0 0 0 2-2v-1.7" />
                    <path d="M10 12h10" />
                    <path d="m17 8 3 4-3 4" />
                  </ShellIcon>
                  {!desktopCollapsed ? (
                    <Text size="sm" fw={600}>
                      {t("common.actions.signOut", "Sign out")}
                    </Text>
                  ) : null}
                </Group>
              </UnstyledButton>
            </Tooltip>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" py={isMobile ? "xs" : "md"}>
          {children}
          <Box component="footer" mt={isMobile ? 36 : 56} pb={isMobile ? "sm" : "md"}>
            <Text size="xs" c="gray.5" fw={400} ta="center">
              Built by Juan Pardo
            </Text>
          </Box>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
