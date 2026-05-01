import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("@echo/shared package exports", () => {
  it("points runtime imports at built JavaScript", () => {
    const packageJson = JSON.parse(readFileSync(path.join(import.meta.dirname, "../package.json"), "utf8")) as {
      exports: { ".": { import: string; types: string } };
    };

    expect(packageJson.exports["."].import).toBe("./dist/index.js");
    expect(packageJson.exports["."].types).toBe("./dist/index.d.ts");
  });

  it("uses Node-compatible JavaScript extensions in source exports", () => {
    const indexSource = readFileSync(path.join(import.meta.dirname, "index.ts"), "utf8");

    expect(indexSource).toContain('export * from "./dictation/contracts.js"');
    expect(indexSource).toContain('export * from "./dictation/errors.js"');
    expect(indexSource).toContain('export * from "./dictation/stateMachine.js"');
  });
});
