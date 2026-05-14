import Link from "next/link";
import { useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useHover } from "@mantine/hooks";

import { transactionTypeColorCssVar } from "@/features/transactions/type-colors";
import type {
  CategorySource,
  Database,
  ExpenseBehavior,
  TransactionType,
} from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type SubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];

export type GroupedCategoryRows = {
  type: TransactionType;
  label: string;
  rows: CategoryRow[];
};

type CategoriesListProps = {
  canManageStructure: boolean;
  categoryDrilldownHref: (type: TransactionType, categoryId: string) => string;
  categoryExpenseBehaviorLabels: Record<ExpenseBehavior, string>;
  categorySourceLabels: Record<CategorySource, string>;
  groupedRows: GroupedCategoryRows[];
  hasUsageData: boolean;
  isMobile: boolean;
  onEdit: (row: CategoryRow) => void;
  onEditSubcategory: (row: SubcategoryRow) => void;
  onCreateSubcategory: (parentCategoryId?: string) => void;
  onToggleActive: (row: CategoryRow) => void | Promise<void>;
  onToggleSubcategoryActive: (row: SubcategoryRow) => void | Promise<void>;
  subcategories: SubcategoryRow[];
  tableLabels: {
    actions: string;
    movements: string;
    name: string;
    groupSummary: (total: number, active: number) => string;
    type: string;
    status: string;
  };
  toggleLabels: {
    activate: string;
    deactivate: string;
    edit: string;
  };
  metaLabels: {
    exceptional: string;
    active: string;
    inactive: string;
  };
  usageLabels: {
    none: string;
    newSubcategory: string;
    withoutSubcategory: string;
    viewMovements: string;
    count: (count: number) => string;
  };
  usageByCategoryId: Record<string, number>;
  usageBySubcategoryId: Record<string, number>;
};

function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ToggleActiveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v10" />
      <path d="M18.36 5.64a9 9 0 1 1-12.72 0" />
    </svg>
  );
}

function resolveGroupAccent(type: TransactionType) {
  return {
    border: transactionTypeColorCssVar(type, 3),
    text: transactionTypeColorCssVar(type, 6),
    tint: transactionTypeColorCssVar(type, 0),
  };
}

function CategoryMetaBadges({
  exceptionalLabel,
  row,
  categoryExpenseBehaviorLabels,
  categorySourceLabels,
}: {
  exceptionalLabel: string;
  row: CategoryRow;
  categoryExpenseBehaviorLabels: Record<ExpenseBehavior, string>;
  categorySourceLabels: Record<CategorySource, string>;
}) {
  return (
    <Group gap={6} wrap="wrap">
      <Badge
        variant={row.source === "system" ? "light" : "outline"}
        color={row.source === "system" ? "blue" : "gray"}
        size="xs"
        radius="sm"
      >
        {categorySourceLabels[row.source]}
      </Badge>

      {row.type === "expense" ? (
        <Badge variant="outline" color="gray" size="xs" radius="sm">
          {categoryExpenseBehaviorLabels[row.expense_behavior ?? "variable"]}
        </Badge>
      ) : null}

      {row.is_exceptional ? (
        <Badge variant="light" color="orange" size="xs" radius="sm">
          {exceptionalLabel}
        </Badge>
      ) : null}
    </Group>
  );
}

function CategoryStatusPill({
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  activeLabel: string;
  inactiveLabel: string;
  isActive: boolean;
}) {
  const color = isActive ? "var(--mantine-color-cyan-6)" : "var(--mantine-color-gray-5)";

  return (
    <Group
      gap={6}
      wrap="nowrap"
      style={{
        width: "fit-content",
        borderRadius: "999px",
        border: `1px solid ${isActive ? "var(--mantine-color-cyan-2)" : "var(--mantine-color-gray-3)"}`,
        backgroundColor: isActive ? "var(--mantine-color-cyan-0)" : "var(--mantine-color-gray-0)",
        padding: "4px 8px",
      }}
    >
      <Box
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: "999px",
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Text size="xs" fw={600} c={isActive ? "cyan.8" : "gray.7"}>
        {isActive ? activeLabel : inactiveLabel}
      </Text>
    </Group>
  );
}

function CategoryActions({
  canManageStructure,
  compact,
  onEdit,
  onToggleActive,
  row,
  toggleLabels,
}: {
  canManageStructure: boolean;
  compact?: boolean;
  onEdit: (row: CategoryRow) => void;
  onToggleActive: (row: CategoryRow) => void | Promise<void>;
  row: CategoryRow;
  toggleLabels: CategoriesListProps["toggleLabels"];
}) {
  return (
    <Group gap={compact ? 2 : 4} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        radius="md"
        disabled={!canManageStructure}
        aria-label={toggleLabels.edit}
        onClick={(event) => {
          event.stopPropagation();
          onEdit(row);
        }}
      >
        <EditIcon size={13} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        color={row.is_active ? "gray" : "cyan"}
        radius="md"
        disabled={!canManageStructure || row.is_exceptional}
        aria-label={row.is_active ? toggleLabels.deactivate : toggleLabels.activate}
        onClick={(event) => {
          event.stopPropagation();
          void onToggleActive(row);
        }}
      >
        <ToggleActiveIcon size={13} />
      </ActionIcon>
    </Group>
  );
}

function SubcategoryActions({
  canManageStructure,
  onEdit,
  onToggleActive,
  row,
  toggleLabels,
}: {
  canManageStructure: boolean;
  onEdit: (row: SubcategoryRow) => void;
  onToggleActive: (row: SubcategoryRow) => void | Promise<void>;
  row: SubcategoryRow;
  toggleLabels: CategoriesListProps["toggleLabels"];
}) {
  return (
    <Group gap={2} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="gray"
        radius="md"
        disabled={!canManageStructure}
        aria-label={toggleLabels.edit}
        onClick={(event) => {
          event.stopPropagation();
          onEdit(row);
        }}
      >
        <EditIcon size={13} />
      </ActionIcon>

      <ActionIcon
        variant="subtle"
        color={row.is_active ? "gray" : "cyan"}
        radius="md"
        disabled={!canManageStructure}
        aria-label={row.is_active ? toggleLabels.deactivate : toggleLabels.activate}
        onClick={(event) => {
          event.stopPropagation();
          void onToggleActive(row);
        }}
      >
        <ToggleActiveIcon size={13} />
      </ActionIcon>
    </Group>
  );
}

function CategoryDesktopRow({
  canManageStructure,
  categoryDrilldownHref,
  categoryExpenseBehaviorLabels,
  categorySourceLabels,
  categorySubcategories,
  hasUsageData,
  metaLabels,
  onEdit,
  onEditSubcategory,
  onCreateSubcategory,
  onToggleActive,
  onToggleSubcategoryActive,
  row,
  toggleLabels,
  usageByCategoryId,
  usageBySubcategoryId,
  usageLabels,
}: {
  canManageStructure: boolean;
  categoryDrilldownHref: CategoriesListProps["categoryDrilldownHref"];
  categoryExpenseBehaviorLabels: Record<ExpenseBehavior, string>;
  categorySourceLabels: Record<CategorySource, string>;
  categorySubcategories: SubcategoryRow[];
  hasUsageData: boolean;
  metaLabels: CategoriesListProps["metaLabels"];
  onEdit: (row: CategoryRow) => void;
  onEditSubcategory: (row: SubcategoryRow) => void;
  onCreateSubcategory: (parentCategoryId?: string) => void;
  onToggleActive: (row: CategoryRow) => void | Promise<void>;
  onToggleSubcategoryActive: (row: SubcategoryRow) => void | Promise<void>;
  row: CategoryRow;
  toggleLabels: CategoriesListProps["toggleLabels"];
  usageByCategoryId: Record<string, number>;
  usageBySubcategoryId: Record<string, number>;
  usageLabels: CategoriesListProps["usageLabels"];
}) {
  const { hovered, ref } = useHover<HTMLDivElement>();
  const usageCount = usageByCategoryId[row.id] ?? 0;

  return (
    <Box
      ref={ref}
      style={{
        borderBottom: "1px solid var(--mantine-color-gray-2)",
        backgroundColor: hovered ? "var(--mantine-color-gray-0)" : "transparent",
        transition: "background-color 120ms ease",
      }}
    >
      <Group align="center" wrap="nowrap" gap="md" px="sm" py="sm">
        <Box style={{ flex: "1 1 0", minWidth: 0 }}>
          <Text fw={600} size="sm" lineClamp={1}>
            {row.name}
          </Text>
          {row.warning_message ? (
            <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
              {row.warning_message}
            </Text>
          ) : null}
        </Box>

        <Stack gap={2} align="flex-start" style={{ width: 160, flexShrink: 0 }}>
          <Text size="sm" fw={500}>
            {hasUsageData ? usageLabels.count(usageCount) : usageLabels.none}
          </Text>
          {hasUsageData && usageCount > 0 ? (
            <Text
              component={Link}
              href={categoryDrilldownHref(row.type, row.id)}
              size="xs"
              c="cyan.7"
              style={{ textDecoration: "none" }}
            >
              {usageLabels.viewMovements}
            </Text>
          ) : null}
        </Stack>

        <Box style={{ width: 220, flexShrink: 0 }}>
          <CategoryMetaBadges
            exceptionalLabel={metaLabels.exceptional}
            row={row}
            categoryExpenseBehaviorLabels={categoryExpenseBehaviorLabels}
            categorySourceLabels={categorySourceLabels}
          />
        </Box>

        <Box style={{ width: 124, flexShrink: 0 }}>
          <CategoryStatusPill
            isActive={row.is_active}
            activeLabel={metaLabels.active}
            inactiveLabel={metaLabels.inactive}
          />
        </Box>

        <Box
          style={{
            width: 92,
            display: "flex",
            justifyContent: "flex-end",
            opacity: canManageStructure ? (hovered ? 1 : 0.14) : 0.45,
            transition: "opacity 120ms ease",
          }}
        >
          <CategoryActions
            canManageStructure={canManageStructure}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            row={row}
            toggleLabels={toggleLabels}
          />
        </Box>
      </Group>

      {categorySubcategories.length > 0 ? (
        <Stack gap={0} px="sm" pb="sm" pl="lg">
          {categorySubcategories.map((subcategory) => {
            const subcategoryUsage = usageBySubcategoryId[subcategory.id] ?? 0;

            return (
              <Group
                key={subcategory.id}
                justify="space-between"
                align="center"
                wrap="nowrap"
                gap="md"
                py={6}
                style={{ borderTop: "1px dashed var(--mantine-color-gray-2)" }}
              >
                <Box style={{ flex: "1 1 0", minWidth: 0 }}>
                  <Text size="sm" lineClamp={1}>
                    {subcategory.name}
                  </Text>
                </Box>

                <Stack gap={2} align="flex-start" style={{ width: 160, flexShrink: 0 }}>
                  <Text size="sm" fw={500}>
                    {hasUsageData ? usageLabels.count(subcategoryUsage) : usageLabels.none}
                  </Text>
                  {hasUsageData && subcategoryUsage > 0 ? (
                    <Text
                      component={Link}
                      href={categoryDrilldownHref(row.type, row.id)}
                      size="xs"
                      c="cyan.7"
                      style={{ textDecoration: "none" }}
                    >
                      {usageLabels.viewMovements}
                    </Text>
                  ) : null}
                </Stack>

                <Box style={{ width: 220, flexShrink: 0 }}>
                  <Text size="xs" c="dimmed">
                    Subcategoría
                  </Text>
                </Box>

                <Box style={{ width: 124, flexShrink: 0 }}>
                  <CategoryStatusPill
                    isActive={subcategory.is_active}
                    activeLabel={metaLabels.active}
                    inactiveLabel={metaLabels.inactive}
                  />
                </Box>

                <Box style={{ width: 92, display: "flex", justifyContent: "flex-end" }}>
                  <SubcategoryActions
                    canManageStructure={canManageStructure}
                    onEdit={onEditSubcategory}
                    onToggleActive={onToggleSubcategoryActive}
                    row={subcategory}
                    toggleLabels={toggleLabels}
                  />
                </Box>
              </Group>
            );
          })}
        </Stack>
      ) : null}

      {canManageStructure ? (
        <Group justify="flex-start" px="sm" pb="sm">
          <Text
            component="button"
            type="button"
            onClick={() => onCreateSubcategory(row.id)}
            size="xs"
            c="cyan.7"
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            {usageLabels.newSubcategory}
          </Text>
        </Group>
      ) : null}
    </Box>
  );
}

function CategoryMobileRow({
  canManageStructure,
  categoryDrilldownHref,
  categoryExpenseBehaviorLabels,
  categorySourceLabels,
  categorySubcategories,
  hasUsageData,
  metaLabels,
  onEdit,
  onEditSubcategory,
  onCreateSubcategory,
  onToggleActive,
  onToggleSubcategoryActive,
  row,
  toggleLabels,
  usageByCategoryId,
  usageBySubcategoryId,
  usageLabels,
}: {
  canManageStructure: boolean;
  categoryDrilldownHref: CategoriesListProps["categoryDrilldownHref"];
  categoryExpenseBehaviorLabels: Record<ExpenseBehavior, string>;
  categorySourceLabels: Record<CategorySource, string>;
  categorySubcategories: SubcategoryRow[];
  hasUsageData: boolean;
  metaLabels: CategoriesListProps["metaLabels"];
  onEdit: (row: CategoryRow) => void;
  onEditSubcategory: (row: SubcategoryRow) => void;
  onCreateSubcategory: (parentCategoryId?: string) => void;
  onToggleActive: (row: CategoryRow) => void | Promise<void>;
  onToggleSubcategoryActive: (row: SubcategoryRow) => void | Promise<void>;
  row: CategoryRow;
  toggleLabels: CategoriesListProps["toggleLabels"];
  usageByCategoryId: Record<string, number>;
  usageBySubcategoryId: Record<string, number>;
  usageLabels: CategoriesListProps["usageLabels"];
}) {
  const usageCount = usageByCategoryId[row.id] ?? 0;
  const usageText = hasUsageData ? usageLabels.count(usageCount) : usageLabels.none;
  const content = (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs" px={2} py="xs">
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {row.name}
          </Text>
          <CategoryStatusPill
            isActive={row.is_active}
            activeLabel={metaLabels.active}
            inactiveLabel={metaLabels.inactive}
          />
        </Group>

        <Text size="xs" c="dimmed">
          {usageText}
        </Text>

        <CategoryMetaBadges
          exceptionalLabel={metaLabels.exceptional}
          row={row}
          categoryExpenseBehaviorLabels={categoryExpenseBehaviorLabels}
          categorySourceLabels={categorySourceLabels}
        />

        {hasUsageData && usageCount > 0 ? (
          <Text
            component={Link}
            href={categoryDrilldownHref(row.type, row.id)}
            size="xs"
            c="cyan.7"
            style={{ width: "fit-content", textDecoration: "none" }}
            onClick={(event) => event.stopPropagation()}
          >
            {usageLabels.viewMovements}
          </Text>
        ) : null}
      </Stack>

      <Menu position="bottom-end" withArrow>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="md"
            aria-label={toggleLabels.edit}
            onClick={(event) => event.stopPropagation()}
          >
            <DotsIcon />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<EditIcon size={13} />}
            disabled={!canManageStructure}
            onClick={() => onEdit(row)}
          >
            {toggleLabels.edit}
          </Menu.Item>
          <Menu.Item
            color={row.is_active ? "gray" : "cyan"}
            leftSection={<ToggleActiveIcon size={13} />}
            disabled={!canManageStructure || row.is_exceptional}
            onClick={() => void onToggleActive(row)}
          >
            {row.is_active ? toggleLabels.deactivate : toggleLabels.activate}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  if (!canManageStructure) {
    return (
      <Box
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-2)",
        }}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
      <UnstyledButton
        onClick={() => onEdit(row)}
        style={{
          display: "block",
          width: "100%",
        }}
      >
        {content}
      </UnstyledButton>

      {categorySubcategories.length > 0 ? (
        <Stack gap={0} px="sm" pb="sm">
          {categorySubcategories.map((subcategory) => {
            const subcategoryUsage = usageBySubcategoryId[subcategory.id] ?? 0;

            return (
              <Group
                key={subcategory.id}
                justify="space-between"
                align="center"
                wrap="nowrap"
                gap="xs"
                py={6}
                style={{ borderTop: "1px dashed var(--mantine-color-gray-2)" }}
              >
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" lineClamp={1}>
                    {subcategory.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {hasUsageData ? usageLabels.count(subcategoryUsage) : usageLabels.none}
                  </Text>
                </Stack>
                <SubcategoryActions
                  canManageStructure={canManageStructure}
                  onEdit={onEditSubcategory}
                  onToggleActive={onToggleSubcategoryActive}
                  row={subcategory}
                  toggleLabels={toggleLabels}
                />
              </Group>
            );
          })}
        </Stack>
      ) : null}

      <Group px="sm" pb="sm">
        <Text
          component="button"
          type="button"
          onClick={() => onCreateSubcategory(row.id)}
          size="xs"
          c="cyan.7"
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          {usageLabels.newSubcategory}
        </Text>
      </Group>
    </Box>
  );
}

export function CategoriesList({
  canManageStructure,
  categoryDrilldownHref,
  categoryExpenseBehaviorLabels,
  categorySourceLabels,
  groupedRows,
  hasUsageData,
  isMobile,
  metaLabels,
  onEdit,
  onEditSubcategory,
  onCreateSubcategory,
  onToggleActive,
  onToggleSubcategoryActive,
  subcategories,
  tableLabels,
  toggleLabels,
  usageByCategoryId,
  usageBySubcategoryId,
  usageLabels,
}: CategoriesListProps) {
  const subcategoriesByCategoryId = useMemo(() => {
    const nextMap = new Map<string, SubcategoryRow[]>();

    for (const subcategory of subcategories) {
      const currentRows = nextMap.get(subcategory.category_id);
      if (currentRows) {
        currentRows.push(subcategory);
      } else {
        nextMap.set(subcategory.category_id, [subcategory]);
      }
    }

    return nextMap;
  }, [subcategories]);

  return (
    <Stack gap="md">
      {groupedRows.map((group) => {
        const accent = resolveGroupAccent(group.type);
        const activeRows = group.rows.filter((row) => row.is_active).length;

        return (
          <Box
            key={group.type}
            style={{
              borderRadius: "14px",
              border: "1px solid var(--mantine-color-gray-3)",
              overflow: "hidden",
              backgroundColor: "white",
            }}
          >
            <Group
              justify="space-between"
              align="end"
              wrap="wrap"
              gap="xs"
              px="sm"
              py="sm"
              style={{
                borderBottom: "1px solid var(--mantine-color-gray-2)",
                backgroundColor: accent.tint,
              }}
            >
              <Stack gap={2}>
                <Text
                  size="xs"
                  fw={800}
                  tt="uppercase"
                  style={{ letterSpacing: "0.06em", color: accent.text }}
                >
                  {group.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {tableLabels.groupSummary(group.rows.length, activeRows)}
                </Text>
              </Stack>
            </Group>

            {isMobile ? null : (
              <Group
                wrap="nowrap"
                gap="md"
                px="sm"
                py={10}
                style={{
                  borderBottom: "1px solid var(--mantine-color-gray-2)",
                  backgroundColor: "var(--mantine-color-gray-0)",
                }}
              >
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ flex: "1 1 0", minWidth: 0 }}>
                  {tableLabels.name}
                </Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ width: 160, flexShrink: 0 }}>
                  {tableLabels.movements}
                </Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ width: 220, flexShrink: 0 }}>
                  {tableLabels.type}
                </Text>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ width: 124, flexShrink: 0 }}>
                  {tableLabels.status}
                </Text>
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  style={{ width: 92, flexShrink: 0, textAlign: "right" }}
                >
                  {tableLabels.actions}
                </Text>
              </Group>
            )}

            <Stack gap={0}>
              {group.rows.map((row) =>
                isMobile ? (
                  <CategoryMobileRow
                    key={row.id}
                    canManageStructure={canManageStructure}
                    categoryDrilldownHref={categoryDrilldownHref}
                    categoryExpenseBehaviorLabels={categoryExpenseBehaviorLabels}
                    categorySourceLabels={categorySourceLabels}
                    categorySubcategories={subcategoriesByCategoryId.get(row.id) ?? []}
                    hasUsageData={hasUsageData}
                    metaLabels={metaLabels}
                    onEdit={onEdit}
                    onEditSubcategory={onEditSubcategory}
                    onCreateSubcategory={onCreateSubcategory}
                    onToggleActive={onToggleActive}
                    onToggleSubcategoryActive={onToggleSubcategoryActive}
                    row={row}
                    toggleLabels={toggleLabels}
                    usageByCategoryId={usageByCategoryId}
                    usageBySubcategoryId={usageBySubcategoryId}
                    usageLabels={usageLabels}
                  />
                ) : (
                  <CategoryDesktopRow
                    key={row.id}
                    canManageStructure={canManageStructure}
                    categoryDrilldownHref={categoryDrilldownHref}
                    categoryExpenseBehaviorLabels={categoryExpenseBehaviorLabels}
                    categorySourceLabels={categorySourceLabels}
                    categorySubcategories={subcategoriesByCategoryId.get(row.id) ?? []}
                    hasUsageData={hasUsageData}
                    metaLabels={metaLabels}
                    onEdit={onEdit}
                    onEditSubcategory={onEditSubcategory}
                    onCreateSubcategory={onCreateSubcategory}
                    onToggleActive={onToggleActive}
                    onToggleSubcategoryActive={onToggleSubcategoryActive}
                    row={row}
                    toggleLabels={toggleLabels}
                    usageByCategoryId={usageByCategoryId}
                    usageBySubcategoryId={usageBySubcategoryId}
                    usageLabels={usageLabels}
                  />
                ),
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
