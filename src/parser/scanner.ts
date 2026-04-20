import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedClass } from "../types.js";
import { parsePhpFile } from "./php-parser.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — skip huge generated files
const SKIP_DIRS = new Set([
  "node_modules", "vendor", ".git", ".svn", ".hg",
  "cache", ".cache", "tmp", "temp", "dist", "build",
]);

export interface ScanResult {
  classes: ParsedClass[];
  scannedFiles: number;
  skippedFiles: string[];
}

export function scanDirectory(targetDir: string): ScanResult {
  // Resolve to absolute and ensure it exists
  const resolved = path.resolve(targetDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory not found: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${resolved}`);
  }

  const classes: ParsedClass[] = [];
  const skippedFiles: string[] = [];
  let scannedFiles = 0;

  const phpFiles = collectPhpFiles(resolved);

  for (const filePath of phpFiles) {
    try {
      const fileStat = fs.statSync(filePath);
      if (fileStat.size > MAX_FILE_SIZE) {
        skippedFiles.push(filePath);
        continue;
      }

      const parsed = parsePhpFile(filePath);
      classes.push(...parsed);
      scannedFiles++;
    } catch {
      skippedFiles.push(filePath);
    }
  }

  return { classes, scannedFiles, skippedFiles };
}

function collectPhpFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip hidden dirs and known non-source dirs
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name) && entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectPhpFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".php")) {
      files.push(fullPath);
    }
    // Ignore symlinks entirely for security
  }

  return files;
}
