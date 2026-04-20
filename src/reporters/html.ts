import * as fs from "node:fs";
import * as path from "node:path";
import type { AnalysisReport } from "../types.js";

export function writeHtmlReport(report: AnalysisReport, outputPath: string): void {
  const html = generateHtml(report);
  fs.writeFileSync(path.resolve(outputPath), html, "utf-8");
}

function generateHtml(report: AnalysisReport): string {
  const smellsHtml = report.smells.length > 0
    ? report.smells.map((s) => {
        const icon = s.severity === "error" ? "&#9679;" : s.severity === "warning" ? "&#9650;" : "&#9675;";
        const color = s.severity === "error" ? "#e74c3c" : s.severity === "warning" ? "#f39c12" : "#3498db";
        return `<div class="smell ${s.severity}">
          <span class="icon" style="color:${color}">${icon}</span>
          <div class="smell-body">
            <div class="smell-msg">${escapeHtml(s.message)}</div>
            <div class="smell-loc">${escapeHtml(s.file)}:${s.line}</div>
            <div class="smell-fix">&rarr; ${escapeHtml(s.suggestion)}</div>
          </div>
        </div>`;
      }).join("\n")
    : '<p class="all-clear">&#10003; No code smells detected!</p>';

  const m = report.metrics;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>phpinspect Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #1a1a2e; color: #e0e0e0; padding: 2rem; }
  .container { max-width: 1200px; margin: 0 auto; }
  h1 { color: #00d4ff; margin-bottom: 0.25rem; }
  .subtitle { color: #666; margin-bottom: 2rem; }
  h2 { color: #fff; margin: 2rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .metric { background: #16213e; border-radius: 8px; padding: 1rem; text-align: center; }
  .metric-value { font-size: 1.8rem; font-weight: bold; color: #00d4ff; }
  .metric-label { font-size: 0.85rem; color: #888; margin-top: 0.25rem; }
  .smell { display: flex; gap: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; background: #16213e; border-radius: 8px; border-left: 3px solid #333; }
  .smell.error { border-left-color: #e74c3c; }
  .smell.warning { border-left-color: #f39c12; }
  .smell.info { border-left-color: #3498db; }
  .icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 2px; }
  .smell-msg { font-weight: 500; margin-bottom: 0.25rem; }
  .smell-loc { font-size: 0.8rem; color: #666; margin-bottom: 0.25rem; }
  .smell-fix { color: #00d4ff; font-size: 0.9rem; }
  .all-clear { color: #2ecc71; font-size: 1.2rem; padding: 2rem; text-align: center; }
  .uml-wrapper { position: relative; margin-top: 1rem; border-radius: 8px; overflow: hidden; border: 1px solid #333; }
  .uml-toolbar { display: flex; gap: 0.5rem; padding: 0.75rem 1rem; background: #16213e; border-bottom: 1px solid #333; align-items: center; }
  .uml-toolbar button { background: #1a1a2e; color: #e0e0e0; border: 1px solid #444; border-radius: 4px; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.9rem; }
  .uml-toolbar button:hover { background: #333; border-color: #00d4ff; }
  .uml-toolbar .zoom-label { color: #888; font-size: 0.8rem; margin-left: 0.5rem; }
  .uml-viewport { overflow: hidden; background: #fff; cursor: grab; height: 70vh; position: relative; }
  .uml-viewport.grabbing { cursor: grabbing; }
  .uml-canvas { transform-origin: 0 0; transition: none; position: absolute; top: 0; left: 0; padding: 2rem; min-width: 100%; }
  .summary { display: flex; gap: 1.5rem; padding: 1rem; background: #16213e; border-radius: 8px; margin-top: 2rem; }
  .summary-item { font-weight: bold; }
  .summary-item.errors { color: #e74c3c; }
  .summary-item.warnings { color: #f39c12; }
  .summary-item.infos { color: #3498db; }
  .tabs { display: flex; gap: 0; margin-bottom: 0; }
  .tab { padding: 0.75rem 1.5rem; background: #16213e; border: 1px solid #333; cursor: pointer; color: #888; }
  .tab.active { background: #1a1a2e; border-bottom-color: #1a1a2e; color: #00d4ff; }
  .tab:first-child { border-radius: 8px 0 0 0; }
  .tab:last-child { border-radius: 0 8px 0 0; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
</style>
</head>
<body>
<div class="container">
  <h1>phpinspect</h1>
  <p class="subtitle">PHP OOP Code Analysis Report &mdash; ${report.scannedFiles} files scanned</p>

  <h2>Metrics</h2>
  <div class="metrics">
    <div class="metric"><div class="metric-value">${m.totalClasses}</div><div class="metric-label">Classes</div></div>
    <div class="metric"><div class="metric-value">${m.totalInterfaces}</div><div class="metric-label">Interfaces</div></div>
    <div class="metric"><div class="metric-value">${m.totalTraits}</div><div class="metric-label">Traits</div></div>
    <div class="metric"><div class="metric-value">${m.totalMethods}</div><div class="metric-label">Methods</div></div>
    <div class="metric"><div class="metric-value">${m.avgMethodsPerClass}</div><div class="metric-label">Avg Methods/Class</div></div>
    <div class="metric"><div class="metric-value">${m.maxInheritanceDepth}</div><div class="metric-label">Max Inheritance</div></div>
    <div class="metric"><div class="metric-value">${m.avgCyclomaticComplexity}</div><div class="metric-label">Avg Complexity</div></div>
    <div class="metric"><div class="metric-value">${report.smells.length}</div><div class="metric-label">Issues Found</div></div>
  </div>

  <h2>Issues</h2>
  <div class="summary">
    <span class="summary-item errors">${report.smells.filter(s => s.severity === "error").length} errors</span>
    <span class="summary-item warnings">${report.smells.filter(s => s.severity === "warning").length} warnings</span>
    <span class="summary-item infos">${report.smells.filter(s => s.severity === "info").length} info</span>
  </div>
  <div style="margin-top: 1rem;">
    ${smellsHtml}
  </div>

  <h2>Class Diagram (UML)</h2>
  <div class="uml-wrapper">
    <div class="uml-toolbar">
      <button id="zoom-in" title="Zoom In">&#43;</button>
      <button id="zoom-out" title="Zoom Out">&#8722;</button>
      <button id="zoom-reset" title="Reset">Reset</button>
      <button id="zoom-fit" title="Fit to View">Fit</button>
      <span class="zoom-label" id="zoom-level">100%</span>
    </div>
    <div class="uml-viewport" id="viewport">
      <div class="uml-canvas" id="canvas">
        <pre class="mermaid">
${escapeHtml(report.uml)}
        </pre>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'strict' });

  // Pan & Zoom
  (function() {
    const viewport = document.getElementById('viewport');
    const canvas = document.getElementById('canvas');
    const zoomLabel = document.getElementById('zoom-level');
    let scale = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let startX = 0, startY = 0;

    function applyTransform() {
      canvas.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    // Zoom buttons
    document.getElementById('zoom-in').addEventListener('click', function() {
      scale = Math.min(scale * 1.25, 5);
      applyTransform();
    });
    document.getElementById('zoom-out').addEventListener('click', function() {
      scale = Math.max(scale / 1.25, 0.2);
      applyTransform();
    });
    document.getElementById('zoom-reset').addEventListener('click', function() {
      scale = 1; panX = 0; panY = 0;
      applyTransform();
    });
    document.getElementById('zoom-fit').addEventListener('click', function() {
      var svg = canvas.querySelector('svg');
      if (!svg) return;
      var vw = viewport.clientWidth;
      var vh = viewport.clientHeight;
      var sw = svg.getBoundingClientRect().width / scale;
      var sh = svg.getBoundingClientRect().height / scale;
      scale = Math.min(vw / (sw + 40), vh / (sh + 40), 2);
      panX = 0; panY = 0;
      applyTransform();
    });

    // Mouse wheel zoom
    viewport.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = viewport.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var oldScale = scale;
      if (e.deltaY < 0) {
        scale = Math.min(scale * 1.1, 5);
      } else {
        scale = Math.max(scale / 1.1, 0.2);
      }
      // Zoom toward cursor
      panX = mx - (mx - panX) * (scale / oldScale);
      panY = my - (my - panY) * (scale / oldScale);
      applyTransform();
    }, { passive: false });

    // Pan with mouse drag
    viewport.addEventListener('mousedown', function(e) {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.classList.add('grabbing');
    });
    document.addEventListener('mousemove', function(e) {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });
    document.addEventListener('mouseup', function() {
      isPanning = false;
      viewport.classList.remove('grabbing');
    });

    // Touch support
    var lastTouchDist = 0;
    viewport.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        isPanning = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    });
    viewport.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (e.touches.length === 1 && isPanning) {
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        applyTransform();
      } else if (e.touches.length === 2) {
        var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.max(0.2, Math.min(5, scale * (dist / lastTouchDist)));
        lastTouchDist = dist;
        applyTransform();
      }
    }, { passive: false });
    viewport.addEventListener('touchend', function() { isPanning = false; });
  })();
<\/script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
