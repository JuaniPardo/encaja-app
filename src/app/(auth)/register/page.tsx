"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

import { registerSchema, type RegisterValues } from "@/features/auth/schemas";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { bootstrapUserWorkspace } from "@/lib/workspace/bootstrap";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName?.trim() || null,
        },
      },
    });

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos crear la cuenta",
        message: response.error.message,
      });
      return;
    }

    if (!response.data.user || !response.data.session) {
      notifications.show({
        color: "blue",
        title: "Cuenta creada",
        message: "Revisá tu email para confirmar la cuenta y luego ingresá.",
      });
      router.replace("/login");
      return;
    }

    try {
      await bootstrapUserWorkspace({
        supabase,
        user: response.data.user,
        fullNameHint: values.fullName,
      });
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No pudimos preparar tu workspace",
        message:
          error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado durante el bootstrap.",
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Cuenta creada",
      message: "Tu workspace inicial ya está listo.",
    });

    router.replace("/app");
  });

  return (
    <Paper radius="lg" p="xl" withBorder shadow="sm">
      <Stack gap="md">
        <Title order={2}>Crear cuenta</Title>
        <Text c="dimmed" size="sm">
          Registrate para iniciar tu espacio de gestión financiera.
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Nombre (opcional)"
              placeholder="Juan"
              autoComplete="name"
              error={errors.fullName?.message}
              {...register("fullName")}
            />

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
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" loading={isSubmitting}>
              Crear cuenta
            </Button>
          </Stack>
        </form>

        <Text size="sm" c="dimmed">
          ¿Ya tenés cuenta?{" "}
          <Anchor component={Link} href="/login">
            Ingresá
          </Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}
