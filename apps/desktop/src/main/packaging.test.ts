import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");

describe("macOS packaging configuration", () => {
  it("builds a bundled local API and packages it into the desktop app resources", () => {
    const rootPackage = readJson("package.json") as { scripts: Record<string, string>; devDependencies: Record<string, string> };
    const apiPackage = readJson("services/api/package.json") as { scripts: Record<string, string> };
    const desktopPackage = readJson("apps/desktop/package.json") as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const builderConfig = readJson("apps/desktop/electron-builder.json") as {
      extraResources: Array<{ from: string; to: string }>;
      mac: { target: string[]; identity: null };
    };

    expect(rootPackage.scripts["package:mac"]).toContain("@echo/api build:bundle");
    expect(rootPackage.scripts["package:mac"]).toContain("@echo/desktop package:mac");
    expect(apiPackage.scripts["build:bundle"]).toContain("esbuild");
    expect(apiPackage.scripts["build:bundle"]).toContain("createRequire");
    expect(apiPackage.scripts["build:bundle"]).toContain("bundle/index.mjs");
    expect(desktopPackage.scripts["package:mac"]).toContain("electron-builder");
    expect(rootPackage.devDependencies.esbuild).toBeDefined();
    expect(desktopPackage.devDependencies["electron-builder"]).toBeDefined();
    expect(builderConfig.extraResources).toContainEqual({
      from: "../../services/api/bundle/index.mjs",
      to: "api/index.mjs"
    });
    expect(builderConfig.mac.target).toContain("dir");
    expect(builderConfig.mac.identity).toBeNull();
  });
});

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(workspaceRoot, relativePath), "utf8")) as unknown;
}
