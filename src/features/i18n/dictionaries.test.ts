import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { supportedLocales } from "@/features/i18n/config";
import { getTranslation, listTranslationKeys } from "@/features/i18n/dictionaries";

const SRC_DIR = path.resolve(__dirname, "../..");
const LITERAL_KEY_PATTERN = /\bt\(\s*["']([^"'`]+)["']/g;

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [entryPath] : [];
  });
}

function collectLiteralKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const filePath of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(filePath, "utf8");
    for (const match of content.matchAll(LITERAL_KEY_PATTERN)) {
      if (!keys.has(match[1])) {
        keys.set(match[1], path.relative(SRC_DIR, filePath));
      }
    }
  }

  return keys;
}

describe("dictionaries", () => {
  it("has the same keys in every locale", () => {
    const esKeys = listTranslationKeys("es");
    const enKeys = listTranslationKeys("en");

    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]);
    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
  });

  it.each(supportedLocales)("defines every literal key used in src for %s", (locale) => {
    const definedKeys = new Set(listTranslationKeys(locale));
    const literalKeys = collectLiteralKeys();

    expect(literalKeys.size).toBeGreaterThan(0);
    const missing = [...literalKeys.entries()]
      .filter(([key]) => !definedKeys.has(key))
      .map(([key, file]) => `${key} (${file})`);

    expect(missing).toEqual([]);
  });

  it("translates the subcategory labels in categories", () => {
    for (const locale of supportedLocales) {
      expect(getTranslation(locale, "categories.newSubcategory")).not.toBe(
        "categories.newSubcategory",
      );
    }
    expect(getTranslation("en", "categories.newSubcategory")).toBe("New subcategory");
    expect(getTranslation("es", "categories.form.inheritsParentType", undefined, { type: "Gasto" })).toBe(
      "Hereda el tipo de la categoría padre: Gasto.",
    );
  });

  it("labels transaction types in English", () => {
    expect(getTranslation("en", "common.domain.transactionType.income")).toBe("Income");
    expect(getTranslation("en", "common.domain.expenseBehavior.fixed")).toBe("Fixed");
  });

  it.each(supportedLocales)("defines the lote 4 insight keys and drops the generic attention badge in %s", (locale) => {
    const keys = new Set(listTranslationKeys(locale));

    expect(keys.has("insightsV2.dashboard.kindBadge.attention")).toBe(false);
    expect(keys.has("insightsV2.modules.behavior.insights.categoryImbalance.alertTitle")).toBe(false);
    expect(keys.has("insightsV2.modules.behavior.insights.categoryImbalance.warningTitle")).toBe(false);
    for (const key of [
      "insightsV2.dashboard.kindBadge.cardAcceleration",
      "insightsV2.dashboard.kindBadge.budgetExceeded",
      "insightsV2.dashboard.kindBadge.budgetAtRisk",
      "insightsV2.dashboard.kindBadge.budgetUnderPace",
      "insightsV2.modules.budget.insights.others.one",
      "insightsV2.modules.budget.insights.others.other",
      "insightsV2.modules.behavior.insights.categoryImbalance.highTitle",
      "insightsV2.modules.behavior.insights.categoryImbalance.moderateTitle",
      "insightsV2.modules.behavior.insights.categoryImbalance.message",
    ]) {
      expect(keys.has(key)).toBe(true);
    }
  });
});
