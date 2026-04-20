import * as fs from "node:fs";
import type { AnalysisReport } from "../types.js";

export function writeJsonReport(report: AnalysisReport, outputPath: string): void {
  const json = JSON.stringify(report, null, 2);
  fs.writeFileSync(outputPath, json, "utf-8");
}
