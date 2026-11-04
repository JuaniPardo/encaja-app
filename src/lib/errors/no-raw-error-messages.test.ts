import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = path.resolve(__dirname, "../..");
// Los nombres retirados se arman por partes para que este archivo no aparezca en el grep de control.
const RETIRED_HELPER = ["get", "ErrorMessage"].join("");
const RETIRED_INSIGHTS_MESSAGE = ["Unknown", "insights", "error"].join(" ");
const RAW_ERROR_MESSAGE_PATTERN = new RegExp(
  `[eE]rror\\??\\.message|${RETIRED_HELPER}\\(|"${RETIRED_INSIGHTS_MESSAGE}"`,
);
const FORM_FIELD_ERROR_PATTERN =
  /errors\.[A-Za-z]+\??\.message|Errors\.[A-Za-z]+\?\.message|errors\.type\.message|errors\.items/;
const ALLOWED_FILES = new Set([
  path.join("features", "auth", "error-messages.ts"),
  path.join("lib", "errors", "user-facing-error.ts"),
]);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.") ? [entryPath] : [];
  });
}

describe("raw error messages", () => {
  it("only reads error.message inside the user-facing error helpers", () => {
    const offenders = listSourceFiles(SRC_DIR).flatMap((filePath) => {
      const relativePath = path.relative(SRC_DIR, filePath);
      if (ALLOWED_FILES.has(relativePath)) {
        return [];
      }

      return readFileSync(filePath, "utf8")
        .split("\n")
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(
          ({ line }) => RAW_ERROR_MESSAGE_PATTERN.test(line) && !FORM_FIELD_ERROR_PATTERN.test(line),
        )
        .map(({ line, lineNumber }) => `${relativePath}:${lineNumber}: ${line.trim()}`);
    });

    expect(offenders).toEqual([]);
  });
});
