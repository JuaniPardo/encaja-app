"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
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

    if (!periodResponse.data) {
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
      .eq("budget_period_id", periodResponse.data.id);

    if (itemsResponse.error) {
      setIsPeriodLoading(false);
      notifications.show({
        color: "red",
        title: "No pudimos cargar el presupuesto",
        message: itemsResponse.error.message,
      });
      return;
    }

    const amountByCategoryId = new Map(
      itemsResponse.data.map((item) => [item.category_id, parseAmountValue(item.amount)]),
    );

    reset({
      items: categories.map((category) => ({
        categoryId: category.id,
        amount: amountByCategoryId.get(category.id) ?? null,
      })),
    });

    setPeriodId(periodResponse.data.id);
    setPeriodHasItems(itemsResponse.data.length > 0);
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
      setPeriodId(insertResponse.data.id);
      return insertResponse.data.id;
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

    setPeriodId(existingPeriod.data.id);
    return existingPeriod.data.id;
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

      if (!previousPeriodResponse.data) {
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
        .eq("budget_period_id", previousPeriodResponse.data.id);

      if (previousItemsResponse.error) {
        throw previousItemsResponse.error;
      }

      const activeCategoryIds = new Set(categories.map((category) => category.id));
      const copyRowsSource = previousItemsResponse.data.filter((item) =>
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

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isPeriodLoading} />

      <Stack gap={2}>
        <Title order={2}>Presupuesto mensual</Title>
        <Text size="sm" c="dimmed">
          Definí montos por categoría para el período seleccionado.
        </Text>
      </Stack>

      <Paper withBorder radius="md" p="md">
        <Group align="end" justify="space-between">
          <Group align="end">
            <NativeSelect
              label="Año"
              data={yearOptions}
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
            />
            <NativeSelect
              label="Mes"
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
            />
          </Group>

          <Button
            variant="light"
            onClick={() => void copyFromPreviousMonth()}
            loading={isCopying}
            disabled={categories.length === 0 || isPeriodLoading || isSaving}
          >
            Copiar mes anterior
          </Button>
        </Group>

        <Text mt="sm" size="sm" c="dimmed">
          Editando {monthLabel(selectedMonth)} {selectedYear}.
        </Text>

        <Text size="xs" c="dimmed" mt={4}>
          La copia solo está habilitada cuando el período actual todavía no tiene ítems.
        </Text>
      </Paper>

      {categories.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            No hay categorías activas. Creá al menos una categoría para cargar presupuesto.
          </Text>
        </Paper>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            {!periodId ? (
              <Alert color="blue" variant="light">
                Este período todavía no tiene presupuesto guardado. Cargá montos y guardá para
                crearlo.
              </Alert>
            ) : null}

            {(Object.keys(groupedCategories) as TransactionType[]).map((typeKey) => (
              <Paper key={typeKey} withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Title order={4} c={typeColors[typeKey]}>
                    {typeLabels[typeKey]}
                  </Title>
                  {groupedCategories[typeKey].length === 0 ? (
                    <Text size="sm" c="dimmed">
                      No hay categorías activas de este tipo.
                    </Text>
                  ) : (
                    <Table.ScrollContainer minWidth={680}>
                      <Table verticalSpacing="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Categoría</Table.Th>
                            <Table.Th>Monto presupuestado</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {groupedCategories[typeKey].map(({ category, index }) => (
                            <Table.Tr key={category.id}>
                              <Table.Td>{category.name}</Table.Td>
                              <Table.Td>
                                <input
                                  type="hidden"
                                  {...register(`items.${index}.categoryId` as const)}
                                />
                                <TextInput
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0"
                                  error={errors.items?.[index]?.amount?.message}
                                  {...register(`items.${index}.amount` as const)}
                                />
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </Stack>
              </Paper>
            ))}

            <Paper withBorder radius="md" p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c={`${typeColors.income}.7`}>
                    Subtotal ingresos
                  </Text>
                  <Text fw={600} c={`${typeColors.income}.7`}>
                    {currencyFormatter.format(totals.income)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c={`${typeColors.expense}.7`}>
                    Subtotal gastos
                  </Text>
                  <Text fw={600} c={`${typeColors.expense}.7`}>
                    {currencyFormatter.format(totals.expense)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c={`${typeColors.saving}.7`}>
                    Subtotal ahorro
                  </Text>
                  <Text fw={600} c={`${typeColors.saving}.7`}>
                    {currencyFormatter.format(totals.saving)}
                  </Text>
                </Group>
                <Group justify="space-between" mt={4}>
                  <Text fw={600}>Total asignado (gastos + ahorro)</Text>
                  <Text fw={700}>{currencyFormatter.format(totals.assigned)}</Text>
                </Group>
                <Group justify="space-between" mt={4}>
                  <Text fw={700}>Balance (ingresos - gastos - ahorro)</Text>
                  <Text fw={800} c={isBalanced ? "teal.7" : roundedBalance > 0 ? "yellow.8" : "pink.7"}>
                    {currencyFormatter.format(roundedBalance)}
                  </Text>
                </Group>

                <Alert mt="xs" color={isBalanced ? "teal" : "yellow"} variant="light">
                  {isBalanced
                    ? "Presupuesto balanceado: todos los ingresos están asignados."
                    : roundedBalance > 0
                      ? `Falta asignar ${currencyFormatter.format(
                          roundedBalance,
                        )} de ingresos a gastos o ahorro.`
                      : `Asignaste ${currencyFormatter.format(
                          Math.abs(roundedBalance),
                        )} por encima de los ingresos.`}
                </Alert>
              </Stack>
            </Paper>

            <Group justify="flex-end">
              <Button
                type="button"
                variant="light"
                color="gray"
                onClick={() => void loadSelectedPeriod()}
                disabled={isSaving || isCopying}
              >
                Revertir
              </Button>
              <Button type="submit" loading={isSaving} disabled={isCopying}>
                Guardar presupuesto
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
