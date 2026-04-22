import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STORE_DIR = join(process.cwd(), ".demo-state");

function ensureStoreDir() {
  mkdirSync(STORE_DIR, { recursive: true });
}

function filePath(name: string): string {
  ensureStoreDir();
  return join(STORE_DIR, name);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readJsonFile<T>(name: string, fallback: T): T {
  const path = filePath(name);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return clone(fallback);
  }
}

export function writeJsonFile<T>(name: string, value: T): void {
  const path = filePath(name);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), "utf8");
  renameSync(tmp, path);
}
