import type { SuggestReport } from "./api";

export type SortBy = "reclaimable" | "size" | "path";
export type CautionFilter = "all" | "caution" | "critical";
export type ViewMode = "all" | "same-folder" | "cross-folder";

export function parentDir(p: string): string {
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i <= 0 ? n : n.slice(0, i);
}

export function isSameFolderGroup(g: SuggestReport["groups"][number]): boolean {
  const parents = new Set([
    parentDir(g.keep.path),
    ...g.delete_candidates.map((c) => parentDir(c.path)),
  ]);
  return parents.size === 1;
}

export function filterSortGroups(
  groups: SuggestReport["groups"],
  sortBy: SortBy,
  cautionFilter: CautionFilter,
  viewMode: ViewMode,
): SuggestReport["groups"] {
  let list = [...groups];
  if (cautionFilter === "caution") {
    list = list.filter((g) =>
      (g.cautions || []).some((c) => c.level === "elevated" || c.level === "critical"),
    );
  } else if (cautionFilter === "critical") {
    list = list.filter((g) => (g.cautions || []).some((c) => c.level === "critical"));
  }
  if (viewMode === "same-folder") {
    list = list.filter(isSameFolderGroup);
  } else if (viewMode === "cross-folder") {
    list = list.filter((g) => !isSameFolderGroup(g));
  }
  list.sort((a, b) => {
    switch (sortBy) {
      case "reclaimable":
        return b.reclaimable_bytes - a.reclaimable_bytes;
      case "size":
        return b.keep.size - a.keep.size;
      case "path":
        return a.keep.path.localeCompare(b.keep.path);
      default: {
        const _exhaustive: never = sortBy;
        return _exhaustive;
      }
    }
  });
  return list;
}
