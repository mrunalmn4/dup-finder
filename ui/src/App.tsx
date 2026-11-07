import { useCallback, useEffect, useMemo, useState } from "react";
import {
  client,
  folderLabel,
  formatBytes,
  isTauri,
  loadConnection,
  pickFolders,
  saveConnection,
  type DeleteReport,
  type FileCaution,
  type FileRecord,
  type SuggestReport,
} from "./api";
import HelpGuide from "./HelpGuide";
import Onboarding from "./Onboarding";
import { cautionReasonLabel, keepReasonLabel } from "./suggestLabels";

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
  const [indexPath, setIndexPath] = useState(
    desktop ? "" : "/app/artifacts/ui-index.sqlite",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<SuggestReport | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteReport, setDeleteReport] = useState<DeleteReport | null>(null);
  const [trashDone, setTrashDone] = useState(false);
  const [summary, setSummary] = useState<{
    scanned: number;
    groups: number;
    reclaimable: number;
    computed: number;
    reused: number;
  } | null>(null);

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

  function cautionFor(path: string, cautions: FileCaution[] | undefined): FileCaution | undefined {
    return cautions?.find((c) => c.path === path && c.level !== "none");
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

  useEffect(() => {
    if (desktop) {
      setConnected(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        saveConnection(apiUrl, token);
        const h = await client.health();
        if (!cancelled && h === "ok" && token) setConnected(true);
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

  function addDemoFolder() {
    const demo = "/app/docker/fixtures";
    if (!roots.includes(demo)) setRoots((r) => [...r, demo]);
  }

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
    setError(null);
    setDeleteReport(null);
    setTrashDone(false);
    setBusy(true);
    try {
      const res = await client.scan(roots, indexPath || undefined);
      setScanId(res.scan_id);
      const sug = await client.suggest(res.scan_id);
      setSuggest(sug);
      // Safer default: nothing selected until the user opts in.
      setSelected({});
      setSummary({
        scanned: res.result.files_scanned,
        groups: res.result.groups.length,
        reclaimable: sug.total_reclaimable_bytes,
        computed: res.stats.hashes_computed,
        reused: res.stats.hashes_reused,
      });
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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

      {settingsOpen && !desktop && (
        <section className="panel">
          <h2>API connection</h2>
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
        </section>
      )}

      {step === "roots" && (
        <section className="panel">
          <h2>Where should we look?</h2>
          <p className="meta" style={{ marginBottom: "1rem" }}>
            Pick one or more folders. We only scan what you select — never your
            whole computer by surprise.
          </p>

          <div className="chooser" data-tour="tour-folders">
            {desktop ? (
              <button
                type="button"
                className="primary chooser-main"
                onClick={browseRoot}
              >
                Choose folders…
              </button>
            ) : (
              <button
                type="button"
                className="primary chooser-main"
                onClick={addDemoFolder}
              >
                Add sample folder (Docker demo)
              </button>
            )}
            <p className="meta chooser-hint">
              {desktop
                ? "You can select multiple folders or a whole drive (for example D:\\ on Windows)."
                : "Browsers cannot open your real disks for security. Use the desktop app to pick folders visually, or add a path below."}
            </p>
          </div>

          {roots.length > 0 ? (
            <ul className="folder-cards">
              {roots.map((r) => (
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
          ) : (
            <p className="empty-hint">No folders yet — choose at least one to scan.</p>
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
                  desktop ? "C:\\Users\\You\\Pictures" : "/app/docker/fixtures"
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
          <div className="row" style={{ marginTop: "1rem" }} data-tour="tour-scan">
            <button
              type="button"
              className="primary"
              disabled={busy || roots.length === 0}
              onClick={runScan}
            >
              {busy ? "Scanning…" : `Scan ${roots.length || ""} folder${roots.length === 1 ? "" : "s"}`.trim()}
            </button>
          </div>
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
          {suggest.groups.length === 0 && (
            <p className="meta">No duplicate groups in these roots.</p>
          )}
          {suggest.groups.map((g) => {
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
          <h2>Confirm trash</h2>
          <p className="meta">
            Only paths that passed dry-run will be trashed. Each file is
            re-hashed immediately before remove. Files go to a{" "}
            <code>.dup-finder-trash</code> folder beside the original (not the
            OS Trash yet).
          </p>
          <div className="confirm-box">
            <strong>
              Will trash ({wouldDelete.length})
            </strong>
            {wouldDelete.length === 0 ? (
              <p className="meta">Nothing to trash — dry-run skipped all paths.</p>
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
                Trash finished: {deleteReport.outcomes.length} outcomes
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
              {busy
                ? "Trashing…"
                : trashDone
                  ? "Done"
                  : `Trash ${wouldDelete.length} file${wouldDelete.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
