import os from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { afterEach, beforeEach } from "vitest";
import type { Database } from "better-sqlite3";
import { openEchoDatabase } from "./database";

export function useTempDatabase() {
  let db: Database | undefined;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `echo-test-${crypto.randomUUID()}.sqlite`);
    db = openEchoDatabase(dbPath);
  });

  afterEach(() => {
    db?.close();
    rmSync(dbPath, { force: true });
    rmSync(`${dbPath}-wal`, { force: true });
    rmSync(`${dbPath}-shm`, { force: true });
  });

  return {
    get db() {
      if (!db) {
        throw new Error("Test database has not been opened");
      }
      return db;
    }
  };
}
