import path from "node:path";

export function getUserDataPath(basePath: string, ...parts: string[]) {
  return path.join(basePath, ...parts);
}
