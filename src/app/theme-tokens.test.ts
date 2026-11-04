import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_THEME } from "@mantine/core";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.resolve(__dirname, "..");
const GLOBALS_CSS_PATH = path.join(SRC_DIR, "app/globals.css");

// White text on saturated fills, plus chart strokes and fills. Semantic text colors go through --encaja-*-text tokens.
const ALLOWED_HEX_COLORS = new Set(["#ffffff", "#f06595", "#4c6bd7", "#3f8f7f", "#b0b4bb"]);

const SEMANTIC_TEXT_TOKENS_LIGHT: Record<string, string> = {
  "--encaja-positive-text": "#087f5b",
  "--encaja-negative-text": "#c92a2a",
  "--encaja-critical-text": "#b42318",
  "--encaja-warning-text": "#b54708",
  "--encaja-expense-text": "#c2255c",
  "--encaja-link-text": "#3b5bdb",
};

const MIN_TEXT_CONTRAST = 4.5;

const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{6}\b/g;
const ENCAJA_VAR_USAGE_PATTERN = /var\(\s*(--encaja-[a-z0-9-]+)/g;
const ENCAJA_VAR_DEFINITION_PATTERN = /(--encaja-[a-z0-9-]+)\s*:/g;

function listFiles(directory: string, extensions: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath, extensions);
    }

    return extensions.test(entry.name) && !entry.name.endsWith(".test.ts") ? [entryPath] : [];
  });
}

function readBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    return "";
  }

  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

function collectDefinitions(block: string): Set<string> {
  return new Set([...block.matchAll(ENCAJA_VAR_DEFINITION_PATTERN)].map((match) => match[1]));
}

function readDefinitionValue(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

function resolveMantineColor(value: string): string | undefined {
  const match = value.match(/^var\(--mantine-color-([a-z]+)-(\d)\)$/);
  if (!match) {
    return undefined;
  }

  const palette = DEFAULT_THEME.colors[match[1]];
  return palette?.[Number(match[2])];
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme tokens", () => {
  it("keeps hard-coded hex colors out of components except the allowed list", () => {
    const offenders = listFiles(SRC_DIR, /\.(ts|tsx)$/).flatMap((filePath) => {
      const content = readFileSync(filePath, "utf8");
      return [...content.matchAll(HEX_COLOR_PATTERN)]
        .map((match) => match[0].toLowerCase())
        .filter((color) => !ALLOWED_HEX_COLORS.has(color))
        .map((color) => `${color} (${path.relative(SRC_DIR, filePath)})`);
    });

    expect(offenders).toEqual([]);
  });

  it("defines every used --encaja-* variable for light and dark schemes", () => {
    const css = readFileSync(GLOBALS_CSS_PATH, "utf8");
    const lightDefinitions = collectDefinitions(readBlock(css, ":root"));
    const darkDefinitions = collectDefinitions(
      readBlock(css, '[data-mantine-color-scheme="dark"]'),
    );

    expect(lightDefinitions.size).toBeGreaterThan(0);
    expect(darkDefinitions.size).toBeGreaterThan(0);

    const usages = new Map<string, string>();
    for (const filePath of listFiles(SRC_DIR, /\.(ts|tsx|css)$/)) {
      const content = readFileSync(filePath, "utf8");
      for (const match of content.matchAll(ENCAJA_VAR_USAGE_PATTERN)) {
        if (!usages.has(match[1])) {
          usages.set(match[1], path.relative(SRC_DIR, filePath));
        }
      }
    }

    expect(usages.size).toBeGreaterThan(0);
    const missingLight = [...usages].filter(([name]) => !lightDefinitions.has(name));
    const missingDark = [...usages].filter(([name]) => !darkDefinitions.has(name));

    expect(missingLight).toEqual([]);
    expect(missingDark).toEqual([]);
  });

  it("keeps semantic text tokens identical in light and readable on dark surfaces", () => {
    const css = readFileSync(GLOBALS_CSS_PATH, "utf8");
    const lightBlock = readBlock(css, ":root");
    const darkBlock = readBlock(css, '[data-mantine-color-scheme="dark"]');
    const darkSurfaces = [DEFAULT_THEME.colors.dark[7], DEFAULT_THEME.colors.dark[6]];

    for (const [name, lightHex] of Object.entries(SEMANTIC_TEXT_TOKENS_LIGHT)) {
      expect(readDefinitionValue(lightBlock, name)).toBe(lightHex);

      const darkValue = readDefinitionValue(darkBlock, name) ?? "";
      const darkHex = resolveMantineColor(darkValue);
      expect(darkHex, `${name}: ${darkValue}`).toBeDefined();

      for (const surface of darkSurfaces) {
        expect(contrastRatio(darkHex ?? "", surface), `${name} on ${surface}`).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      }
    }
  });

  it("defines the same --encaja-* variables in light and dark schemes", () => {
    const css = readFileSync(GLOBALS_CSS_PATH, "utf8");
    const lightDefinitions = [...collectDefinitions(readBlock(css, ":root"))].sort();
    const darkDefinitions = [
      ...collectDefinitions(readBlock(css, '[data-mantine-color-scheme="dark"]')),
    ].sort();

    expect(darkDefinitions).toEqual(lightDefinitions);
  });
});
