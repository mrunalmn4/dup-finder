import type { ScanFilters } from "./scanFilters";

export type FileRecord = {
  path: string;
  size: number;
  hash: string;
  mime: string;
  mtime_secs: number | null;
};

export type ScanResult = {
  roots: string[];
  files_scanned: number;
  files_skipped: number;
  groups: {
    hash: string;
    size: number;
    files: FileRecord[];
  }[];
  records: FileRecord[];
};

export type FileCaution = {
  path: string;
  level: "none" | "elevated" | "critical" | string;
  reason: string;
};

export type SuggestReport = {
  groups: {
    hash: string;
    keep: FileRecord;
    keep_reason: string;
    delete_candidates: FileRecord[];
    reclaimable_bytes: number;
    cautions?: FileCaution[];
  }[];
  total_reclaimable_bytes: number;
};

export type DeleteReport = {
  outcomes: { path: string; kind: string; reason: string }[];
  refused: boolean;
  refuse_reason: string | null;
};

export type ScanResponse = {
  scan_id: string;
  stats: { hashes_computed: number; hashes_reused: number };
  result: ScanResult;
};

export type ScanProgress = {
  phase: "walk" | "hash" | "done" | string;
  files_seen: number;
  files_hashed: number;
  bytes_hashed: number;
};

export type ScanJobState = {
  job_id: string;
  status: "running" | "ok" | "error" | "cancelled" | string;
  progress: ScanProgress;
  scan_id: string | null;
  error: string | null;
  stats: { hashes_computed: number; hashes_reused: number } | null;
};

export type QuarantinedFile = {
  path: string;
  original_parent: string;
  name: string;
  size: number;
};

export type ScheduledJob = {
  id: string;
  roots: string[];
  index_path: string | null;
  interval_secs: number;
  enabled: boolean;
  status: string;
  last_run_unix: number | null;
  last_scan_id: string | null;
  last_error: string | null;
  last_groups: number | null;
  last_reclaimable_bytes: number | null;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function baseUrl(): string {
  return localStorage.getItem("dup.api") || "http://127.0.0.1:7420";
}

function token(): string {
  return localStorage.getItem("dup.token") || "";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function saveConnection(api: string, tok: string) {
  localStorage.setItem("dup.api", api);
  localStorage.setItem("dup.token", tok);
}

export function loadConnection() {
  return { api: baseUrl(), token: token() };
}

export type SuggestedLocation = {
  path: string;
  label: string;
  kind: "drive" | "volume" | "folder" | string;
};

/** Native multi-folder / drive picker (desktop Tauri only). */
export async function pickFolders(): Promise<string[]> {
  if (!isTauri()) return [];
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: true,
    title: "Choose folders or drives to scan",
  });
  if (selected == null) return [];
  if (typeof selected === "string") return [selected];
  if (Array.isArray(selected)) return selected.filter((s) => typeof s === "string");
  return [];
}

/** @deprecated use pickFolders */
export async function pickFolder(): Promise<string | null> {
  const all = await pickFolders();
  return all[0] ?? null;
}

export function folderLabel(path: string): string {
  const norm = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = norm.split("/").filter(Boolean);
  if (parts.length === 0) return path;
  if (/^[a-zA-Z]:$/.test(parts[0]) && parts.length === 1) return `${parts[0]}\\`;
  return parts[parts.length - 1] || path;
}

export function locationKindLabel(kind: string): string {
  switch (kind) {
    case "drive":
      return "Drive";
    case "volume":
      return "Disk";
    case "folder":
      return "Folder";
    default:
      return "Place";
  }
}

export const client = {
  health: async () => {
    if (isTauri()) return invokeTauri<string>("health");
    return fetch(`${baseUrl()}/health`).then((r) => r.text());
  },
  locations: async (): Promise<SuggestedLocation[]> => {
    if (isTauri()) {
      return invokeTauri<SuggestedLocation[]>("list_locations");
    }
    try {
      return await api<SuggestedLocation[]>("/v1/locations");
    } catch {
      return [];
    }
  },
  scan: async (roots: string[], index_path?: string, filters?: ScanFilters) => {
    if (isTauri()) {
      return invokeTauri<ScanResponse>("scan", {
        roots,
        index_path: index_path ?? null,
        filters: filters ?? null,
      });
    }
    return api<ScanResponse>("/v1/scan", {
      method: "POST",
      body: JSON.stringify({
        roots,
        index_path: index_path || null,
        filters: filters ?? undefined,
      }),
    });
  },
  scanStart: async (roots: string[], index_path?: string, filters?: ScanFilters) => {
    if (isTauri()) {
      return invokeTauri<string>("scan_start", {
        roots,
        index_path: index_path ?? null,
        filters: filters ?? null,
      });
    }
    const res = await api<{ job_id: string }>("/v1/scan/start", {
      method: "POST",
      body: JSON.stringify({
        roots,
        index_path: index_path || null,
        filters: filters ?? undefined,
      }),
    });
    return res.job_id;
  },
  scanJob: async (job_id: string) => {
    if (isTauri()) {
      return invokeTauri<ScanJobState>("scan_job", { job_id });
    }
    return api<ScanJobState>(`/v1/scan/jobs/${encodeURIComponent(job_id)}`);
  },
  scanCancel: async (job_id: string) => {
    if (isTauri()) {
      await invokeTauri("scan_cancel", { job_id });
      return;
    }
    const res = await fetch(
      `${baseUrl()}/v1/scan/jobs/${encodeURIComponent(job_id)}/cancel`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      },
    );
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  },
  getScan: async (scan_id: string) => {
    if (isTauri()) {
      return invokeTauri<ScanResult>("get_scan", { scan_id });
    }
    return api<ScanResult>(`/v1/scans/${encodeURIComponent(scan_id)}`);
  },
  quarantineList: async (roots: string[]) => {
    if (isTauri()) {
      return invokeTauri<QuarantinedFile[]>("quarantine_list", { roots });
    }
    const q = encodeURIComponent(roots.join("\n"));
    return api<QuarantinedFile[]>(`/v1/quarantine?roots=${q}`);
  },
  quarantineRestore: async (path: string, roots: string[]) => {
    if (isTauri()) {
      return invokeTauri<string>("quarantine_restore", { path, roots });
    }
    const res = await api<{ path: string }>("/v1/restore", {
      method: "POST",
      body: JSON.stringify({ path, roots }),
    });
    return res.path;
  },
  previewUrl: async (path: string): Promise<string | null> => {
    try {
      if (isTauri()) {
        const [mime, bytes] = await invokeTauri<[string, number[]]>("preview_image", {
          path,
        });
        const u8 = new Uint8Array(bytes);
        return URL.createObjectURL(new Blob([u8], { type: mime }));
      }
      const res = await fetch(
        `${baseUrl()}/v1/preview?path=${encodeURIComponent(path)}`,
        { headers: { Authorization: `Bearer ${token()}` } },
      );
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },
  jobsList: async () => {
    if (isTauri()) return invokeTauri<ScheduledJob[]>("jobs_list");
    return api<ScheduledJob[]>("/v1/jobs");
  },
  jobsCreate: async (body: {
    roots: string[];
    index_path?: string | null;
    filters?: ScanFilters;
    interval_secs: number;
    enabled: boolean;
  }) => {
    if (isTauri()) {
      return invokeTauri<ScheduledJob>("jobs_create", {
        roots: body.roots,
        index_path: body.index_path ?? null,
        filters: body.filters ?? null,
        interval_secs: body.interval_secs,
        enabled: body.enabled,
      });
    }
    return api<ScheduledJob>("/v1/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  jobsDelete: async (job_id: string) => {
    if (isTauri()) {
      await invokeTauri("jobs_delete", { job_id });
      return;
    }
    const res = await fetch(`${baseUrl()}/v1/jobs/${encodeURIComponent(job_id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  },
  jobsRun: async (job_id: string) => {
    if (isTauri()) return invokeTauri<ScheduledJob>("jobs_run", { job_id });
    return api<ScheduledJob>(`/v1/jobs/${encodeURIComponent(job_id)}/run`, {
      method: "POST",
    });
  },
  suggest: async (scan_id: string) => {
    if (isTauri()) {
      return invokeTauri<SuggestReport>("suggest", { scan_id });
    }
    return api<SuggestReport>("/v1/suggest", {
      method: "POST",
      body: JSON.stringify({ scan_id }),
    });
  },
  delete: async (body: {
    scan_id: string;
    paths: string[];
    keep: string[];
    mode: "dry_run" | "trash" | "permanent";
    confirm: boolean;
  }) => {
    if (isTauri()) {
      return invokeTauri<DeleteReport>("delete", {
        scan_id: body.scan_id,
        paths: body.paths,
        keep: body.keep,
        mode: body.mode,
        confirm: body.confirm,
      });
    }
    return api<DeleteReport>("/v1/delete", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} KB`;
  return `${n} B`;
}
