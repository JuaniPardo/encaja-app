import { localeCompareByName } from "@/features/i18n/formatting";
import type { Database } from "@/types/database";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type CategorySubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];

export function sortSubcategories(
  a: CategorySubcategoryRow,
  b: CategorySubcategoryRow,
  locale: "es" | "en",
) {
  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

export function buildCategoryLineKey(categoryId: string, subcategoryId: string | null) {
  return `${categoryId}::${subcategoryId ?? "root"}`;
}

export function formatCategoryWithOptionalSubcategory(
  categoryName: string,
  subcategoryName: string | null | undefined,
) {
  if (!subcategoryName) {
    return categoryName;
  }

  return `${categoryName} · ${subcategoryName}`;
}
