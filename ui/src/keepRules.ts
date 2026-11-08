import type { FileRecord, SuggestReport } from "./api";

export type KeepRule = "newest_mtime" | "shortest_path" | "prefer_folder";

export const KEEP_RULE_OPTIONS: { id: KeepRule; label: string }[] = [
  { id: "newest_mtime", label: "Newest" },
  { id: "shortest_path", label: "Shortest path" },
  { id: "prefer_folder", label: "Prefer folder" },
];

function pathLen(p: string): number {
  return p.length;
}

function underPrefix(path: string, prefix: string): boolean {
  const p = prefix.replace(/\/+$/, "");
  if (!p) return false;
  return path === p || path.startsWith(p + "/") || path.startsWith(p + "\\");
}

/** Pick keep for one group under a user rule (does not call the server). */
export function pickKeepForRule(
  files: FileRecord[],
  rule: KeepRule,
  preferPrefix?: string,
): { keep: FileRecord; reason: string } {
  if (files.length === 0) {
    throw new Error("empty group");
  }
  const ranked = [...files];
  if (rule === "newest_mtime") {
    ranked.sort((a, b) => {
      const mt = (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1);
      if (mt !== 0) return mt;
      const pl = pathLen(a.path) - pathLen(b.path);
      if (pl !== 0) return pl;
      return a.path.localeCompare(b.path);
    });
    return { keep: ranked[0]!, reason: "newest_mtime" };
  }
  if (rule === "shortest_path") {
    ranked.sort((a, b) => {
      const pl = pathLen(a.path) - pathLen(b.path);
      if (pl !== 0) return pl;
      const mt = (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1);
      if (mt !== 0) return mt;
      return a.path.localeCompare(b.path);
    });
    return { keep: ranked[0]!, reason: "shortest_path" };
  }
  // prefer_folder
  const prefix = (preferPrefix || "").trim();
  const preferred = ranked.filter((f) => underPrefix(f.path, prefix));
  const pool = preferred.length > 0 ? preferred : ranked;
  pool.sort((a, b) => {
    const mt = (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1);
    if (mt !== 0) return mt;
    const pl = pathLen(a.path) - pathLen(b.path);
    if (pl !== 0) return pl;
    return a.path.localeCompare(b.path);
  });
  return {
    keep: pool[0]!,
    reason: preferred.length > 0 ? "prefer_folder" : "newest_mtime",
  };
}

/** Re-apply a keep rule across every duplicate group. */
export function applyKeepRule(
  suggest: SuggestReport,
  rule: KeepRule,
  preferPrefix?: string,
): SuggestReport {
  return {
    ...suggest,
    groups: suggest.groups.map((g) => {
      const files = [g.keep, ...g.delete_candidates];
      const { keep, reason } = pickKeepForRule(files, rule, preferPrefix);
      return {
        ...g,
        keep,
        keep_reason: reason,
        delete_candidates: files.filter((f) => f.path !== keep.path),
      };
    }),
  };
}

/** Human confidence for a similar-image cluster (dHash Hamming distance). */
export function similarConfidence(maxDistance: number): {
  label: string;
  level: "high" | "medium" | "low";
} {
  if (maxDistance <= 2) return { label: "Very similar", level: "high" };
  if (maxDistance <= 6) return { label: "Similar", level: "medium" };
  return { label: "Loosely similar", level: "low" };
}
