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
  const packagedResourceRoot = findPackagedResourceRoot(current);

  while (true) {
    const candidate = path.join(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }

    if (packagedResourceRoot && current === packagedResourceRoot) {
      return undefined;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function findPackagedResourceRoot(startDirectory: string) {
  let current = path.resolve(startDirectory);

  while (true) {
    if (
      path.basename(current) === "Resources" &&
      path.basename(path.dirname(current)) === "Contents" &&
      path.basename(path.dirname(path.dirname(current))).endsWith(".app")
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}
