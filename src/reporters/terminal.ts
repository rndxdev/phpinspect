import type { AnalysisReport, CodeSmell } from "../types.js";

// ANSI color codes — no dependencies needed
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

export function printReport(report: AnalysisReport): void {
  printHeader();
  printMetrics(report);
  printSmells(report.smells);
  printUmlInfo(report.uml);
  printSummary(report);
}

function printHeader(): void {
  console.log("");
  console.log(`${colors.bold}${colors.cyan}  phpinspect${colors.reset} ${colors.dim}v0.1.0${colors.reset}`);
  console.log(`${colors.dim}  PHP OOP Code Analyzer${colors.reset}`);
  console.log(`${colors.dim}  ${"─".repeat(50)}${colors.reset}`);
  console.log("");
}

function printMetrics(report: AnalysisReport): void {
  const m = report.metrics;
  console.log(`${colors.bold}  Project Metrics${colors.reset}`);
  console.log(`${colors.dim}  ─────────────────${colors.reset}`);
  console.log(`  Files scanned:         ${colors.white}${report.scannedFiles}${colors.reset}`);
  console.log(`  Classes:               ${colors.white}${m.totalClasses}${colors.reset}`);
  console.log(`  Interfaces:            ${colors.white}${m.totalInterfaces}${colors.reset}`);
  console.log(`  Traits:                ${colors.white}${m.totalTraits}${colors.reset}`);
  console.log(`  Total methods:         ${colors.white}${m.totalMethods}${colors.reset}`);
  console.log(`  Total properties:      ${colors.white}${m.totalProperties}${colors.reset}`);
  console.log(`  Avg methods/class:     ${colorizeMetric(m.avgMethodsPerClass, 10, 15)}${colors.reset}`);
  console.log(`  Avg properties/class:  ${colorizeMetric(m.avgPropertiesPerClass, 8, 12)}${colors.reset}`);
  console.log(`  Max inheritance depth: ${colorizeMetric(m.maxInheritanceDepth, 3, 5)}${colors.reset}`);
  console.log(`  Avg complexity:        ${colorizeMetric(m.avgCyclomaticComplexity, 5, 10)}${colors.reset}`);
  console.log("");
}

function printSmells(smells: CodeSmell[]): void {
  if (smells.length === 0) {
    console.log(`  ${colors.green}✓ No code smells detected!${colors.reset}`);
    console.log("");
    return;
  }

  const errors = smells.filter((s) => s.severity === "error");
  const warnings = smells.filter((s) => s.severity === "warning");
  const infos = smells.filter((s) => s.severity === "info");

  console.log(`${colors.bold}  Code Smells (${smells.length} found)${colors.reset}`);
  console.log(`${colors.dim}  ─────────────────────────${colors.reset}`);

  if (errors.length > 0) {
    console.log(`  ${colors.red}${colors.bold}Errors (${errors.length}):${colors.reset}`);
    for (const smell of errors) {
      printSmell(smell);
    }
    console.log("");
  }

  if (warnings.length > 0) {
    console.log(`  ${colors.yellow}${colors.bold}Warnings (${warnings.length}):${colors.reset}`);
    for (const smell of warnings) {
      printSmell(smell);
    }
    console.log("");
  }

  if (infos.length > 0) {
    console.log(`  ${colors.blue}${colors.bold}Info (${infos.length}):${colors.reset}`);
    for (const smell of infos) {
      printSmell(smell);
    }
    console.log("");
  }
}

function printSmell(smell: CodeSmell): void {
  const icon = severityIcon(smell.severity);
  const color = severityColor(smell.severity);
  const location = `${smell.file}:${smell.line}`;
  console.log(`    ${color}${icon} ${smell.message}${colors.reset}`);
  console.log(`      ${colors.dim}at ${location}${colors.reset}`);
  console.log(`      ${colors.cyan}→ ${smell.suggestion}${colors.reset}`);
  console.log("");
}

function printUmlInfo(uml: string): void {
  const classCount = (uml.match(/^\s*class /gm) || []).length;
  console.log(`${colors.bold}  UML Diagram${colors.reset}`);
  console.log(`${colors.dim}  ────────────${colors.reset}`);
  console.log(`  Generated Mermaid class diagram with ${classCount} classes.`);
  console.log(`  ${colors.dim}Use --uml flag to output the diagram to a file.${colors.reset}`);
  console.log("");
}

function printSummary(report: AnalysisReport): void {
  const errors = report.smells.filter((s) => s.severity === "error").length;
  const warnings = report.smells.filter((s) => s.severity === "warning").length;
  const infos = report.smells.filter((s) => s.severity === "info").length;

  console.log(`${colors.dim}  ─────────────────────────${colors.reset}`);
  if (errors > 0) {
    console.log(`  ${colors.red}${colors.bold}${errors} error(s)${colors.reset}, ${colors.yellow}${warnings} warning(s)${colors.reset}, ${colors.blue}${infos} info${colors.reset}`);
  } else if (warnings > 0) {
    console.log(`  ${colors.yellow}${warnings} warning(s)${colors.reset}, ${colors.blue}${infos} info${colors.reset}`);
  } else {
    console.log(`  ${colors.green}${colors.bold}All clear!${colors.reset} ${colors.blue}${infos} info note(s)${colors.reset}`);
  }
  console.log("");
}

function severityIcon(severity: CodeSmell["severity"]): string {
  switch (severity) {
    case "error":
      return "●";
    case "warning":
      return "▲";
    case "info":
      return "○";
  }
}

function severityColor(severity: CodeSmell["severity"]): string {
  switch (severity) {
    case "error":
      return colors.red;
    case "warning":
      return colors.yellow;
    case "info":
      return colors.blue;
  }
}

function colorizeMetric(value: number, warnThreshold: number, errorThreshold: number): string {
  if (value >= errorThreshold) return `${colors.red}${value}`;
  if (value >= warnThreshold) return `${colors.yellow}${value}`;
  return `${colors.green}${value}`;
}
