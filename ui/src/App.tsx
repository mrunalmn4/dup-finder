import { useCallback, useEffect, useMemo, useState } from "react";
import {
  client,
  formatBytes,
  isTauri,
  loadConnection,
  pickFolders,
  saveConnection,
  type DeleteReport,
  type FileCaution,
  type FileRecord,
  type QuarantinedFile,
  type ScanProgress,
  type ScheduledJob,
  type SuggestedLocation,
  type SuggestReport,
} from "./api";
import { exportSuggestCsv, exportSuggestJson } from "./exportReport";
import FoldersPanel from "./FoldersPanel";
import HelpGuide from "./HelpGuide";
import ModeChooser from "./ModeChooser";
import Onboarding from "./Onboarding";
import {
  deleteProfile,
  loadProfiles,
  upsertProfile,
  type ScanProfile,
} from "./profiles";
import {
  filterSortGroups,
  type CautionFilter,
  type SortBy,
  type ViewMode,
} from "./reviewView";
import {
  clearSetupMode,
  loadSetupMode,
  saveSetupMode,
  type SetupMode,
} from "./setupMode";
import {
  filtersForApi,
  formatSizeInput,
  loadFilters,
  saveFilters,
  type FileCategory,
  type ScanFilters,
} from "./scanFilters";
import {
  clearSession,
  loadSession,
  saveSession,
  sessionIsResumable,
} from "./session";
import { cautionReasonLabel, keepReasonLabel } from "./suggestLabels";
import Thumb from "./Thumb";

type Step = "roots" | "results" | "confirm";

const STEPS: { id: Step; label: string }[] = [
  { id: "roots", label: "Folders" },
  { id: "results", label: "Review" },
  { id: "confirm", label: "Confirm" },
];

const ONBOARD_KEY = "dup.onboarding.v1";

function basenamePath(p: string): string {
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i < 0 ? n : n.slice(i + 1);
}

function friendlyPath(p: string): string {
  const base = basenamePath(p);
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  const parent = i <= 0 ? "" : n.slice(0, i);
  const parentBase = parent ? basenamePath(parent) : "";
  return parentBase ? `${parentBase} / ${base}` : base;
}

const bootSession = (() => {
  const s = loadSession();
  return sessionIsResumable(s) ? s : null;
})();

export default function App() {
  const desktop = isTauri();
  const initial = loadConnection();
  const [step, setStep] = useState<Step>(() => bootSession?.step ?? "roots");
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem(ONBOARD_KEY) !== "1" && !bootSession,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [pathEntryOpen, setPathEntryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(!desktop && !initial.token);
  const [apiUrl, setApiUrl] = useState(initial.api);
  const [token, setToken] = useState(initial.token);
  const [connected, setConnected] = useState(desktop);
  const [rootInput, setRootInput] = useState(
    desktop ? "" : "/app/docker/fixtures",
  );
  const [roots, setRoots] = useState<string[]>(() => bootSession?.roots ?? []);
  const [locations, setLocations] = useState<SuggestedLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [indexPath, setIndexPath] = useState(
    desktop ? "" : "/app/artifacts/ui-index.sqlite",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<ScanFilters>(() => loadFilters());
  const [excludePathInput, setExcludePathInput] = useState("");
  const [includeExtInput, setIncludeExtInput] = useState(() =>
    loadFilters().include_extensions.join(", "),
  );
  const [excludeExtInput, setExcludeExtInput] = useState(() =>
    loadFilters().exclude_extensions.join(", "),
  );
  const [excludeNameInput, setExcludeNameInput] = useState("");
  const [minSizeInput, setMinSizeInput] = useState(() =>
    formatSizeInput(loadFilters().min_size),
  );
  const [maxSizeInput, setMaxSizeInput] = useState(() =>
    formatSizeInput(loadFilters().max_size),
  );
  const [whatOpen, setWhatOpen] = useState(true);
  const [setupMode, setSetupMode] = useState<SetupMode | null>(() => loadSetupMode());
  const [pickingMode, setPickingMode] = useState(
    () => !bootSession && loadSetupMode() === null,
  );
  const [guidedSubstep, setGuidedSubstep] = useState(0);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [scanId, setScanId] = useState<string | null>(() => bootSession?.scanId ?? null);
  const [suggest, setSuggest] = useState<SuggestReport | null>(
    () => bootSession?.suggest ?? null,
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => bootSession?.selected ?? {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteReport, setDeleteReport] = useState<DeleteReport | null>(
    () => bootSession?.deleteReport ?? null,
  );
  const [trashDone, setTrashDone] = useState(() => bootSession?.trashDone ?? false);
  const [permanentOpen, setPermanentOpen] = useState(false);
  const [permanentPhrase, setPermanentPhrase] = useState("");
  const [deleteModeDone, setDeleteModeDone] = useState<"trash" | "permanent" | null>(
    () => bootSession?.deleteModeDone ?? null,
  );
  const [summary, setSummary] = useState<{
    scanned: number;
    groups: number;
    reclaimable: number;
    computed: number;
    reused: number;
  } | null>(() => bootSession?.summary ?? null);
  const [showFullPaths, setShowFullPaths] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    originalPaths: string[];
  } | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("reclaimable");
  const [cautionFilter, setCautionFilter] = useState<CautionFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [profiles, setProfiles] = useState<ScanProfile[]>(() => loadProfiles());
  const [profileName, setProfileName] = useState("");
  const [quarantine, setQuarantine] = useState<QuarantinedFile[]>([]);
  const [quarantineSel, setQuarantineSel] = useState<Record<string, boolean>>({});
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobInterval, setJobInterval] = useState(3600);
  const [notifyThresholdMb, setNotifyThresholdMb] = useState(() =>
    Number(localStorage.getItem("dup.notify.threshold_mb") || "1024"),
  );

  const selectedPaths = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );

  const keepPaths = useMemo(() => {
    if (!suggest) return [] as string[];
    return suggest.groups.map((g) => g.keep.path);
  }, [suggest]);

  const candidateCount = useMemo(() => {
    if (!suggest) return 0;
    return suggest.groups.reduce((n, g) => n + g.delete_candidates.length, 0);
  }, [suggest]);

  const visibleGroups = useMemo(() => {
    if (!suggest) return [];
    return filterSortGroups(suggest.groups, sortBy, cautionFilter, viewMode);
  }, [suggest, sortBy, cautionFilter, viewMode]);

  function cautionFor(path: string, cautions: FileCaution[] | undefined): FileCaution | undefined {
    return cautions?.find((c) => c.path === path && c.level !== "none");
  }

  function maybeNotifyReclaimable(bytes: number) {
    const threshold = (Number.isFinite(notifyThresholdMb) ? notifyThresholdMb : 1024) * 1e6;
    if (bytes < threshold) return;
    if (typeof Notification === "undefined") return;
    const body = `About ${formatBytes(bytes)} reclaimable after this scan.`;
    if (Notification.permission === "granted") {
      new Notification("Dup Finder", { body });
      return;
    }
    if (Notification.permission === "default") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification("Dup Finder", { body });
      });
    }
  }

  async function refreshQuarantine() {
    if (roots.length === 0) {
      setQuarantine([]);
      return;
    }
    try {
      const list = await client.quarantineList(roots);
      setQuarantine(list);
      setQuarantineSel({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function refreshJobs() {
    try {
      setJobs(await client.jobsList());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const selectedCritical = useMemo(() => {
    if (!suggest) return [] as FileCaution[];
    const out: FileCaution[] = [];
    for (const g of suggest.groups) {
      for (const c of g.cautions || []) {
        if (c.level === "critical" && selected[c.path]) out.push(c);
      }
    }
    return out;
  }, [suggest, selected]);

  const wouldDelete = useMemo(() => {
    if (!deleteReport) return [] as string[];
    return deleteReport.outcomes
      .filter((o) => o.kind === "would_delete" || o.kind === "WouldDelete")
      .map((o) => o.path);
  }, [deleteReport]);

  const skipped = useMemo(() => {
    if (!deleteReport) return [] as { path: string; reason: string }[];
    return deleteReport.outcomes
      .filter((o) => o.kind === "skipped" || o.kind === "Skipped")
      .map((o) => ({ path: o.path, reason: o.reason }));
  }, [deleteReport]);

  const loadLocations = useCallback(async () => {
    setLocationsError(null);
    try {
      const locs = await client.locations();
      setLocations(locs);
      if (locs.length === 0 && !desktop) {
        setLocationsError(
          "No places listed yet. Save & connect in Settings so we can show folders on the API machine, or type a path below.",
        );
      }
    } catch (e) {
      setLocations([]);
      setLocationsError(e instanceof Error ? e.message : String(e));
    }
  }, [desktop]);

  useEffect(() => {
    if (desktop) {
      setConnected(true);
      void loadLocations();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        saveConnection(apiUrl, token);
        const h = await client.health();
        if (!cancelled && h === "ok" && token) {
          setConnected(true);
          await loadLocations();
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          setSettingsOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentional: probe once on mount with saved connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop]);

  async function saveSettings() {
    setError(null);
    saveConnection(apiUrl, token);
    setBusy(true);
    try {
      if (!desktop) {
        const h = await client.health();
        if (h !== "ok") throw new Error("API unhealthy");
        if (!token.trim()) throw new Error("Bearer token required");
      }
      setConnected(true);
      setSettingsOpen(false);
      await loadLocations();
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function addRoot() {
    const v = rootInput.trim();
    if (!v || roots.includes(v)) return;
    setRoots((r) => [...r, v]);
    setRootInput("");
  }

  async function browseRoot() {
    const picked = await pickFolders();
    if (picked.length === 0) return;
    setRoots((r) => {
      const next = [...r];
      for (const p of picked) {
        if (!next.includes(p)) next.push(p);
      }
      return next;
    });
  }

  function toggleLocation(path: string) {
    setRoots((r) => (r.includes(path) ? r.filter((x) => x !== path) : [...r, path]));
  }

  function applyPreset(kind: "common" | "disks" | "demo" | "clear") {
    if (kind === "clear") {
      setRoots([]);
      return;
    }
    if (kind === "demo") {
      const demo =
        locations.find((l) => l.label.includes("Sample") || l.path.includes("fixtures"))
          ?.path ?? "/app/docker/fixtures";
      setRoots([demo]);
      return;
    }
    if (kind === "disks") {
      setRoots(
        locations
          .filter((l) => l.kind === "drive" || l.kind === "volume")
          .map((l) => l.path),
      );
      return;
    }
    // common folders: Home / Desktop / Documents / Downloads / Pictures
    const want = new Set(["Home", "Desktop", "Documents", "Downloads", "Pictures"]);
    setRoots(
      locations.filter((l) => want.has(l.label)).map((l) => l.path),
    );
  }

  /** Mid-scan or Review/Confirm — do not show mode chooser. */
  const canResumeActivity =
    step === "results" ||
    step === "confirm" ||
    (busy && scanProgress != null) ||
    sessionIsResumable(
      scanId && suggest
        ? {
            v: 1,
            step,
            scanId,
            suggest,
            selected,
            summary,
            roots,
            deleteReport,
            trashDone,
            deleteModeDone,
            savedAt: Date.now(),
          }
        : null,
    );

  const showModeChooser =
    step === "roots" &&
    !showOnboarding &&
    !canResumeActivity &&
    (pickingMode || setupMode === null);

  // Persist Review/Confirm so refresh can resume (API scan must still exist).
  useEffect(() => {
    if (step === "results" || step === "confirm") {
      if (!scanId || !suggest) return;
      saveSession({
        v: 1,
        step,
        scanId,
        suggest,
        selected,
        summary,
        roots,
        deleteReport,
        trashDone,
        deleteModeDone,
        savedAt: Date.now(),
      });
      return;
    }
    if (step === "roots" && !scanId) clearSession();
  }, [
    step,
    scanId,
    suggest,
    selected,
    summary,
    roots,
    deleteReport,
    trashDone,
    deleteModeDone,
  ]);

  // If we restored a session, confirm the server/desktop still has the scan.
  useEffect(() => {
    if (!bootSession?.scanId) return;
    let cancelled = false;
    (async () => {
      try {
        await client.getScan(bootSession.scanId!);
      } catch {
        if (cancelled) return;
        clearSession();
        setStep("roots");
        setScanId(null);
        setSuggest(null);
        setSummary(null);
        setDeleteReport(null);
        setTrashDone(false);
        setError("Previous scan expired on the server. Start a new scan.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickSetupMode(mode: SetupMode) {
    saveSetupMode(mode);
    setSetupMode(mode);
    setPickingMode(false);
    setGuidedSubstep(0);
    setMoreOptionsOpen(false);
    setWhatOpen(mode === "advanced");
    setRestoreOpen(false);
    if (mode === "smart") {
      applyPreset("common");
    }
  }

  function changeSetupMode() {
    if (canResumeActivity || busy) return;
    clearSetupMode();
    setSetupMode(null);
    setPickingMode(true);
    setGuidedSubstep(0);
    setMoreOptionsOpen(false);
  }

  // Smart mode: apply common folders once locations arrive if still empty.
  useEffect(() => {
    if (setupMode !== "smart" || roots.length > 0 || locations.length === 0) return;
    const want = new Set(["Home", "Desktop", "Documents", "Downloads", "Pictures"]);
    const common = locations.filter((l) => want.has(l.label)).map((l) => l.path);
    if (common.length > 0) setRoots(common);
  }, [setupMode, locations, roots.length]);

  function updateFilters(patch: Partial<ScanFilters>) {
    setFilters((f) => {
      const next = { ...f, ...patch };
      saveFilters(next);
      return next;
    });
  }

  function toggleCategory(cat: FileCategory) {
    setFilters((f) => {
      const has = f.categories.includes(cat);
      const categories = has
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat];
      const next = { ...f, categories };
      saveFilters(next);
      return next;
    });
  }

  function addExcludePath() {
    const v = excludePathInput.trim();
    if (!v || filters.exclude_paths.includes(v)) return;
    const underRoot = roots.some(
      (r) => v === r || v.startsWith(r.endsWith("/") || r.endsWith("\\") ? r : r + "/") ||
        v.startsWith(r + "\\"),
    );
    if (roots.length > 0 && !underRoot) {
      setError("Exclude path must be under a selected scan place.");
      return;
    }
    setError(null);
    updateFilters({ exclude_paths: [...filters.exclude_paths, v] });
    setExcludePathInput("");
  }

  const customRoots = useMemo(() => {
    const known = new Set(locations.map((l) => l.path));
    return roots.filter((r) => !known.has(r));
  }, [roots, locations]);

  const driveLocations = useMemo(
    () => locations.filter((l) => l.kind === "drive" || l.kind === "volume"),
    [locations],
  );
  const folderLocations = useMemo(
    () => locations.filter((l) => l.kind !== "drive" && l.kind !== "volume"),
    [locations],
  );

  function finishOnboarding() {
    localStorage.setItem(ONBOARD_KEY, "1");
    setShowOnboarding(false);
  }

  const prepareTour = useCallback(() => {
    setHelpOpen(false);
    setStep("roots");
    setSettingsOpen(false);
  }, []);

  function startTour() {
    prepareTour();
    setShowOnboarding(true);
  }

  function selectAllReclaimable() {
    if (!suggest) return;
    const sel: Record<string, boolean> = {};
    for (const g of suggest.groups) {
      for (const c of g.delete_candidates) sel[c.path] = true;
    }
    setSelected(sel);
  }

  function clearSelection() {
    setSelected({});
  }

  /** Check only this group's delete candidates (engine suggestion). */
  function acceptGroupSuggestion(hash: string) {
    if (!suggest) return;
    const g = suggest.groups.find((x) => x.hash === hash);
    if (!g) return;
    setSelected((s) => {
      const next = { ...s };
      for (const c of g.delete_candidates) next[c.path] = true;
      return next;
    });
  }

  /** Promote a candidate to keep; previous keep becomes an unchecked candidate. */
  function promoteKeep(hash: string, nextKeep: FileRecord) {
    setSuggest((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map((g) => {
          if (g.hash !== hash) return g;
          if (g.keep.path === nextKeep.path) return g;
          const rest = [
            g.keep,
            ...g.delete_candidates.filter((c) => c.path !== nextKeep.path),
          ];
          return {
            ...g,
            keep: nextKeep,
            keep_reason: "user_choice",
            delete_candidates: rest,
          };
        }),
      };
    });
    setSelected((s) => {
      const next = { ...s };
      next[nextKeep.path] = false;
      return next;
    });
  }

  async function runScan() {
    if (!desktop && !connected) {
      setSettingsOpen(true);
      setError("Connect to the local API in Settings first.");
      return;
    }
    if (filters.categories.length === 0) {
      setError("Select at least one file type under What should we look for?");
      return;
    }
    setError(null);
    setDeleteReport(null);
    setTrashDone(false);
    setUndoToast(null);
    clearSession();
    setBusy(true);
    setScanProgress({
      phase: "walk",
      files_seen: 0,
      files_hashed: 0,
      bytes_hashed: 0,
    });
    try {
      saveFilters(filters);
      const jobId = await client.scanStart(
        roots,
        indexPath || undefined,
        filtersForApi(filters),
      );
      let job = await client.scanJob(jobId);
      while (job.status === "running") {
        setScanProgress(job.progress);
        await new Promise((r) => setTimeout(r, 250));
        job = await client.scanJob(jobId);
      }
      setScanProgress(job.progress);
      if (job.status === "error") {
        throw new Error(job.error || "Scan failed");
      }
      if (!job.scan_id) throw new Error("Scan finished without scan_id");
      setScanId(job.scan_id);
      const scanResult = await client.getScan(job.scan_id);
      const sug = await client.suggest(job.scan_id);
      setSuggest(sug);
      setSelected({});
      setSummary({
        scanned: scanResult.files_scanned,
        groups: sug.groups.length,
        reclaimable: sug.total_reclaimable_bytes,
        computed: job.stats?.hashes_computed ?? 0,
        reused: job.stats?.hashes_reused ?? 0,
      });
      maybeNotifyReclaimable(sug.total_reclaimable_bytes);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setScanProgress(null);
    }
  }

  async function dryRunThenConfirm() {
    if (!scanId || selectedPaths.length === 0) return;
    setError(null);
    setTrashDone(false);
    setBusy(true);
    try {
      const report = await client.delete({
        scan_id: scanId,
        paths: selectedPaths,
        keep: keepPaths,
        mode: "dry_run",
        confirm: false,
      });
      setDeleteReport(report);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function trashSelected() {
    if (!scanId || wouldDelete.length === 0) return;
    setError(null);
    setBusy(true);
    const originals = [...wouldDelete];
    try {
      const report = await client.delete({
        scan_id: scanId,
        paths: wouldDelete,
        keep: keepPaths,
        mode: "trash",
        confirm: true,
      });
      setDeleteReport(report);
      setTrashDone(true);
      setDeleteModeDone("trash");
      setPermanentOpen(false);
      const deleted = report.outcomes.filter(
        (o) =>
          o.kind === "deleted" ||
          o.kind === "Deleted" ||
          o.kind.toLowerCase() === "deleted",
      );
      if (deleted.length > 0) {
        setUndoToast({ originalPaths: originals });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function undoTrashFromQuarantine() {
    if (!undoToast) return;
    setBusy(true);
    setError(null);
    try {
      const list = await client.quarantineList(roots);
      const wanted = new Set(undoToast.originalPaths.map(basenamePath));
      let restored = 0;
      for (const q of list) {
        if (!wanted.has(q.name) && !wanted.has(basenamePath(q.path))) continue;
        await client.quarantineRestore(q.path, roots);
        restored += 1;
      }
      setUndoToast(null);
      if (restored === 0) {
        setError(
          "Nothing to undo in Dup Finder quarantine (files may be in the system Trash).",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function permanentSelected() {
    if (!scanId || wouldDelete.length === 0) return;
    if (permanentPhrase.trim().toUpperCase() !== "DELETE") {
      setError('Type DELETE to confirm permanent removal.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const report = await client.delete({
        scan_id: scanId,
        paths: wouldDelete,
        keep: keepPaths,
        mode: "permanent",
        confirm: true,
      });
      setDeleteReport(report);
      setTrashDone(true);
      setDeleteModeDone("permanent");
      setPermanentOpen(false);
      setPermanentPhrase("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="app">
      {showOnboarding && (
        <Onboarding
          desktop={desktop}
          onDone={finishOnboarding}
          onPrepare={prepareTour}
        />
      )}
      {helpOpen && (
        <HelpGuide
          desktop={desktop}
          onClose={() => setHelpOpen(false)}
          onStartTour={startTour}
        />
      )}

      <header className="brand" data-tour="tour-brand">
        <div className="brand-row">
          <h1>Dup Finder</h1>
          <div className="header-actions">
            <button
              type="button"
              className="ghost settings-btn"
              data-tour="tour-help"
              onClick={() => setHelpOpen(true)}
            >
              Help
            </button>
            <button
              type="button"
              className="ghost settings-btn"
              onClick={startTour}
            >
              Show tour
            </button>
            {step === "roots" &&
              setupMode &&
              !pickingMode &&
              !canResumeActivity &&
              !busy && (
                <button
                  type="button"
                  className="ghost settings-btn"
                  onClick={changeSetupMode}
                >
                  Change mode
                </button>
              )}
            <button
              type="button"
              className="ghost settings-btn"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
            >
              Settings
            </button>
          </div>
        </div>
        <p>
          Find duplicate files on your computer, review suggestions, and remove
          only what you confirm.
        </p>
      </header>

      <nav className="stepper" aria-label="Progress" data-tour="tour-stepper">
        {STEPS.map((s, i) => {
          const state =
            i < stepIndex ? "done" : i === stepIndex ? "current" : "todo";
          return (
            <div key={s.id} className={`step step-${state}`}>
              <span className="step-num" aria-hidden>
                {i + 1}
              </span>
              <span className="step-label">{s.label}</span>
            </div>
          );
        })}
      </nav>

      {error && <p className="error">{error}</p>}

      {settingsOpen && (
        <section className="panel">
          <h2>Settings</h2>
          {!desktop && (
            <>
              <h3 className="loc-heading">API connection</h3>
              <p className="meta" style={{ marginBottom: "0.75rem" }}>
                Local-only. Token is stored in this browser; it is never logged by
                the server.
              </p>
              <div className="row">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="http://127.0.0.1:7420"
                  aria-label="API URL"
                />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Bearer token"
                  aria-label="Token"
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={saveSettings}
                >
                  {busy ? "Saving…" : "Save & connect"}
                </button>
              </div>
              <p className={`meta ${connected ? "ok" : ""}`} style={{ marginTop: "0.65rem" }}>
                {connected ? "Connected" : "Not connected"}
              </p>
            </>
          )}
          <h3 className="loc-heading">Notifications</h3>
          <label className="field-label" style={{ display: "block" }}>
            Notify when reclaimable ≥ (MB)
            <input
              type="number"
              min={1}
              value={notifyThresholdMb}
              onChange={(e) => {
                const n = Number(e.target.value) || 1024;
                setNotifyThresholdMb(n);
                localStorage.setItem("dup.notify.threshold_mb", String(n));
              }}
              aria-label="Reclaimable notify threshold MB"
            />
          </label>
          <p className="meta">
            Local notification after a scan when reclaimable bytes meet this threshold
            (default 1024 MB). Permission is requested once.
          </p>
          {(desktop || connected) && (
            <>
              <h3 className="loc-heading">Scheduled jobs</h3>
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setJobsOpen((o) => !o);
                  if (!jobsOpen) void refreshJobs();
                }}
                aria-expanded={jobsOpen}
              >
                {jobsOpen ? "Hide jobs" : "Manage scheduled scans"}
              </button>
              {jobsOpen && (
                <div className="jobs-panel">
                  <div className="row" style={{ marginTop: "0.55rem" }}>
                    <label className="field-label">
                      Interval (secs)
                      <input
                        type="number"
                        min={60}
                        value={jobInterval}
                        onChange={(e) => setJobInterval(Math.max(60, Number(e.target.value) || 3600))}
                        aria-label="Job interval seconds"
                      />
                    </label>
                    <button
                      type="button"
                      className="primary"
                      disabled={busy || roots.length === 0}
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          await client.jobsCreate({
                            roots,
                            index_path: indexPath || null,
                            filters: filtersForApi(filters),
                            interval_secs: jobInterval,
                            enabled: true,
                          });
                          await refreshJobs();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Create from current roots
                    </button>
                    <button type="button" className="ghost" onClick={() => void refreshJobs()}>
                      Refresh
                    </button>
                  </div>
                  {jobs.length === 0 ? (
                    <p className="meta">No scheduled jobs yet.</p>
                  ) : (
                    <ul className="roots">
                      {jobs.map((j) => (
                        <li key={j.id}>
                          <span className="path">
                            {j.id.slice(0, 8)}… · every {j.interval_secs}s · {j.status}
                            {j.last_reclaimable_bytes != null
                              ? ` · last reclaimable ${formatBytes(j.last_reclaimable_bytes)}`
                              : ""}
                          </span>
                          <div className="row" style={{ marginTop: "0.35rem" }}>
                            <button
                              type="button"
                              className="ghost compact"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await client.jobsRun(j.id);
                                  await refreshJobs();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Run now
                            </button>
                            <button
                              type="button"
                              className="ghost compact"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await client.jobsDelete(j.id);
                                  await refreshJobs();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : String(e));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {showModeChooser && <ModeChooser onPick={pickSetupMode} />}

      {step === "roots" && setupMode && !showModeChooser && (
        <FoldersPanel
          mode={setupMode}
          desktop={desktop}
          connected={connected}
          busy={busy}
          roots={roots}
          locations={locations}
          locationsError={locationsError}
          driveLocations={driveLocations}
          folderLocations={folderLocations}
          customRoots={customRoots}
          filters={filters}
          whatOpen={whatOpen}
          setWhatOpen={setWhatOpen}
          moreOptionsOpen={moreOptionsOpen}
          setMoreOptionsOpen={setMoreOptionsOpen}
          guidedSubstep={guidedSubstep}
          setGuidedSubstep={setGuidedSubstep}
          pathEntryOpen={pathEntryOpen}
          setPathEntryOpen={setPathEntryOpen}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          rootInput={rootInput}
          setRootInput={setRootInput}
          indexPath={indexPath}
          setIndexPath={setIndexPath}
          excludePathInput={excludePathInput}
          setExcludePathInput={setExcludePathInput}
          includeExtInput={includeExtInput}
          setIncludeExtInput={setIncludeExtInput}
          excludeExtInput={excludeExtInput}
          setExcludeExtInput={setExcludeExtInput}
          excludeNameInput={excludeNameInput}
          setExcludeNameInput={setExcludeNameInput}
          minSizeInput={minSizeInput}
          setMinSizeInput={setMinSizeInput}
          maxSizeInput={maxSizeInput}
          setMaxSizeInput={setMaxSizeInput}
          profiles={profiles}
          profileName={profileName}
          setProfileName={setProfileName}
          setProfiles={setProfiles}
          setRoots={setRoots}
          setFilters={(fn) => {
            setFilters((f) => {
              const next = typeof fn === "function" ? fn(f) : fn;
              saveFilters(next);
              return next;
            });
          }}
          updateFilters={updateFilters}
          toggleLocation={toggleLocation}
          toggleCategory={toggleCategory}
          addRoot={addRoot}
          addExcludePath={addExcludePath}
          browseRoot={browseRoot}
          applyPreset={applyPreset}
          loadLocations={loadLocations}
          runScan={runScan}
          scanProgress={scanProgress}
          restoreOpen={restoreOpen}
          setRestoreOpen={setRestoreOpen}
          quarantine={quarantine}
          quarantineSel={quarantineSel}
          setQuarantineSel={setQuarantineSel}
          refreshQuarantine={refreshQuarantine}
          restoreSelected={async () => {
            setBusy(true);
            setError(null);
            try {
              for (const [path, on] of Object.entries(quarantineSel)) {
                if (!on) continue;
                await client.quarantineRestore(path, roots);
              }
              await refreshQuarantine();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
          saveProfile={() => {
            upsertProfile(profileName.trim(), roots, filters);
            setProfiles(loadProfiles());
            setProfileName("");
          }}
          loadProfile={(prof) => {
            setRoots(prof.roots);
            setFilters(prof.filters);
            saveFilters(prof.filters);
            setMinSizeInput(formatSizeInput(prof.filters.min_size));
            setMaxSizeInput(formatSizeInput(prof.filters.max_size));
            setIncludeExtInput(prof.filters.include_extensions.join(", "));
            setExcludeExtInput(prof.filters.exclude_extensions.join(", "));
          }}
          deleteProfileById={(id) => {
            deleteProfile(id);
            setProfiles(loadProfiles());
          }}
        />
      )}

      {(step === "results" || step === "confirm") && summary && (
        <section className="panel">
          <h2>Scan summary</h2>
          <div className="stats">
            <div className="stat">
              <strong>{summary.scanned}</strong>
              <span>files scanned</span>
            </div>
            <div className="stat">
              <strong>{summary.groups}</strong>
              <span>duplicate groups</span>
            </div>
            <div className="stat">
              <strong>{formatBytes(summary.reclaimable)}</strong>
              <span>reclaimable</span>
            </div>
            <div className="stat">
              <strong>
                {summary.computed}/{summary.reused}
              </strong>
              <span>hashed / reused</span>
            </div>
          </div>
        </section>
      )}

      {step === "results" && suggest && (
        <section className="panel">
          <div className="panel-head">
            <h2>Duplicates</h2>
            <div className="row">
              <button
                type="button"
                className="ghost"
                disabled={!summary}
                onClick={() =>
                  summary &&
                  exportSuggestJson(suggest, {
                    scanned: summary.scanned,
                    groups: summary.groups,
                    reclaimable: summary.reclaimable,
                  })
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => exportSuggestCsv(suggest)}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="ghost"
                disabled={candidateCount === 0}
                onClick={selectAllReclaimable}
              >
                Select all reclaimable
              </button>
              <button
                type="button"
                className="ghost"
                disabled={selectedPaths.length === 0}
                onClick={clearSelection}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="review-controls" role="group" aria-label="Review filters">
            <label className="field-label">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                aria-label="Sort groups"
              >
                <option value="reclaimable">Reclaimable size</option>
                <option value="size">File size</option>
                <option value="path">Path</option>
              </select>
            </label>
            <div className="chip-row" role="group" aria-label="Caution filter">
              {(
                [
                  ["all", "All"],
                  ["caution", "Has caution"],
                  ["critical", "Critical only"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip${cautionFilter === id ? " chip-on" : ""}`}
                  aria-pressed={cautionFilter === id}
                  onClick={() => setCautionFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="chip-row" role="group" aria-label="View mode">
              {(
                [
                  ["all", "All groups"],
                  ["same-folder", "Same folder"],
                  ["cross-folder", "Cross folder"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip${viewMode === id ? " chip-on" : ""}`}
                  aria-pressed={viewMode === id}
                  onClick={() => setViewMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="check-line" style={{ marginBottom: "0.75rem" }}>
            <input
              type="checkbox"
              checked={showFullPaths}
              onChange={(e) => setShowFullPaths(e.target.checked)}
            />
            Show full paths
          </label>
          {suggest.groups.length === 0 && (
            <div className="empty-state">
              <strong>No duplicates found</strong>
              <p className="meta">
                Nothing looks like an exact copy in these places. Try adding more
                folders, or include more file types under Change mode → Guided /
                Advanced.
              </p>
              <button type="button" className="primary" onClick={() => setStep("roots")}>
                Pick more folders
              </button>
            </div>
          )}
          {suggest.groups.length > 0 && visibleGroups.length === 0 && (
            <div className="empty-state">
              <strong>Nothing matches these filters</strong>
              <p className="meta">
                Try “All” for caution and view filters, or clear the sort chips above.
              </p>
            </div>
          )}
          {visibleGroups.map((g) => {
            const groupCritical = (g.cautions || []).some((c) => c.level === "critical");
            return (
            <div className="group" key={g.hash}>
              <div className="group-head">
                <div className="meta">
                  {formatBytes(g.reclaimable_bytes)} reclaimable ·{" "}
                  {keepReasonLabel(g.keep_reason)}
                  {groupCritical && (
                    <span className="badge warn"> contains system/app paths</span>
                  )}
                </div>
                <button
                  type="button"
                  className="ghost compact"
                  disabled={g.delete_candidates.length === 0}
                  onClick={() => acceptGroupSuggestion(g.hash)}
                  title={
                    groupCritical
                      ? "Suggestion includes sensitive paths — review each file"
                      : undefined
                  }
                >
                  Accept suggestion
                </button>
              </div>
              <div className="keep-row">
                <Thumb path={g.keep.path} mime={g.keep.mime} />
                <div>
                  <div className="path" title={g.keep.path}>
                    {showFullPaths ? g.keep.path : friendlyPath(g.keep.path)}
                    <span className="badge">keep</span>
                    {cautionFor(g.keep.path, g.cautions) && (
                      <span className="badge warn">caution</span>
                    )}
                  </div>
                  <div className="meta">
                    {g.keep.mime} · {formatBytes(g.keep.size)}
                    {cautionFor(g.keep.path, g.cautions) && (
                      <>
                        {" "}
                        · {cautionReasonLabel(cautionFor(g.keep.path, g.cautions)!.reason)}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {g.delete_candidates.map((c) => {
                const caution = cautionFor(c.path, g.cautions);
                return (
                <div key={c.path} className="candidate-row">
                  <Thumb path={c.path} mime={c.mime} />
                  <label className="candidate">
                    <input
                      type="checkbox"
                      checked={!!selected[c.path]}
                      onChange={(e) =>
                        setSelected((s) => ({
                          ...s,
                          [c.path]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="path" title={c.path}>
                        {showFullPaths ? c.path : friendlyPath(c.path)}
                        <span className="badge drop">candidate</span>
                        {caution?.level === "critical" && (
                          <span className="badge danger">critical</span>
                        )}
                        {caution?.level === "elevated" && (
                          <span className="badge warn">caution</span>
                        )}
                      </span>
                      <span className="meta">
                        {c.mime} · {formatBytes(c.size)}
                        {caution && <> · {cautionReasonLabel(caution.reason)}</>}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => promoteKeep(g.hash, c)}
                  >
                    Keep this instead
                  </button>
                </div>
              );
              })}
            </div>
          );
          })}
          {selectedCritical.length > 0 && (
            <div className="warn-box" role="alert">
              <strong>Critical paths selected</strong>
              <p className="meta">
                These look like system, application, or credential files. Trashing
                them can break the OS or apps. Prefer leaving them unchecked unless
                you are certain.
              </p>
              <ul className="roots">
                {selectedCritical.map((c) => (
                  <li key={c.path}>
                    <span className="path">
                      {c.path} — {cautionReasonLabel(c.reason)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="row" style={{ marginTop: "1rem" }}>
            <button type="button" className="ghost" onClick={() => setStep("roots")}>
              Back
            </button>
            <button
              type="button"
              className="primary"
              disabled={busy || selectedPaths.length === 0}
              onClick={dryRunThenConfirm}
            >
              {busy
                ? "Previewing…"
                : selectedCritical.length > 0
                  ? `Preview delete (${selectedPaths.length}) — includes critical`
                  : `Preview delete (${selectedPaths.length})`}
            </button>
          </div>
        </section>
      )}

      {step === "confirm" && (
        <section className="panel">
          <h2>Confirm remove</h2>
          <p className="meta">
            Only paths that passed dry-run will be removed. Each file is
            re-hashed immediately before remove. Trash uses the OS Trash /
            Recycle Bin when available; otherwise a{" "}
            <code>.dup-finder-trash</code> folder beside the original.
          </p>
          <div className="confirm-box">
            <strong>
              Will remove ({wouldDelete.length})
            </strong>
            {wouldDelete.length === 0 ? (
              <p className="meta">Nothing to remove — dry-run skipped all paths.</p>
            ) : (
              <ul className="roots">
                {wouldDelete.map((p) => (
                  <li key={p}>
                    <span className="path">{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {skipped.length > 0 && (
              <>
                <strong>Skipped</strong>
                <ul className="roots">
                  {skipped.map((o) => (
                    <li key={o.path + o.reason}>
                      <span className="path">
                        {o.path}
                        <span className="badge"> {o.reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <strong>Protected keep</strong>
            <ul className="roots">
              {keepPaths.map((p) => (
                <li key={p}>
                  <span className="path">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          {deleteReport && trashDone && (
            <div style={{ marginTop: "1rem" }}>
              <p className={deleteReport.refused ? "error" : "ok"}>
                {deleteModeDone === "permanent" ? "Permanent delete" : "Trash"}{" "}
                finished: {deleteReport.outcomes.length} outcomes
                {deleteReport.refused
                  ? ` · refused ${deleteReport.refuse_reason}`
                  : ""}
              </p>
              <ul className="roots">
                {deleteReport.outcomes.map((o) => (
                  <li key={o.path + o.reason + o.kind}>
                    <span className="path">
                      {o.kind}: {showFullPaths ? o.path : friendlyPath(o.path)} ({o.reason})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {undoToast && deleteModeDone === "trash" && (
            <div className="undo-toast" role="status">
              <p>
                Files moved to trash. If they landed in{" "}
                <code>.dup-finder-trash</code>, you can restore them now.
              </p>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void undoTrashFromQuarantine()}
                >
                  Undo from quarantine
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setUndoToast(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="row" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setTrashDone(false);
                setDeleteModeDone(null);
                setPermanentOpen(false);
                setPermanentPhrase("");
                setUndoToast(null);
                setStep("results");
              }}
            >
              Back
            </button>
            {suggest && summary && (
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  exportSuggestJson(suggest, {
                    scanned: summary.scanned,
                    groups: summary.groups,
                    reclaimable: summary.reclaimable,
                  })
                }
              >
                Export JSON
              </button>
            )}
            <button
              type="button"
              className="danger"
              disabled={busy || wouldDelete.length === 0 || trashDone}
              onClick={trashSelected}
            >
              {busy && !permanentOpen
                ? "Trashing…"
                : trashDone
                  ? "Done"
                  : `Trash ${wouldDelete.length} file${wouldDelete.length === 1 ? "" : "s"}`}
            </button>
          </div>
          {!trashDone && wouldDelete.length > 0 && (
            <div className="permanent-box">
              <button
                type="button"
                className="linkish"
                onClick={() => setPermanentOpen((o) => !o)}
                aria-expanded={permanentOpen}
              >
                {permanentOpen
                  ? "Hide permanent delete"
                  : "Delete permanently instead…"}
              </button>
              {permanentOpen && (
                <div style={{ marginTop: "0.65rem" }}>
                  {selectedCritical.length > 0 && (
                    <div className="warn-box" role="alert" style={{ marginBottom: "0.75rem" }}>
                      <strong>Stop — critical paths are in this batch</strong>
                      <p className="meta">
                        Permanent delete cannot be undone and may break apps or the
                        OS. Prefer Trash, or go back and uncheck critical items.
                      </p>
                    </div>
                  )}
                  <p className="meta">
                    Permanent delete cannot be undone. Type{" "}
                    <strong>DELETE</strong> to enable.
                  </p>
                  <div className="row" style={{ marginTop: "0.45rem" }}>
                    <input
                      type="text"
                      value={permanentPhrase}
                      onChange={(e) => setPermanentPhrase(e.target.value)}
                      placeholder="DELETE"
                      aria-label="Type DELETE to confirm permanent"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="danger"
                      disabled={
                        busy ||
                        permanentPhrase.trim().toUpperCase() !== "DELETE"
                      }
                      onClick={permanentSelected}
                    >
                      {busy ? "Deleting…" : "Delete permanently"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
