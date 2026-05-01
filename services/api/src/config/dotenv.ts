import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

export function loadDotenv(startDirectory = process.cwd(), explicitPath = process.env.ECHO_ENV_FILE) {
  const envPath = findDotenvPath(startDirectory, explicitPath);
  if (!envPath) {
    return;
  }

  config({ path: envPath });
}

export function findDotenvPath(startDirectory: string, explicitPath?: string) {
  if (explicitPath) {
    return explicitPath;
  }

  let current = path.resolve(startDirectory);

  while (true) {
    const candidate = path.join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
