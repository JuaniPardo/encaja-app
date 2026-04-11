"use client";

import Link from "next/link";
import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";

export default function DashboardPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed" maw={720}>
        Este espacio es el punto de partida del MVP1. Desde acá podés gestionar tus
        categorías, presupuesto mensual, transacciones, medios de pago y configuración general
        del workspace.
      </Text>

      <Group align="stretch">
        <Card withBorder radius="md" miw={240}>
          <Stack gap="sm">
            <Title order={4}>Presupuesto mensual</Title>
            <Text size="sm" c="dimmed">
              Planificá montos por categoría para cada mes.
            </Text>
            <Button component={Link} href="/app/budget" variant="light">
              Ir a presupuesto
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" miw={240}>
          <Stack gap="sm">
            <Title order={4}>Categorías</Title>
            <Text size="sm" c="dimmed">
              Definí cómo clasificar ingresos, gastos y ahorro.
            </Text>
            <Button component={Link} href="/app/categories" variant="light">
              Ir a categorías
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" miw={240}>
          <Stack gap="sm">
            <Title order={4}>Transacciones</Title>
            <Text size="sm" c="dimmed">
              Registrá movimientos reales por tipo, categoría y fecha.
            </Text>
            <Button component={Link} href="/app/transactions" variant="light">
              Ir a transacciones
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" miw={240}>
          <Stack gap="sm">
            <Title order={4}>Medios de pago</Title>
            <Text size="sm" c="dimmed">
              Configurá efectivo, débito, crédito y otros medios.
            </Text>
            <Button component={Link} href="/app/payment-methods" variant="light">
              Ir a medios de pago
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" miw={240}>
          <Stack gap="sm">
            <Title order={4}>Settings</Title>
            <Text size="sm" c="dimmed">
              Ajustá los parámetros financieros base del workspace.
            </Text>
            <Button component={Link} href="/app/settings" variant="light">
              Ir a settings
            </Button>
          </Stack>
        </Card>
      </Group>
    </Stack>
  );
}
