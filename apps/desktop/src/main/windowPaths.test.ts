import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePreloadPath, resolveRendererIndexPath } from "./windowPaths";

describe("window path resolution", () => {
  it("matches electron-vite production output paths", () => {
    const mainDir = path.join("/app", "out", "main");

    expect(resolvePreloadPath(mainDir)).toBe(path.join("/app", "out", "preload", "index.mjs"));
    expect(resolveRendererIndexPath(mainDir)).toBe(path.join("/app", "out", "renderer", "index.html"));
  });
});
