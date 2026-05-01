import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));
const importSpecifierPattern = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']|\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

describe("API build output compatibility", () => {
  it("uses Node ESM-compatible relative import specifiers in runtime source files", () => {
    const violations = listRuntimeSourceFiles(sourceRoot).flatMap((filePath) =>
      findRelativeImportSpecifiers(filePath)
        .filter((specifier) => !specifier.endsWith(".js") && !specifier.endsWith(".json"))
        .map((specifier) => `${path.relative(sourceRoot, filePath)} -> ${specifier}`)
    );

    expect(violations).toEqual([]);
  });
});

function listRuntimeSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return listRuntimeSourceFiles(entryPath);
    }

    if (!entryPath.endsWith(".ts") || entryPath.endsWith(".test.ts")) {
      return [];
    }

    return [entryPath];
  });
}

function findRelativeImportSpecifiers(filePath: string) {
  const source = readFileSync(filePath, "utf8");
  return Array.from(source.matchAll(importSpecifierPattern), (match) => match[1] ?? match[2] ?? "");
}
