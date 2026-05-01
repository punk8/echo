import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findDotenvPath } from "./dotenv";

describe("findDotenvPath", () => {
  it("finds the nearest .env by walking up from the service working directory", () => {
    const root = mkdtempSync(path.join(tmpdir(), "echo-env-"));
    const serviceDir = path.join(root, "services", "api");
    mkdirSync(serviceDir, { recursive: true });
    writeFileSync(path.join(root, ".env"), "LLM_MODEL=gpt-4o-mini\n");

    expect(findDotenvPath(serviceDir)).toBe(path.join(root, ".env"));
  });

  it("prefers an explicit env file path", () => {
    const root = mkdtempSync(path.join(tmpdir(), "echo-env-"));
    const explicit = path.join(root, "custom.env");
    writeFileSync(explicit, "LLM_MODEL=gpt-4o-mini\n");

    expect(findDotenvPath(path.join(root, "services", "api"), explicit)).toBe(explicit);
  });
});
