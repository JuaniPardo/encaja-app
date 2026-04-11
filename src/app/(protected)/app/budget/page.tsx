"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useForm, useWatch } from "react-hook-form";

import {
  budgetFormSchema,
  type BudgetFormInputValues,
  type BudgetFormValues,
} from "@/features/budget/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type WorkspaceSettingsRow = Database["public"]["Tables"]["workspace_settings"]["Row"];
type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;
type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "amount"
>;

type CategorizedItem = {
  category: CategoryRow;
  index: number;
};

type GroupedCategories = Record<TransactionType, CategorizedItem[]>;

const typeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
};

const typeLabels: Record<TransactionType, string> = {
  income: "Ingresos",
  expense: "Gastos",
  saving: "Ahorro",
};

const typeColors: Record<TransactionType, string> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
};

const monthOptions = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

function parseAmountValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildPreviousPeriod(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

function monthLabel(month: number) {
  return monthOptions.find((option) => Number(option.value) === month)?.label ?? `Mes ${month}`;
}

export default function BudgetPage() {
  const { supabase, workspace, user } = useWorkspace();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const now = useMemo(() => new Date(), []);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [periodHasItems, setPeriodHasItems] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isPeriodLoading, setIsPeriodLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<BudgetFormInputValues, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      items: [],
    },
  });

  const watchedItems = useWatch({
    control,
    name: "items",
  });

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currencyCode]);

  const groupedCategories = useMemo<GroupedCategories>(() => {
    const grouped: GroupedCategories = {
      income: [],
      expense: [],
      saving: [],
    };

    categories.forEach((category, index) => {
      grouped[category.type].push({
        category,
        index,
      });
    });

    return grouped;
  }, [categories]);

  const totals = useMemo(() => {
    const subtotalByType: Record<TransactionType, number> = {
      income: 0,
      expense: 0,
      saving: 0,
    };

    const typeByCategoryId = new Map(categories.map((category) => [category.id, category.type]));

    for (const item of watchedItems ?? []) {
      if (!item) {
        continue;
      }

      const categoryType = typeByCategoryId.get(item.categoryId);
      if (!categoryType) {
        continue;
      }

      const parsedAmount = parseAmountValue(item.amount);
      if (parsedAmount === null) {
        continue;
      }

      subtotalByType[categoryType] += parsedAmount;
    }

    return {
      income: subtotalByType.income,
      expense: subtotalByType.expense,
      saving: subtotalByType.saving,
      assigned: subtotalByType.expense + subtotalByType.saving,
      balance: subtotalByType.income - (subtotalByType.expense + subtotalByType.saving),
    };
  }, [categories, watchedItems]);

  const roundedBalance = roundMoney(totals.balance);
  const isBalanced = Math.abs(roundedBalance) < 0.005;
  const balanceStatus = isBalanced
    ? "balanced"
    : roundedBalance > 0
      ? "remaining"
      : "overassigned";

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const initialYear = Math.min(startYear, selectedYear, currentYear - 1);
    const finalYear = Math.max(selectedYear, currentYear + 2);
    const options: Array<{ value: string; label: string }> = [];

    for (let year = finalYear; year >= initialYear; year -= 1) {
      options.push({
        value: String(year),
        label: String(year),
      });
    }

    return options;
  }, [selectedYear, startYear]);

  const loadBaseData = useCallback(async () => {
    setIsBootstrapping(true);

    const [categoriesResponse, settingsResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
    ]);

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar categorías activas",
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const categoryRows = (categoriesResponse.data ?? []) as CategoryRow[];
      const sortedCategories = [...categoryRows].sort((a: CategoryRow, b: CategoryRow) => {
        const typeDiff = typeOrder[a.type] - typeOrder[b.type];
        if (typeDiff !== 0) {
          return typeDiff;
        }

        const sortOrderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const sortOrderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (sortOrderA !== sortOrderB) {
          return sortOrderA - sortOrderB;
        }

        return a.name.localeCompare(b.name, "es");
      });

      setCategories(sortedCategories);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar settings del workspace",
        message: settingsResponse.error.message,
      });
      setStartYear(new Date().getFullYear());
      setCurrencyCode("ARS");
    } else {
      const settingsRow = settingsResponse.data as WorkspaceSettingsRow | null;
      setStartYear(settingsRow?.start_year ?? new Date().getFullYear());
      setCurrencyCode(settingsRow?.currency_code ?? "ARS");
    }

    setIsBootstrapping(false);
  }, [supabase, workspace.id]);

  const loadSelectedPeriod = useCallback(async () => {
    setIsPeriodLoading(true);

    const periodResponse = await supabase
      .from("budget_periods")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    if (periodResponse.error) {
      setIsPeriodLoading(false);
      notifications.show({
        color: "red",
        title: "No pudimos cargar el período",
        message: periodResponse.error.message,
      });
      return;
    }

    const periodRow = periodResponse.data as BudgetPeriodIdRow | null;

    if (!periodRow) {
      setPeriodId(null);
      setPeriodHasItems(false);
      reset({
        items: categories.map((category) => ({
          categoryId: category.id,
          amount: null,
        })),
      });
      setIsPeriodLoading(false);
      return;
    }

    const itemsResponse = await supabase
      .from("budget_items")
      .select("category_id, amount")
      .eq("budget_period_id", periodRow.id);

    if (itemsResponse.error) {
      setIsPeriodLoading(false);
      notifications.show({
        color: "red",
        title: "No pudimos cargar el presupuesto",
        message: itemsResponse.error.message,
      });
      return;
    }

    const periodItems = (itemsResponse.data ?? []) as BudgetItemLiteRow[];
    const amountByCategoryId = new Map(
      periodItems.map((item) => [item.category_id, parseAmountValue(item.amount)]),
    );

    reset({
      items: categories.map((category) => ({
        categoryId: category.id,
        amount: amountByCategoryId.get(category.id) ?? null,
      })),
    });

    setPeriodId(periodRow.id);
    setPeriodHasItems(periodItems.length > 0);
    setIsPeriodLoading(false);
  }, [categories, reset, selectedMonth, selectedYear, supabase, workspace.id]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    void loadSelectedPeriod();
  }, [isBootstrapping, loadSelectedPeriod]);

  const ensureBudgetPeriodExists = useCallback(async () => {
    if (periodId) {
      return periodId;
    }

    const insertResponse = await supabase
      .from("budget_periods")
      .insert({
        workspace_id: workspace.id,
        year: selectedYear,
        month: selectedMonth,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!insertResponse.error) {
      const insertedPeriod = insertResponse.data as BudgetPeriodIdRow;
      setPeriodId(insertedPeriod.id);
      return insertedPeriod.id;
    }

    if (insertResponse.error.code !== "23505") {
      throw insertResponse.error;
    }

    const existingPeriod = await supabase
      .from("budget_periods")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .single();

    if (existingPeriod.error) {
      throw existingPeriod.error;
    }

    const existingPeriodRow = existingPeriod.data as BudgetPeriodIdRow;
    setPeriodId(existingPeriodRow.id);
    return existingPeriodRow.id;
  }, [periodId, selectedMonth, selectedYear, supabase, user.id, workspace.id]);

  const onSubmit = handleSubmit(async (values) => {
    setIsSaving(true);

    try {
      const targetPeriodId = await ensureBudgetPeriodExists();

      const itemsWithAmount = values.items.reduce<
        Array<{
          budget_period_id: string;
          category_id: string;
          amount: number;
        }>
      >((accumulator, item) => {
        if (item.amount === null) {
          return accumulator;
        }

        accumulator.push({
          budget_period_id: targetPeriodId,
          category_id: item.categoryId,
          amount: roundMoney(item.amount),
        });

        return accumulator;
      }, []);

      const categoriesWithoutBudget = values.items
        .filter((item) => item.amount === null)
        .map((item) => item.categoryId);

      if (itemsWithAmount.length > 0) {
        const upsertResponse = await supabase.from("budget_items").upsert(itemsWithAmount, {
          onConflict: "budget_period_id,category_id",
        });

        if (upsertResponse.error) {
          throw upsertResponse.error;
        }
      }

      if (categoriesWithoutBudget.length > 0) {
        const deleteResponse = await supabase
          .from("budget_items")
          .delete()
          .eq("budget_period_id", targetPeriodId)
          .in("category_id", categoriesWithoutBudget);

        if (deleteResponse.error) {
          throw deleteResponse.error;
        }
      }

      notifications.show({
        color: "green",
        title: "Presupuesto guardado",
        message: `Guardamos el presupuesto de ${monthLabel(selectedMonth)} ${selectedYear}.`,
      });

      await loadSelectedPeriod();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No pudimos guardar el presupuesto",
        message: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  });

  const copyFromPreviousMonth = async () => {
    if (periodHasItems) {
      notifications.show({
        color: "red",
        title: "Período no elegible para copiar",
        message:
          "El período actual ya tiene ítems de presupuesto. Limpiá los ítems antes de copiar.",
      });
      return;
    }

    const previous = buildPreviousPeriod(selectedYear, selectedMonth);
    setIsCopying(true);

    try {
      const previousPeriodResponse = await supabase
        .from("budget_periods")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("year", previous.year)
        .eq("month", previous.month)
        .maybeSingle();

      if (previousPeriodResponse.error) {
        throw previousPeriodResponse.error;
      }

      const previousPeriodRow = previousPeriodResponse.data as BudgetPeriodIdRow | null;

      if (!previousPeriodRow) {
        notifications.show({
          color: "yellow",
          title: "No hay presupuesto previo",
          message: `No existe presupuesto para ${monthLabel(previous.month)} ${previous.year}.`,
        });
        return;
      }

      const previousItemsResponse = await supabase
        .from("budget_items")
        .select("category_id, amount")
        .eq("budget_period_id", previousPeriodRow.id);

      if (previousItemsResponse.error) {
        throw previousItemsResponse.error;
      }

      const activeCategoryIds = new Set(categories.map((category) => category.id));
      const previousItems = (previousItemsResponse.data ?? []) as BudgetItemLiteRow[];
      const copyRowsSource = previousItems.filter((item) =>
        activeCategoryIds.has(item.category_id),
      );

      if (copyRowsSource.length === 0) {
        notifications.show({
          color: "yellow",
          title: "No hay datos para copiar",
          message:
            "El período anterior no tiene ítems en categorías activas del workspace actual.",
        });
        return;
      }

      const targetPeriodId = await ensureBudgetPeriodExists();
      const copyRows = copyRowsSource.reduce<
        Array<{
          budget_period_id: string;
          category_id: string;
          amount: number;
        }>
      >((accumulator, item) => {
        const parsedAmount = parseAmountValue(item.amount);
        if (parsedAmount === null) {
          return accumulator;
        }

        accumulator.push({
          budget_period_id: targetPeriodId,
          category_id: item.category_id,
          amount: roundMoney(parsedAmount),
        });

        return accumulator;
      }, []);

      if (copyRows.length === 0) {
        notifications.show({
          color: "yellow",
          title: "No hay datos para copiar",
          message: "El período anterior no tiene montos válidos para copiar.",
        });
        return;
      }

      const copyResponse = await supabase.from("budget_items").upsert(copyRows, {
        onConflict: "budget_period_id,category_id",
      });

      if (copyResponse.error) {
        throw copyResponse.error;
      }

      notifications.show({
        color: "green",
        title: "Presupuesto copiado",
        message: `Copiamos los valores desde ${monthLabel(previous.month)} ${previous.year}.`,
      });

      await loadSelectedPeriod();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "No pudimos copiar el presupuesto",
        message: error instanceof Error ? error.message : "Ocurrió un error inesperado.",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const canCopyFromPrevious =
    categories.length > 0 && !isPeriodLoading && !isSaving && !periodHasItems;
  const selectedPeriodLabel = `${selectedYear} · ${monthLabel(selectedMonth)}`;

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isPeriodLoading} />

      <Stack gap={0}>
        <Title order={2}>Presupuesto mensual</Title>
        <Text size="xs" c="dimmed">
          Editá el presupuesto mensual por categoría con un resumen consolidado del resultado.
        </Text>
      </Stack>

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={600}>
              Período en edición
            </Text>
            <Badge variant="light" color="blue" size="sm">
              {selectedPeriodLabel}
            </Badge>
          </Group>

          <SimpleGrid cols={isMobile ? 2 : 3} spacing="xs">
            <NativeSelect
              label="Año"
              data={yearOptions}
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
              size="xs"
            />
            <NativeSelect
              label="Mes"
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
              size="xs"
            />

            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => void copyFromPreviousMonth()}
              loading={isCopying}
              disabled={!canCopyFromPrevious}
              mt={isMobile ? 0 : "auto"}
            >
              Copiar mes anterior
            </Button>
          </SimpleGrid>

          <Text size="xs" c="dimmed">
            {periodHasItems
              ? "Ya tiene montos guardados; copia deshabilitada."
              : "Copia montos del mes anterior en categorías activas."}
          </Text>
        </Stack>
      </Paper>

      {categories.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            No hay categorías activas. Creá al menos una categoría para cargar presupuesto.
          </Text>
        </Paper>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            {!periodId ? (
              <Alert color="blue" variant="light" py={8}>
                Este período todavía no tiene presupuesto guardado. Cargá montos y guardá para
                crearlo.
              </Alert>
            ) : null}

            <Stack gap={2}>
              <Text size="xs" fw={600}>
                Edición por categoría
              </Text>
              <Text size="xs" c="dimmed">
                Cargá montos directos por categoría. Dejá vacío un campo para quitar su monto.
              </Text>
            </Stack>

            {(Object.keys(groupedCategories) as TransactionType[]).map((typeKey) => (
              <Paper key={typeKey} withBorder radius="md" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Title order={5} c={typeColors[typeKey]}>
                      {typeLabels[typeKey]}
                    </Title>
                    <Badge variant="light" color={typeColors[typeKey]} size="sm">
                      {currencyFormatter.format(totals[typeKey])}
                    </Badge>
                  </Group>
                  {groupedCategories[typeKey].length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No hay categorías activas de este tipo.
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {groupedCategories[typeKey].map(({ category, index }) => (
                        <Paper key={category.id} withBorder radius="sm" p={isMobile ? 6 : 8}>
                          <Group justify="space-between" align="center" wrap="nowrap">
                            <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
                              {category.name}
                            </Text>
                            <input
                              type="hidden"
                              {...register(`items.${index}.categoryId` as const)}
                            />
                            <TextInput
                              aria-label={`Monto de ${category.name}`}
                              type="number"
                              step="0.01"
                              min="0"
                              size="sm"
                              placeholder="0"
                              error={errors.items?.[index]?.amount?.message}
                              rightSection={
                                <Text size="10px" c="dimmed" fw={500}>
                                  {currencyCode}
                                </Text>
                              }
                              rightSectionWidth={40}
                              rightSectionPointerEvents="none"
                              styles={{
                                input: {
                                  textAlign: "right",
                                  fontVariantNumeric: "tabular-nums",
                                  paddingTop: "0.3rem",
                                  paddingBottom: "0.3rem",
                                },
                              }}
                              style={{ width: isMobile ? 132 : 164 }}
                              {...register(`items.${index}.amount` as const)}
                            />
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}

            <Paper
              withBorder
              radius="lg"
              p="sm"
              style={{
                borderColor:
                  balanceStatus === "balanced"
                    ? "var(--mantine-color-teal-4)"
                    : balanceStatus === "remaining"
                      ? "var(--mantine-color-yellow-4)"
                      : "var(--mantine-color-pink-4)",
              }}
            >
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Stack gap={0}>
                    <Title order={4}>Resultado del período</Title>
                    <Text size="xs" c="dimmed">
                      Resumen de montos para {monthLabel(selectedMonth)} {selectedYear}.
                    </Text>
                  </Stack>
                  <Badge
                    color={
                      balanceStatus === "balanced"
                        ? "teal"
                        : balanceStatus === "remaining"
                          ? "yellow"
                          : "pink"
                    }
                    variant="filled"
                    size="sm"
                  >
                    {balanceStatus === "balanced"
                      ? "Balanceado"
                      : balanceStatus === "remaining"
                        ? "Falta asignar"
                        : "Sobreasignado"}
                  </Badge>
                </Group>

                <SimpleGrid cols={3} spacing="xs">
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Ingresos
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={`${typeColors.income}.7`}>
                      {currencyFormatter.format(totals.income)}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Gastos
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={`${typeColors.expense}.7`}>
                      {currencyFormatter.format(totals.expense)}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Ahorro
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={`${typeColors.saving}.7`}>
                      {currencyFormatter.format(totals.saving)}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder radius="md" p="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      Total asignado
                    </Text>
                    <Text fw={700} size="sm">
                      {currencyFormatter.format(totals.assigned)}
                    </Text>
                  </Group>
                </Paper>

                <Paper
                  withBorder
                  radius="md"
                  p="xs"
                  style={{
                    backgroundColor:
                      balanceStatus === "balanced"
                        ? "var(--mantine-color-teal-0)"
                        : balanceStatus === "remaining"
                          ? "var(--mantine-color-yellow-0)"
                          : "var(--mantine-color-pink-0)",
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Text fw={700} size="sm">
                      Balance final
                    </Text>
                    <Text
                      fw={800}
                      size={isMobile ? "sm" : "lg"}
                      c={
                        balanceStatus === "balanced"
                          ? "teal.7"
                          : balanceStatus === "remaining"
                            ? "yellow.8"
                            : "pink.7"
                      }
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {currencyFormatter.format(roundedBalance)}
                    </Text>
                  </Group>
                </Paper>

                <Alert
                  mt={1}
                  py={6}
                  color={
                    balanceStatus === "balanced"
                      ? "teal"
                      : balanceStatus === "remaining"
                        ? "yellow"
                        : "red"
                  }
                  variant={balanceStatus === "overassigned" ? "filled" : "light"}
                >
                  <Text size="xs">
                    {isBalanced
                      ? "Presupuesto balanceado."
                      : roundedBalance > 0
                        ? `Falta asignar ${currencyFormatter.format(roundedBalance)}.`
                        : `Sobreasignación de ${currencyFormatter.format(Math.abs(roundedBalance))}.`}
                  </Text>
                </Alert>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  Confirmá cambios del período actual.
                </Text>
                <Group justify="flex-end" grow={isMobile}>
                  <Button
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => void loadSelectedPeriod()}
                    disabled={isSaving || isCopying}
                  >
                    Revertir
                  </Button>
                  <Button type="submit" loading={isSaving} disabled={isCopying} size="sm">
                    Guardar presupuesto
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
