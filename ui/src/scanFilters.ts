export type FileCategory =
  | "photos"
  | "videos"
  | "documents"
  | "audio"
  | "archives"
  | "other";

export const ALL_CATEGORIES: FileCategory[] = [
  "photos",
  "videos",
  "documents",
  "audio",
  "archives",
  "other",
];

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  photos: "Photos",
  videos: "Videos",
  documents: "Documents",
  audio: "Audio",
  archives: "Archives",
  other: "Other",
};

export type ScanFilters = {
  exclude_paths: string[];
  max_depth: number | null;
  include_hidden: boolean;
  min_size: number | null;
  max_size: number | null;
  /** Empty = all categories */
  categories: FileCategory[];
  include_extensions: string[];
  exclude_extensions: string[];
  exclude_names: string[];
};

export const DEFAULT_EXCLUDE_NAMES = [
  "node_modules",
  ".git",
  ".svn",
  "__pycache__",
  ".cache",
  "Caches",
  ".Trash",
  "$RECYCLE.BIN",
  "System Volume Information",
];

export function sensibleFilters(): ScanFilters {
  return {
    exclude_paths: [],
    max_depth: null,
    include_hidden: false,
    min_size: null,
    max_size: null,
    categories: [...ALL_CATEGORIES],
    include_extensions: [],
    exclude_extensions: [],
    exclude_names: [...DEFAULT_EXCLUDE_NAMES],
  };
}

const STORAGE_KEY = "dup.scanFilters.v1";

export function loadFilters(): ScanFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sensibleFilters();
    const parsed = JSON.parse(raw) as Partial<ScanFilters>;
    const base = sensibleFilters();
    return {
      ...base,
      ...parsed,
      exclude_paths: parsed.exclude_paths ?? base.exclude_paths,
      categories: parsed.categories?.length
        ? parsed.categories
        : base.categories,
      include_extensions: parsed.include_extensions ?? [],
      exclude_extensions: parsed.exclude_extensions ?? [],
      exclude_names: parsed.exclude_names ?? base.exclude_names,
    };
  } catch {
    return sensibleFilters();
  }
}

export function saveFilters(f: ScanFilters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

/** Payload for API/Tauri: empty categories means all types. */
export function filtersForApi(f: ScanFilters): ScanFilters {
  const allOn =
    ALL_CATEGORIES.length === f.categories.length &&
    ALL_CATEGORIES.every((c) => f.categories.includes(c));
  return {
    ...f,
    categories: allOn ? [] : f.categories,
  };
}

export function parseSizeInput(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = m[2] || "b";
  const mult =
    unit === "gb" ? 1e9 : unit === "mb" ? 1e6 : unit === "kb" ? 1e3 : 1;
  return Math.round(n * mult);
}

export function formatSizeInput(n: number | null): string {
  if (n == null) return "";
  if (n >= 1e9) return `${n / 1e9}gb`;
  if (n >= 1e6) return `${n / 1e6}mb`;
  if (n >= 1e3) return `${n / 1e3}kb`;
  return `${n}`;
}

export function splitTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
}

export function filterSummary(f: ScanFilters, rootCount: number): string {
  const parts: string[] = [
    `${rootCount} place${rootCount === 1 ? "" : "s"}`,
  ];
  const allOn =
    ALL_CATEGORIES.length === f.categories.length &&
    ALL_CATEGORIES.every((c) => f.categories.includes(c));
  if (!allOn && f.categories.length > 0) {
    parts.push(f.categories.map((c) => CATEGORY_LABELS[c]).join("+"));
  } else if (!allOn && f.categories.length === 0) {
    parts.push("no types");
  }
  if (f.min_size != null) parts.push(`≥${formatSizeInput(f.min_size)}`);
  if (f.max_size != null) parts.push(`≤${formatSizeInput(f.max_size)}`);
  if (f.max_depth != null) parts.push(`depth≤${f.max_depth}`);
  if (f.include_hidden) parts.push("incl. hidden");
  if (f.exclude_names.length) {
    parts.push(`hiding ${f.exclude_names.slice(0, 2).join(", ")}${f.exclude_names.length > 2 ? "…" : ""}`);
  }
  if (f.exclude_paths.length) {
    parts.push(`${f.exclude_paths.length} path exclude${f.exclude_paths.length === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
