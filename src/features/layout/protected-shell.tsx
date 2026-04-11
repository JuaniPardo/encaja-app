"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppShell,
  Box,
  Burger,
  Button,
  Container,
  Group,
  NavLink,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { useWorkspace } from "@/features/workspace/workspace-provider";

const navItems = [
  { href: "/app", label: "Resumen" },
  { href: "/app/budget", label: "Presupuesto" },
  { href: "/app/transactions", label: "Transacciones" },
  { href: "/app/categories", label: "Categorías" },
  { href: "/app/payment-methods", label: "Medios de pago" },
  { href: "/app/settings", label: "Settings" },
];

function isActivePath(currentPath: string, href: string) {
  if (href === "/app") {
    return currentPath === href;
  }

  return currentPath.startsWith(href);
}

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle }] = useDisclosure(false);
  const { workspace, user, signOut } = useWorkspace();

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{ width: 290, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
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
        <Stack gap={4}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              active={isActivePath(pathname, item.href)}
              onClick={toggle}
            />
          ))}
        </Stack>

        <Button mt="xl" variant="subtle" color="gray" hiddenFrom="sm" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
