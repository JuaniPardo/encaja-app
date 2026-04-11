"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Tooltip,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";

import { useWorkspace } from "@/features/workspace/workspace-provider";

const navItems = [
  {
    href: "/app",
    label: "Resumen",
    icon: (
      <ShellIcon>
        <path d="M3 10.2 12 4l9 6.2v8.3a1 1 0 0 1-1 1h-5.8v-5.5H9.8v5.5H4a1 1 0 0 1-1-1v-8.3Z" />
      </ShellIcon>
    ),
  },
  {
    href: "/app/budget",
    label: "Presupuesto",
    icon: (
      <ShellIcon>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 14h3" />
      </ShellIcon>
    ),
  },
  {
    href: "/app/transactions",
    label: "Transacciones",
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
    href: "/app/categories",
    label: "Categorías",
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
    href: "/app/payment-methods",
    label: "Medios de pago",
    icon: (
      <ShellIcon>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <path d="M2.5 10h19" />
        <path d="M6 14h4" />
      </ShellIcon>
    ),
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: (
      <ShellIcon>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
      </ShellIcon>
    ),
  },
];

function isActivePath(currentPath: string, href: string) {
  if (href === "/app") {
    return currentPath === href;
  }

  return currentPath.startsWith(href);
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

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle }] = useDisclosure(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { workspace, user, signOut } = useWorkspace();

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{
        width: desktopCollapsed ? 76 : 280,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ActionIcon
              variant="light"
              color="gray"
              size="sm"
              visibleFrom="sm"
              aria-label={desktopCollapsed ? "Expandir menú" : "Colapsar menú"}
              onClick={() => setDesktopCollapsed((prev) => !prev)}
            >
              <Text size="sm" fw={700}>
                {desktopCollapsed ? "›" : "‹"}
              </Text>
            </ActionIcon>
            <Box>
              <Title order={3}>Encaja</Title>
              <Text size="xs" c="dimmed">
                {workspace.name}
              </Text>
            </Box>
          </Group>

          <Group gap="sm" visibleFrom="sm">
            <Text size="sm" c="dimmed">
              {user.email}
            </Text>
            <Button size="xs" variant="light" color="gray" onClick={() => void signOut()}>
              Salir
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap={6}>
          {navItems.map((item) => (
            <Tooltip
              key={item.href}
              label={item.label}
              disabled={!desktopCollapsed}
              position="right"
              withArrow
            >
              <UnstyledButton
                component={Link}
                href={item.href}
                onClick={() => {
                  if (opened) {
                    toggle();
                  }
                }}
                style={{
                  width: "100%",
                  padding: desktopCollapsed ? "10px 0" : "10px 12px",
                  borderRadius: 8,
                  display: "block",
                  backgroundColor: isActivePath(pathname, item.href) ? "#e8f3ff" : "transparent",
                  color: isActivePath(pathname, item.href) ? "#1f6feb" : "#475467",
                }}
              >
                <Group gap={10} justify={desktopCollapsed ? "center" : "flex-start"} wrap="nowrap">
                  <Box>{item.icon}</Box>
                  {!desktopCollapsed ? (
                    <Text size="sm" fw={600}>
                      {item.label}
                    </Text>
                  ) : null}
                </Group>
              </UnstyledButton>
            </Tooltip>
          ))}
        </Stack>

        <Box mt="xl">
          <Button
            variant="subtle"
            color="gray"
            hiddenFrom="sm"
            onClick={() => void signOut()}
            fullWidth
          >
            Cerrar sesión
          </Button>

          <Tooltip label="Salir" disabled={!desktopCollapsed} position="right" withArrow>
            <UnstyledButton
              visibleFrom="sm"
              onClick={() => void signOut()}
              style={{
                width: "100%",
                padding: desktopCollapsed ? "10px 0" : "10px 12px",
                borderRadius: 8,
                color: "#475467",
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
                    Salir
                  </Text>
                ) : null}
              </Group>
            </UnstyledButton>
          </Tooltip>
        </Box>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="xl" py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
