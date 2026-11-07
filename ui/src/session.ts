import type { DeleteReport, SuggestReport } from "./api";

export type PersistedSession = {
  v: 1;
  step: "roots" | "results" | "confirm";
  scanId: string | null;
  suggest: SuggestReport | null;
  selected: Record<string, boolean>;
  summary: {
    scanned: number;
    groups: number;
    reclaimable: number;
    computed: number;
    reused: number;
  } | null;
  roots: string[];
  deleteReport: DeleteReport | null;
  trashDone: boolean;
  deleteModeDone: "trash" | "permanent" | null;
  savedAt: number;
};

const KEY = "dup.session.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (parsed?.v !== 1) return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(s: PersistedSession) {
  localStorage.setItem(KEY, JSON.stringify({ ...s, v: 1 as const, savedAt: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

/** True when UI should resume Review/Confirm instead of mode chooser. */
export function sessionIsResumable(s: PersistedSession | null): boolean {
  if (!s) return false;
  if (s.step === "results" && s.suggest && s.scanId) return true;
  if (s.step === "confirm" && s.deleteReport && s.scanId) return true;
  return false;
}
