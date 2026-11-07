import { useCallback, useEffect, useMemo, useState } from "react";
import {
  client,
  folderLabel,
  formatBytes,
  isTauri,
  loadConnection,
  locationKindLabel,
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
import HelpGuide from "./HelpGuide";
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
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  filterSummary,
  filtersForApi,
  formatSizeInput,
  loadFilters,
  parseSizeInput,
  saveFilters,
  sensibleFilters,
  splitTags,
  type FileCategory,
  type ScanFilters,
} from "./scanFilters";
import { cautionReasonLabel, keepReasonLabel } from "./suggestLabels";
import Thumb from "./Thumb";

type Step = "roots" | "results" | "confirm";

const STEPS: { id: Step; label: string }[] = [
  { id: "roots", label: "Folders" },
  { id: "results", label: "Review" },
  { id: "confirm", label: "Confirm" },
];

const ONBOARD_KEY = "dup.onboarding.v1";

export default function App() {
  const desktop = isTauri();
  const initial = loadConnection();
  const [step, setStep] = useState<Step>("roots");
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem(ONBOARD_KEY) !== "1",
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
  const [roots, setRoots] = useState<string[]>([]);
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
  const [scanId, setScanId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<SuggestReport | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteReport, setDeleteReport] = useState<DeleteReport | null>(null);
  const [trashDone, setTrashDone] = useState(false);
  const [permanentOpen, setPermanentOpen] = useState(false);
  const [permanentPhrase, setPermanentPhrase] = useState("");
  const [deleteModeDone, setDeleteModeDone] = useState<"trash" | "permanent" | null>(
    null,
  );
  const [summary, setSummary] = useState<{
    scanned: number;
    groups: number;
    reclaimable: number;
    computed: number;
    reused: number;
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
            {!desktop && (
              <button
                type="button"
                className="ghost settings-btn"
                onClick={() => setSettingsOpen((o) => !o)}
                aria-expanded={settingsOpen}
              >
                Settings
              </button>
            )}
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

      {step === "roots" && (
        <section className="panel">
          <h2>Where should we look?</h2>
          <p className="meta" style={{ marginBottom: "1rem" }}>
            Tap drives and folders to select them (you can pick several). We only
            scan what you turn on.
          </p>

          <div className="chooser" data-tour="tour-folders">
            {driveLocations.length > 0 && (
              <>
                <h3 className="loc-heading">Drives &amp; disks</h3>
                <div className="loc-grid" role="group" aria-label="Drives and disks">
                  {driveLocations.map((loc) => {
                    const on = roots.includes(loc.path);
                    return (
                      <button
                        key={loc.path}
                        type="button"
                        className={`loc-tile${on ? " loc-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleLocation(loc.path)}
                      >
                        <span className="loc-kind">{locationKindLabel(loc.kind)}</span>
                        <strong className="loc-label">{loc.label}</strong>
                        <span className="loc-path">{loc.path}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {folderLocations.length > 0 && (
              <>
                <h3 className="loc-heading">Folders</h3>
                <div className="loc-grid" role="group" aria-label="Folders">
                  {folderLocations.map((loc) => {
                    const on = roots.includes(loc.path);
                    return (
                      <button
                        key={loc.path}
                        type="button"
                        className={`loc-tile${on ? " loc-on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleLocation(loc.path)}
                      >
                        <span className="loc-kind">{locationKindLabel(loc.kind)}</span>
                        <strong className="loc-label">{loc.label}</strong>
                        <span className="loc-path">{loc.path}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {locationsError && <p className="meta">{locationsError}</p>}

            {!desktop && locations.length === 0 && (
              <p className="empty-hint">
                Connect the local API (Settings) to list places on that machine.
                Docker demo path:{" "}
                <button
                  type="button"
                  className="linkish"
                  style={{ marginTop: 0, display: "inline" }}
                  onClick={() => toggleLocation("/app/docker/fixtures")}
                >
                  /app/docker/fixtures
                </button>
                . Full drive picking needs the desktop app.
              </p>
            )}

            <div className="preset-row" role="group" aria-label="Quick presets">
              <span className="meta">Presets:</span>
              <button type="button" className="ghost compact" onClick={() => applyPreset("common")}>
                Common folders
              </button>
              <button type="button" className="ghost compact" onClick={() => applyPreset("disks")}>
                Disks only
              </button>
              <button type="button" className="ghost compact" onClick={() => applyPreset("demo")}>
                Sample demo
              </button>
              <button type="button" className="ghost compact" onClick={() => applyPreset("clear")}>
                Clear
              </button>
            </div>

            <div className="row" style={{ marginTop: "0.85rem" }}>
              {desktop && (
                <button type="button" className="primary" onClick={browseRoot}>
                  Browse for more…
                </button>
              )}
              <button
                type="button"
                className="ghost"
                onClick={() => void loadLocations()}
                disabled={!desktop && !connected}
              >
                Refresh list
              </button>
            </div>
            <p className="meta chooser-hint">
              {desktop
                ? "Selected tiles are scanned. Use Browse for any other folder or whole drive."
                : "Tiles come from the API computer (inside Docker that is the container). Your Mac/Windows drives appear in the desktop app."}
            </p>
          </div>

          <div className="where-extra">
            <h3 className="loc-heading">Where extras</h3>
            <label className="check-line">
              <input
                type="checkbox"
                checked={filters.include_hidden}
                onChange={(e) => updateFilters({ include_hidden: e.target.checked })}
              />
              Include hidden files and folders
            </label>
            <div className="row" style={{ marginTop: "0.55rem" }}>
              <label className="field-label">
                Max depth
                <input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={filters.max_depth ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    updateFilters({
                      max_depth: v === "" ? null : Math.max(0, Number(v) || 0),
                    });
                  }}
                  aria-label="Max folder depth"
                />
              </label>
            </div>
            <p className="meta" style={{ marginTop: "0.65rem" }}>
              Exclude these folders (must be under a selected place)
            </p>
            <div className="chip-list">
              {filters.exclude_paths.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip"
                  onClick={() =>
                    updateFilters({
                      exclude_paths: filters.exclude_paths.filter((x) => x !== p),
                    })
                  }
                >
                  {folderLabel(p)} ×
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: "0.45rem" }}>
              <input
                type="text"
                value={excludePathInput}
                onChange={(e) => setExcludePathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExcludePath()}
                placeholder="Path to skip"
                aria-label="Exclude path"
              />
              <button type="button" className="ghost" onClick={addExcludePath}>
                Exclude
              </button>
            </div>
          </div>

          <button
            type="button"
            className="linkish"
            onClick={() => setWhatOpen((o) => !o)}
            aria-expanded={whatOpen}
          >
            {whatOpen ? "Hide: What should we look for?" : "What should we look for?"}
          </button>
          {whatOpen && (
            <div className="what-panel" data-tour="tour-what">
              <h3 className="loc-heading">File types</h3>
              <div className="loc-grid cat-grid" role="group" aria-label="File categories">
                {ALL_CATEGORIES.map((cat) => {
                  const on = filters.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`loc-tile${on ? " loc-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => toggleCategory(cat)}
                    >
                      <strong className="loc-label">{CATEGORY_LABELS[cat]}</strong>
                    </button>
                  );
                })}
              </div>
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <label className="field-label">
                  Min size
                  <input
                    type="text"
                    value={minSizeInput}
                    onChange={(e) => setMinSizeInput(e.target.value)}
                    onBlur={() =>
                      updateFilters({ min_size: parseSizeInput(minSizeInput) })
                    }
                    placeholder="e.g. 1mb"
                    aria-label="Minimum file size"
                  />
                </label>
                <label className="field-label">
                  Max size
                  <input
                    type="text"
                    value={maxSizeInput}
                    onChange={(e) => setMaxSizeInput(e.target.value)}
                    onBlur={() =>
                      updateFilters({ max_size: parseSizeInput(maxSizeInput) })
                    }
                    placeholder="e.g. 2gb"
                    aria-label="Maximum file size"
                  />
                </label>
              </div>
              <div className="row" style={{ marginTop: "0.55rem" }}>
                <label className="field-label grow">
                  Include extensions only
                  <input
                    type="text"
                    value={includeExtInput}
                    onChange={(e) => setIncludeExtInput(e.target.value)}
                    onBlur={() =>
                      updateFilters({
                        include_extensions: splitTags(includeExtInput),
                      })
                    }
                    placeholder="jpg, png (empty = any)"
                    aria-label="Include extensions"
                  />
                </label>
              </div>
              <div className="row" style={{ marginTop: "0.55rem" }}>
                <label className="field-label grow">
                  Exclude extensions
                  <input
                    type="text"
                    value={excludeExtInput}
                    onChange={(e) => setExcludeExtInput(e.target.value)}
                    onBlur={() =>
                      updateFilters({
                        exclude_extensions: splitTags(excludeExtInput),
                      })
                    }
                    placeholder="tmp, log"
                    aria-label="Exclude extensions"
                  />
                </label>
              </div>
              <p className="meta" style={{ marginTop: "0.65rem" }}>
                Skip folders/files named
              </p>
              <div className="chip-list">
                {filters.exclude_names.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip"
                    onClick={() =>
                      updateFilters({
                        exclude_names: filters.exclude_names.filter((x) => x !== n),
                      })
                    }
                  >
                    {n} ×
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: "0.45rem" }}>
                <input
                  type="text"
                  value={excludeNameInput}
                  onChange={(e) => setExcludeNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const v = excludeNameInput.trim();
                    if (!v || filters.exclude_names.includes(v)) return;
                    updateFilters({
                      exclude_names: [...filters.exclude_names, v],
                    });
                    setExcludeNameInput("");
                  }}
                  placeholder="Add name to skip"
                  aria-label="Exclude name"
                />
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const v = excludeNameInput.trim();
                    if (!v || filters.exclude_names.includes(v)) return;
                    updateFilters({
                      exclude_names: [...filters.exclude_names, v],
                    });
                    setExcludeNameInput("");
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const next = sensibleFilters();
                    setFilters(next);
                    saveFilters(next);
                    setMinSizeInput("");
                    setMaxSizeInput("");
                    setIncludeExtInput("");
                    setExcludeExtInput("");
                  }}
                >
                  Reset filters
                </button>
              </div>
            </div>
          )}

          {customRoots.length > 0 && (
            <ul className="folder-cards">
              {customRoots.map((r) => (
                <li key={r} className="folder-card">
                  <div>
                    <strong className="folder-name">{folderLabel(r)}</strong>
                    <div className="path meta">{r}</div>
                  </div>
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => setRoots((xs) => xs.filter((x) => x !== r))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {roots.length === 0 && (
            <p className="empty-hint">No places selected yet — tap at least one tile to scan.</p>
          )}

          <button
            type="button"
            className="linkish"
            onClick={() => setPathEntryOpen((o) => !o)}
            aria-expanded={pathEntryOpen}
          >
            {pathEntryOpen ? "Hide path entry" : "Add folder by typing a path"}
          </button>
          {pathEntryOpen && (
            <div className="row" style={{ marginTop: "0.65rem" }}>
              <input
                type="text"
                value={rootInput}
                onChange={(e) => setRootInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoot()}
                placeholder={
                  desktop ? "D:\\Photos" : "/app/docker/fixtures"
                }
                aria-label="Folder path"
              />
              <button type="button" className="ghost" onClick={addRoot}>
                Add path
              </button>
            </div>
          )}

          <button
            type="button"
            className="linkish"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? "Hide advanced" : "Advanced: faster re-scan index"}
          </button>
          {advancedOpen && (
            <div className="row" style={{ marginTop: "0.65rem" }}>
              <input
                type="text"
                value={indexPath}
                onChange={(e) => setIndexPath(e.target.value)}
                placeholder="Optional SQLite index path"
                aria-label="Index path"
              />
            </div>
          )}
          <div className="profiles-panel">
            <h3 className="loc-heading">Saved profiles</h3>
            <div className="row">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Profile name"
                aria-label="Profile name"
              />
              <button
                type="button"
                className="ghost"
                disabled={!profileName.trim() || roots.length === 0}
                onClick={() => {
                  upsertProfile(profileName.trim(), roots, filters);
                  setProfiles(loadProfiles());
                  setProfileName("");
                }}
              >
                Save profile
              </button>
            </div>
            {profiles.length > 0 && (
              <ul className="roots" style={{ marginTop: "0.55rem" }}>
                {profiles.map((p) => (
                  <li key={p.id}>
                    <span className="path">{p.name}</span>
                    <div className="row" style={{ marginTop: "0.35rem" }}>
                      <button
                        type="button"
                        className="ghost compact"
                        onClick={() => {
                          setRoots(p.roots);
                          setFilters(p.filters);
                          saveFilters(p.filters);
                          setMinSizeInput(formatSizeInput(p.filters.min_size));
                          setMaxSizeInput(formatSizeInput(p.filters.max_size));
                          setIncludeExtInput(p.filters.include_extensions.join(", "));
                          setExcludeExtInput(p.filters.exclude_extensions.join(", "));
                        }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="ghost compact"
                        onClick={() => {
                          deleteProfile(p.id);
                          setProfiles(loadProfiles());
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

          <p className="scan-summary meta" data-tour="tour-scan-summary">
            {filterSummary(filters, roots.length)}
          </p>
          {busy && scanProgress && (
            <div className="progress-block" aria-live="polite">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      scanProgress.phase === "done"
                        ? 100
                        : scanProgress.files_seen === 0
                          ? 5
                          : Math.max(
                              8,
                              (scanProgress.files_hashed / Math.max(1, scanProgress.files_seen)) *
                                100,
                            ),
                    )}%`,
                  }}
                />
              </div>
              <p className="meta">
                {scanProgress.phase}: {scanProgress.files_seen} seen ·{" "}
                {scanProgress.files_hashed} hashed · {formatBytes(scanProgress.bytes_hashed)}
              </p>
            </div>
          )}
          <div className="row" style={{ marginTop: "0.65rem" }} data-tour="tour-scan">
            <button
              type="button"
              className="primary"
              disabled={busy || roots.length === 0}
              onClick={runScan}
            >
              {busy
                ? "Scanning…"
                : `Scan ${roots.length || ""} place${roots.length === 1 ? "" : "s"}`.trim()}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={busy || roots.length === 0}
              onClick={() => {
                setRestoreOpen((o) => !o);
                if (!restoreOpen) void refreshQuarantine();
              }}
            >
              {restoreOpen ? "Hide restore" : "Restore from trash"}
            </button>
          </div>
          {restoreOpen && (
            <div className="restore-panel">
              <h3 className="loc-heading">Quarantine (.dup-finder-trash)</h3>
              <p className="meta">
                Lists files under each selected place’s local quarantine folder (not OS Trash).
              </p>
              <button type="button" className="ghost compact" onClick={() => void refreshQuarantine()}>
                Refresh list
              </button>
              {quarantine.length === 0 ? (
                <p className="meta">Nothing quarantined under selected places.</p>
              ) : (
                <ul className="roots">
                  {quarantine.map((q) => (
                    <li key={q.path}>
                      <label className="candidate">
                        <input
                          type="checkbox"
                          checked={!!quarantineSel[q.path]}
                          onChange={(e) =>
                            setQuarantineSel((s) => ({ ...s, [q.path]: e.target.checked }))
                          }
                        />
                        <span>
                          <span className="path">{q.name}</span>
                          <span className="meta">
                            {formatBytes(q.size)} · {q.original_parent}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="primary"
                disabled={busy || !Object.values(quarantineSel).some(Boolean)}
                onClick={async () => {
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
              >
                Restore selected
              </button>
            </div>
          )}
        </section>
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
          {suggest.groups.length === 0 && (
            <p className="meta">No duplicate groups in these roots.</p>
          )}
          {suggest.groups.length > 0 && visibleGroups.length === 0 && (
            <p className="meta">No groups match the current filters.</p>
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
                <div className="path">
                  {g.keep.path}
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
                      <span className="path">
                        {c.path}
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
                      {o.kind}: {o.path} ({o.reason})
                    </span>
                  </li>
                ))}
              </ul>
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
                setStep("results");
              }}
            >
              Back
            </button>
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
