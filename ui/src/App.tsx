import { useEffect, useMemo, useState } from "react";
import {
  client,
  formatBytes,
  isTauri,
  loadConnection,
  pickFolder,
  saveConnection,
  type DeleteReport,
  type SuggestReport,
} from "./api";

type Step = "connect" | "roots" | "results" | "confirm";

export default function App() {
  const desktop = isTauri();
  const initial = loadConnection();
  const [step, setStep] = useState<Step>(desktop ? "roots" : "connect");
  const [apiUrl, setApiUrl] = useState(initial.api);
  const [token, setToken] = useState(initial.token);
  const [rootInput, setRootInput] = useState(
    desktop ? "" : "/app/docker/fixtures",
  );
  const [roots, setRoots] = useState<string[]>([]);
  const [indexPath, setIndexPath] = useState(
    desktop ? "" : "/app/artifacts/ui-index.sqlite",
  );

  useEffect(() => {
    if (desktop) setStep("roots");
  }, [desktop]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<SuggestReport | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteReport, setDeleteReport] = useState<DeleteReport | null>(null);
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

  async function connect() {
    setError(null);
    saveConnection(apiUrl, token);
    setBusy(true);
    try {
      const h = await client.health();
      if (h !== "ok") throw new Error("API unhealthy");
      setStep("roots");
    } catch (e) {
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
    const picked = await pickFolder();
    if (picked && !roots.includes(picked)) {
      setRoots((r) => [...r, picked]);
    }
  }

  async function runScan() {
    setError(null);
    setDeleteReport(null);
    setBusy(true);
    try {
      const res = await client.scan(roots, indexPath || undefined);
      setScanId(res.scan_id);
      const sug = await client.suggest(res.scan_id);
      setSuggest(sug);
      const sel: Record<string, boolean> = {};
      for (const g of sug.groups) {
        for (const c of g.delete_candidates) sel[c.path] = true;
      }
      setSelected(sel);
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
    if (!scanId || selectedPaths.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const report = await client.delete({
        scan_id: scanId,
        paths: selectedPaths,
        keep: keepPaths,
        mode: "trash",
        confirm: true,
      });
      setDeleteReport(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="brand">
        <h1>Dup Finder</h1>
        <p>
          Content-true duplicates, explainable keep suggestions, and deletes that
          only touch paths you confirm — re-verified before every remove.
        </p>
      </header>

      {error && <p className="error">{error}</p>}

      {step === "connect" && (
        <section className="panel">
          <h2>Connect to local API</h2>
          <div className="row">
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://127.0.0.1:7420"
              aria-label="API URL"
            />
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token"
              aria-label="Token"
            />
            <button className="primary" disabled={busy} onClick={connect}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </div>
        </section>
      )}

      {step === "roots" && (
        <section className="panel">
          <h2>Scan roots</h2>
          <div className="row">
            <input
              type="text"
              value={rootInput}
              onChange={(e) => setRootInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRoot()}
              placeholder="/path/to/folder"
              aria-label="Root path"
            />
            <button className="ghost" onClick={addRoot}>
              Add
            </button>
            {desktop && (
              <button className="ghost" onClick={browseRoot}>
                Browse…
              </button>
            )}
          </div>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <input
              type="text"
              value={indexPath}
              onChange={(e) => setIndexPath(e.target.value)}
              placeholder="Optional SQLite index path"
              aria-label="Index path"
            />
          </div>
          <ul className="roots">
            {roots.map((r) => (
              <li key={r}>
                <span>{r}</span>
                <button
                  className="ghost"
                  onClick={() => setRoots((xs) => xs.filter((x) => x !== r))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: "1rem" }}>
            <button
              className="primary"
              disabled={busy || roots.length === 0}
              onClick={runScan}
            >
              {busy ? "Scanning…" : "Scan"}
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
          <h2>Duplicates</h2>
          {suggest.groups.map((g) => (
            <div className="group" key={g.hash}>
              <div className="meta">
                {formatBytes(g.reclaimable_bytes)} reclaimable · keep reason{" "}
                <code>{g.keep_reason}</code>
              </div>
              <div style={{ marginTop: "0.55rem" }}>
                <div className="path">
                  {g.keep.path}
                  <span className="badge">keep</span>
                </div>
                <div className="meta">
                  {g.keep.mime} · {formatBytes(g.keep.size)}
                </div>
              </div>
              {g.delete_candidates.map((c) => (
                <label
                  key={c.path}
                  style={{
                    display: "block",
                    marginTop: "0.65rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!selected[c.path]}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [c.path]: e.target.checked }))
                    }
                  />{" "}
                  <span className="path">
                    {c.path}
                    <span className="badge drop">candidate</span>
                  </span>
                  <div className="meta">
                    {c.mime} · {formatBytes(c.size)}
                  </div>
                </label>
              ))}
            </div>
          ))}
          <div className="row" style={{ marginTop: "1rem" }}>
            <button className="ghost" onClick={() => setStep("roots")}>
              Back
            </button>
            <button
              className="primary"
              disabled={busy || selectedPaths.length === 0}
              onClick={dryRunThenConfirm}
            >
              Preview delete ({selectedPaths.length})
            </button>
          </div>
        </section>
      )}

      {step === "confirm" && (
        <section className="panel">
          <h2>Confirm delete</h2>
          <p className="meta">
            Engine will re-hash each path immediately before trash. Keep paths
            cannot be removed.
          </p>
          <div className="confirm-box">
            <strong>Will attempt to trash</strong>
            <ul className="roots">
              {selectedPaths.map((p) => (
                <li key={p}>
                  <span className="path">{p}</span>
                </li>
              ))}
            </ul>
            <strong>Protected keep</strong>
            <ul className="roots">
              {keepPaths.map((p) => (
                <li key={p}>
                  <span className="path">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          {deleteReport && (
            <div style={{ marginTop: "1rem" }}>
              <p className={deleteReport.refused ? "error" : "ok"}>
                Last report: {deleteReport.outcomes.length} outcomes
                {deleteReport.refused ? ` · refused ${deleteReport.refuse_reason}` : ""}
              </p>
              <ul className="roots">
                {deleteReport.outcomes.map((o) => (
                  <li key={o.path + o.reason}>
                    <span className="path">
                      {o.kind}: {o.path} ({o.reason})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="row" style={{ marginTop: "1rem" }}>
            <button className="ghost" onClick={() => setStep("results")}>
              Back
            </button>
            <button className="danger" disabled={busy} onClick={trashSelected}>
              {busy ? "Working…" : "Trash selected"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
