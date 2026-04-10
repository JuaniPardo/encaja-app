"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginValues } from "@/features/auth/schemas";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

function getSafeNextPath(pathname: string | null) {
  if (!pathname || !pathname.startsWith("/app")) {
    return "/app";
  }

  return pathname;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos iniciar sesión",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Bienvenido",
      message: "Sesión iniciada correctamente.",
    });

    const nextPath = getSafeNextPath(searchParams.get("next"));
    router.replace(nextPath);
  });

  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2}>Ingresar</Title>
        <Text c="dimmed" size="sm">
          Entrá a Encaja para administrar tu presupuesto familiar.
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              placeholder="nombre@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label="Contraseña"
              placeholder="********"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" loading={isSubmitting}>
              Iniciar sesión
            </Button>
          </Stack>
        </form>

        <Text size="sm" c="dimmed">
          ¿Todavía no tenés cuenta?{" "}
          <Anchor component={Link} href="/register">
            Registrate
          </Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}

function LoginPageFallback() {
  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2}>Ingresar</Title>
        <Text c="dimmed" size="sm">
          Cargando formulario...
        </Text>
      </Stack>
    </Paper>
  );
}
