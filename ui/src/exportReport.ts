import type { SuggestReport } from "./api";
import { formatBytes } from "./api";

export function exportSuggestJson(suggest: SuggestReport, summary: {
  scanned: number;
  groups: number;
  reclaimable: number;
}) {
  const blob = new Blob(
    [JSON.stringify({ summary, suggest }, null, 2)],
    { type: "application/json" },
  );
  download(blob, `dup-finder-report-${dateStamp()}.json`);
}

export function exportSuggestCsv(suggest: SuggestReport) {
  const rows: string[][] = [
    ["hash", "size", "reclaimable", "keep_path", "keep_reason", "candidate_path", "caution"],
  ];
  for (const g of suggest.groups) {
    const cautionMap = new Map(
      (g.cautions || []).map((c) => [c.path, `${c.level}:${c.reason}`]),
    );
    if (g.delete_candidates.length === 0) {
      rows.push([
        g.hash,
        String(g.keep.size),
        String(g.reclaimable_bytes),
        g.keep.path,
        g.keep_reason,
        "",
        "",
      ]);
    }
    for (const c of g.delete_candidates) {
      rows.push([
        g.hash,
        String(g.keep.size),
        String(g.reclaimable_bytes),
        g.keep.path,
        g.keep_reason,
        c.path,
        cautionMap.get(c.path) || "",
      ]);
    }
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  download(new Blob([csv], { type: "text/csv" }), `dup-finder-report-${dateStamp()}.csv`);
}

/** Printable HTML audit of keep/delete suggestions (no file contents). */
export function exportSuggestHtml(
  suggest: SuggestReport,
  summary: { scanned: number; groups: number; reclaimable: number },
) {
  const when = new Date().toISOString();
  const rows = suggest.groups
    .map((g, i) => {
      const cautions = new Map(
        (g.cautions || []).map((c) => [c.path, `${escapeHtml(c.level)}: ${escapeHtml(c.reason)}`]),
      );
      const dels =
        g.delete_candidates.length === 0
          ? `<li class="muted">(no delete candidates)</li>`
          : g.delete_candidates
              .map((c) => {
                const note = cautions.get(c.path);
                return `<li><code>${escapeHtml(c.path)}</code>${
                  note ? ` <span class="warn">[${note}]</span>` : ""
                }</li>`;
              })
              .join("");
      return `
<section class="group">
  <h2>Group ${i + 1}</h2>
  <p class="meta">BLAKE3 <code>${escapeHtml(g.hash)}</code> · size ${escapeHtml(
        formatBytes(g.keep.size),
      )} · reclaimable ${escapeHtml(formatBytes(g.reclaimable_bytes))}</p>
  <p><strong>Keep</strong> (${escapeHtml(g.keep_reason)}): <code>${escapeHtml(g.keep.path)}</code></p>
  <p><strong>Suggested delete</strong></p>
  <ul>${dels}</ul>
</section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Dup Finder audit ${escapeHtml(dateStamp())}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; color: #111; line-height: 1.45; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; margin-top: 1.5rem; }
  .summary { background: #f4f4f5; padding: 1rem 1.25rem; border-radius: 8px; }
  .group { border-top: 1px solid #e4e4e7; padding-top: 0.75rem; }
  code { font-size: 0.85em; word-break: break-all; }
  .meta { color: #52525b; font-size: 0.9rem; }
  .muted { color: #71717a; }
  .warn { color: #b45309; font-size: 0.85em; }
  footer { margin-top: 2rem; font-size: 0.85rem; color: #71717a; }
</style>
</head>
<body>
  <h1>Dup Finder — suggestion audit</h1>
  <div class="summary">
    <p>Generated <time datetime="${escapeHtml(when)}">${escapeHtml(when)}</time></p>
    <ul>
      <li>Files scanned (session): ${summary.scanned}</li>
      <li>Duplicate groups: ${summary.groups}</li>
      <li>Reclaimable if suggestions accepted: ${escapeHtml(formatBytes(summary.reclaimable))}</li>
    </ul>
    <p>This report lists <em>suggestions only</em>. Deletes require explicit user confirmation and TOCTOU re-verify.</p>
  </div>
  ${rows || "<p>No groups.</p>"}
  <footer>Dup Finder · local-only · no file contents included</footer>
</body>
</html>`;

  download(new Blob([html], { type: "text/html" }), `dup-finder-audit-${dateStamp()}.html`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reclaimableLabel(n: number): string {
  return formatBytes(n);
}
