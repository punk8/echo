import path from "node:path";

export function resolvePreloadPath(mainDir: string) {
  return path.join(mainDir, "../preload/index.mjs");
}

export function resolveRendererIndexPath(mainDir: string) {
  return path.join(mainDir, "../renderer/index.html");
}
