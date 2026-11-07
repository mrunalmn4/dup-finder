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
