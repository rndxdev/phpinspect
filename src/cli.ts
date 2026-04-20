#!/usr/bin/env node

import * as path from "node:path";
import * as fs from "node:fs";
import { scanDirectory } from "./parser/scanner.js";
import { detectSmells } from "./analyzer/smells.js";
import { detectLaravelSmells } from "./analyzer/laravel-smells.js";
import { computeMetrics } from "./analyzer/metrics.js";
import { generateMermaidUml } from "./uml/mermaid.js";
import { printReport } from "./reporters/terminal.js";
import { writeJsonReport } from "./reporters/json.js";
import { writeHtmlReport } from "./reporters/html.js";
import type { AnalysisReport } from "./types.js";

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("phpinspect v0.1.0");
    process.exit(0);
  }

  // Extract flags
  const flags = new Set(args.filter((a) => a.startsWith("-")));
  const positional = args.filter((a) => !a.startsWith("-"));

  if (positional.length === 0) {
    console.error("Error: Please provide a directory to scan.");
    process.exit(1);
  }

  const targetDir = path.resolve(positional[0]);

  // Security: validate the target path
  if (!fs.existsSync(targetDir)) {
    console.error(`Error: Directory not found: ${targetDir}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    console.error(`Error: Not a directory: ${targetDir}`);
    process.exit(1);
  }

  // Resolve real path to prevent symlink traversal
  const realTarget = fs.realpathSync(targetDir);

  // Scan and analyze
  const scanResult = scanDirectory(realTarget);

  if (scanResult.scannedFiles === 0) {
    console.log("No PHP files found in the specified directory.");
    process.exit(0);
  }

  const smells = detectSmells(scanResult.classes);

  // Auto-detect Laravel or use --laravel flag
  const isLaravel = flags.has("--laravel") || detectLaravelProject(realTarget);
  if (isLaravel) {
    const laravelSmells = detectLaravelSmells(scanResult.classes);
    smells.push(...laravelSmells);
  }

  const metrics = computeMetrics(scanResult.classes);
  const uml = generateMermaidUml(scanResult.classes);

  const report: AnalysisReport = {
    scannedFiles: scanResult.scannedFiles,
    classes: scanResult.classes,
    smells,
    metrics,
    uml,
  };

  // Output UML to file if requested
  if (flags.has("--uml")) {
    const umlIndex = args.indexOf("--uml");
    const umlPath = args[umlIndex + 1] || "phpinspect-uml.mmd";
    fs.writeFileSync(path.resolve(umlPath), uml, "utf-8");
    console.log(`UML diagram written to: ${path.resolve(umlPath)}`);
  }

  // Output JSON report if requested
  if (flags.has("--json")) {
    const jsonIndex = args.indexOf("--json");
    const jsonPath = args[jsonIndex + 1] || "phpinspect-report.json";
    writeJsonReport(report, path.resolve(jsonPath));
    console.log(`JSON report written to: ${path.resolve(jsonPath)}`);
  }

  // Output HTML report if requested
  if (flags.has("--html")) {
    const htmlIndex = args.indexOf("--html");
    const htmlPath = args[htmlIndex + 1] || "phpinspect-report.html";
    writeHtmlReport(report, path.resolve(htmlPath));
    console.log(`HTML report written to: ${path.resolve(htmlPath)}`);
  }

  // Always print terminal report unless --quiet
  if (!flags.has("--quiet") && !flags.has("-q")) {
    printReport(report);
  }

  // Exit with error code if there are errors
  const errorCount = smells.filter((s) => s.severity === "error").length;
  if (errorCount > 0 && flags.has("--strict")) {
    process.exit(1);
  }
}

function detectLaravelProject(dir: string): boolean {
  // Walk up to 2 levels to find artisan or composer.json with laravel
  const checks = [dir, path.dirname(dir), path.dirname(path.dirname(dir))];
  for (const check of checks) {
    try {
      if (fs.existsSync(path.join(check, "artisan"))) return true;
      const composerPath = path.join(check, "composer.json");
      if (fs.existsSync(composerPath)) {
        const composer = fs.readFileSync(composerPath, "utf-8");
        if (composer.includes("laravel/framework")) return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function printUsage(): void {
  console.log(`
  phpinspect - PHP OOP Code Analyzer

  Usage:
    phpinspect <directory> [options]

  Options:
    --uml [file]     Output Mermaid UML diagram to file (default: phpinspect-uml.mmd)
    --html [file]    Output self-contained HTML report (default: phpinspect-report.html)
    --json [file]    Output JSON report to file (default: phpinspect-report.json)
    --laravel        Force Laravel-specific analysis (auto-detected if artisan exists)
    --strict         Exit with code 1 if errors are found
    --quiet, -q      Suppress terminal output (use with --json or --uml)
    --help, -h       Show this help
    --version, -v    Show version

  Examples:
    phpinspect ./src
    phpinspect ./app --uml class-diagram.mmd
    phpinspect ./src --json report.json --uml
    phpinspect ./src --strict --laravel

  Security:
    - All analysis is performed locally. No network calls are made.
    - Source files are never modified — read-only analysis.
    - PHP code is parsed as text (AST), never executed.
`);
}

main();
