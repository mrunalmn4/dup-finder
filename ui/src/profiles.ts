import type { ScanFilters } from "./scanFilters";
import { loadFilters, sensibleFilters } from "./scanFilters";

export type ScanProfile = {
  id: string;
  name: string;
  roots: string[];
  filters: ScanFilters;
};

const KEY = "dup.profiles.v1";

export function loadProfiles(): ScanProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProfiles(list: ScanProfile[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertProfile(name: string, roots: string[], filters: ScanFilters): ScanProfile {
  const list = loadProfiles();
  const existing = list.find((p) => p.name === name);
  if (existing) {
    existing.roots = roots;
    existing.filters = filters;
    saveProfiles(list);
    return existing;
  }
  const p: ScanProfile = {
    id: crypto.randomUUID(),
    name,
    roots,
    filters,
  };
  list.push(p);
  saveProfiles(list);
  return p;
}

export function deleteProfile(id: string) {
  saveProfiles(loadProfiles().filter((p) => p.id !== id));
}

export function defaultProfileFilters(): ScanFilters {
  return loadFilters() ?? sensibleFilters();
}
