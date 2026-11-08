import type { QuarantinedFile, SuggestedLocation } from "./api";
import { folderLabel, formatBytes, locationKindLabel } from "./api";
import Checkbox from "./Checkbox";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  filterSummary,
  parseSizeInput,
  sensibleFilters,
  splitTags,
  type FileCategory,
  type ScanFilters,
} from "./scanFilters";
import type { ScanProfile } from "./profiles";
import type { SetupMode } from "./setupMode";
import type { ScanProgress } from "./api";

type Props = {
  mode: SetupMode;
  desktop: boolean;
  connected: boolean;
  busy: boolean;
  roots: string[];
  locations: SuggestedLocation[];
  locationsError: string | null;
  driveLocations: SuggestedLocation[];
  folderLocations: SuggestedLocation[];
  customRoots: string[];
  filters: ScanFilters;
  whatOpen: boolean;
  setWhatOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  moreOptionsOpen: boolean;
  setMoreOptionsOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  guidedSubstep: number;
  setGuidedSubstep: (n: number) => void;
  pathEntryOpen: boolean;
  setPathEntryOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  rootInput: string;
  setRootInput: (v: string) => void;
  indexPath: string;
  setIndexPath: (v: string) => void;
  excludePathInput: string;
  setExcludePathInput: (v: string) => void;
  includeExtInput: string;
  setIncludeExtInput: (v: string) => void;
  excludeExtInput: string;
  setExcludeExtInput: (v: string) => void;
  excludeNameInput: string;
  setExcludeNameInput: (v: string) => void;
  minSizeInput: string;
  setMinSizeInput: (v: string) => void;
  maxSizeInput: string;
  setMaxSizeInput: (v: string) => void;
  profiles: ScanProfile[];
  profileName: string;
  setProfileName: (v: string) => void;
  setProfiles: (p: ScanProfile[]) => void;
  setRoots: (fn: string[] | ((r: string[]) => string[])) => void;
  setFilters: (fn: ScanFilters | ((f: ScanFilters) => ScanFilters)) => void;
  updateFilters: (patch: Partial<ScanFilters>) => void;
  toggleLocation: (path: string) => void;
  toggleCategory: (cat: FileCategory) => void;
  addRoot: () => void;
  addExcludePath: () => void;
  browseRoot: () => void;
  applyPreset: (kind: "common" | "disks" | "demo" | "clear") => void;
  loadLocations: () => void;
  runScan: () => void;
  cancelScan?: () => void;
  scanProgress: ScanProgress | null;
  restoreOpen: boolean;
  setRestoreOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  quarantine: QuarantinedFile[];
  quarantineSel: Record<string, boolean>;
  setQuarantineSel: (
    fn: Record<string, boolean> | ((s: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  refreshQuarantine: () => void;
  restoreSelected: () => void;
  saveProfile: () => void;
  loadProfile: (p: ScanProfile) => void;
  deleteProfileById: (id: string) => void;
};

export default function FoldersPanel(p: Props) {
  const advanced = p.mode === "advanced";
  const guided = p.mode === "guided";
  const simpleish = p.mode === "simple" || p.mode === "smart";
  const showExtras = advanced || p.moreOptionsOpen;
  const showPlaces = !guided || p.guidedSubstep === 0;
  const showWhatGuided = guided && p.guidedSubstep === 1;
  const showWhatFull = advanced || (simpleish && p.moreOptionsOpen);
  const showScanArea = !guided || p.guidedSubstep === 2;
  const showWhereExtras = showExtras;
  const showProfilesRestore = advanced || (simpleish && p.moreOptionsOpen);

  return (
    <section className="panel">
      <div className="panel-head folders-head">
        <div>
          <h2>
            {guided
              ? p.guidedSubstep === 0
                ? "Step 1 — Pick places"
                : p.guidedSubstep === 1
                  ? "Step 2 — What to look for"
                  : "Step 3 — Ready to scan"
              : p.mode === "smart"
                ? "Your usual places"
                : "Where should we look?"}
          </h2>
          <p className="meta" style={{ marginBottom: 0 }}>
            {guided
              ? p.guidedSubstep === 0
                ? "Tap the places to include. Next you’ll pick file types."
                : p.guidedSubstep === 1
                  ? "Choose the kinds of files to check. You can change this later."
                  : "Confirm the summary, then start the scan."
              : p.mode === "smart"
                ? "We preselected common folders. Tap to adjust, then scan."
                : "Tap drives and folders to select them. We only scan what you turn on."}
          </p>
        </div>
        {guided && (
          <div className="guided-dots" aria-label={`Step ${p.guidedSubstep + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`guided-dot${i === p.guidedSubstep ? " on" : ""}${i < p.guidedSubstep ? " done" : ""}`}
              />
            ))}
          </div>
        )}
      </div>

      {showPlaces && (
        <div className="chooser" data-tour="tour-folders">
          {p.driveLocations.length > 0 && (
            <>
              <h3 className="loc-heading">Drives &amp; disks</h3>
              <div className="loc-grid" role="group" aria-label="Drives and disks">
                {p.driveLocations.map((loc) => {
                  const on = p.roots.includes(loc.path);
                  return (
                    <button
                      key={loc.path}
                      type="button"
                      className={`loc-tile${on ? " loc-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => p.toggleLocation(loc.path)}
                    >
                      <span className="loc-kind">{locationKindLabel(loc.kind)}</span>
                      <strong className="loc-label">{loc.label}</strong>
                      {(advanced || p.moreOptionsOpen) && (
                        <span className="loc-path">{loc.path}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {p.folderLocations.length > 0 && (
            <>
              <h3 className="loc-heading">Folders</h3>
              <div className="loc-grid" role="group" aria-label="Folders">
                {p.folderLocations.map((loc) => {
                  const on = p.roots.includes(loc.path);
                  return (
                    <button
                      key={loc.path}
                      type="button"
                      className={`loc-tile${on ? " loc-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => p.toggleLocation(loc.path)}
                    >
                      <span className="loc-kind">{locationKindLabel(loc.kind)}</span>
                      <strong className="loc-label">{loc.label}</strong>
                      {(advanced || p.moreOptionsOpen) && (
                        <span className="loc-path">{loc.path}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {p.locationsError && <p className="meta">{p.locationsError}</p>}

          {!p.desktop && p.locations.length === 0 && (
            <p className="empty-hint">
              Connect the local API (Settings) to list places on that machine.
              Docker demo:{" "}
              <button
                type="button"
                className="linkish"
                style={{ marginTop: 0, display: "inline" }}
                onClick={() => p.toggleLocation("/app/docker/fixtures")}
              >
                Sample files
              </button>
              .
            </p>
          )}

          {(advanced || p.moreOptionsOpen) && (
            <div className="preset-row" role="group" aria-label="Quick presets">
              <span className="meta">Presets:</span>
              <button type="button" className="ghost compact" onClick={() => p.applyPreset("common")}>
                Common folders
              </button>
              <button type="button" className="ghost compact" onClick={() => p.applyPreset("disks")}>
                Disks only
              </button>
              <button type="button" className="ghost compact" onClick={() => p.applyPreset("demo")}>
                Sample demo
              </button>
              <button type="button" className="ghost compact" onClick={() => p.applyPreset("clear")}>
                Clear
              </button>
            </div>
          )}

          <div className="row" style={{ marginTop: "0.85rem" }}>
            {p.desktop && (
              <button type="button" className="primary" onClick={p.browseRoot}>
                Browse for more…
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => void p.loadLocations()}
              disabled={!p.desktop && !p.connected}
            >
              Refresh list
            </button>
            {p.mode === "smart" && (
              <button type="button" className="ghost" onClick={() => p.applyPreset("common")}>
                Reset to usual places
              </button>
            )}
          </div>
          {(p.mode === "simple" || p.mode === "smart") && p.folderLocations.length > 0 && (
            <div className="quick-scan-row" role="group" aria-label="Quick places">
              <span className="meta">Quick:</span>
              {["Downloads", "Pictures", "Desktop", "Documents"].map((label) => {
                const loc = p.folderLocations.find((l) => l.label === label);
                if (!loc) return null;
                const on = p.roots.includes(loc.path);
                return (
                  <button
                    key={label}
                    type="button"
                    className={`ghost compact${on ? " quick-on" : ""}`}
                    aria-pressed={on}
                    onClick={() => p.toggleLocation(loc.path)}
                  >
                    {on ? `✓ ${label}` : label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showWhatGuided && (
        <div className="what-panel" data-tour="tour-what">
          <div className="loc-grid cat-grid" role="group" aria-label="File categories">
            {ALL_CATEGORIES.map((cat) => {
              const on = p.filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`loc-tile${on ? " loc-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => p.toggleCategory(cat)}
                >
                  <strong className="loc-label">{CATEGORY_LABELS[cat]}</strong>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {guided && p.guidedSubstep === 2 && (
        <div className="guided-ready">
          <p className="scan-summary meta">{filterSummary(p.filters, p.roots.length)}</p>
          {p.roots.length > 0 && (
            <ul className="chip-list">
              {p.roots.map((r) => (
                <li key={r} className="chip chip-static">
                  {folderLabel(r)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showWhereExtras && (
        <div className="where-extra">
          <h3 className="loc-heading">Where extras</h3>
          <label className="check-line">
            <Checkbox
              checked={p.filters.include_hidden}
              onChange={(on) => p.updateFilters({ include_hidden: on })}
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
                value={p.filters.max_depth ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  p.updateFilters({
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
            {p.filters.exclude_paths.map((path) => (
              <button
                key={path}
                type="button"
                className="chip"
                onClick={() =>
                  p.updateFilters({
                    exclude_paths: p.filters.exclude_paths.filter((x) => x !== path),
                  })
                }
              >
                {folderLabel(path)} ×
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: "0.45rem" }}>
            <input
              type="text"
              value={p.excludePathInput}
              onChange={(e) => p.setExcludePathInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && p.addExcludePath()}
              placeholder="Path to skip"
              aria-label="Exclude path"
            />
            <button type="button" className="ghost" onClick={p.addExcludePath}>
              Exclude
            </button>
          </div>
        </div>
      )}

      {showWhatFull && (
        <>
          {advanced && (
            <button
              type="button"
              className="linkish"
              onClick={() => p.setWhatOpen((o) => !o)}
              aria-expanded={p.whatOpen}
            >
              {p.whatOpen ? "Hide: What should we look for?" : "What should we look for?"}
            </button>
          )}
          {(p.whatOpen || !advanced) && (
            <div className="what-panel" data-tour="tour-what">
              <h3 className="loc-heading">File types</h3>
              <div className="loc-grid cat-grid" role="group" aria-label="File categories">
                {ALL_CATEGORIES.map((cat) => {
                  const on = p.filters.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`loc-tile${on ? " loc-on" : ""}`}
                      aria-pressed={on}
                      onClick={() => p.toggleCategory(cat)}
                    >
                      <strong className="loc-label">{CATEGORY_LABELS[cat]}</strong>
                    </button>
                  );
                })}
              </div>
              {advanced && (
                <>
                  <div className="row" style={{ marginTop: "0.75rem" }}>
                    <label className="field-label">
                      Min size
                      <input
                        type="text"
                        value={p.minSizeInput}
                        onChange={(e) => p.setMinSizeInput(e.target.value)}
                        onBlur={() =>
                          p.updateFilters({ min_size: parseSizeInput(p.minSizeInput) })
                        }
                        placeholder="e.g. 1mb"
                        aria-label="Minimum file size"
                      />
                    </label>
                    <label className="field-label">
                      Max size
                      <input
                        type="text"
                        value={p.maxSizeInput}
                        onChange={(e) => p.setMaxSizeInput(e.target.value)}
                        onBlur={() =>
                          p.updateFilters({ max_size: parseSizeInput(p.maxSizeInput) })
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
                        value={p.includeExtInput}
                        onChange={(e) => p.setIncludeExtInput(e.target.value)}
                        onBlur={() =>
                          p.updateFilters({
                            include_extensions: splitTags(p.includeExtInput),
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
                        value={p.excludeExtInput}
                        onChange={(e) => p.setExcludeExtInput(e.target.value)}
                        onBlur={() =>
                          p.updateFilters({
                            exclude_extensions: splitTags(p.excludeExtInput),
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
                    {p.filters.exclude_names.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="chip"
                        onClick={() =>
                          p.updateFilters({
                            exclude_names: p.filters.exclude_names.filter((x) => x !== n),
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
                      value={p.excludeNameInput}
                      onChange={(e) => p.setExcludeNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const v = p.excludeNameInput.trim();
                        if (!v || p.filters.exclude_names.includes(v)) return;
                        p.updateFilters({
                          exclude_names: [...p.filters.exclude_names, v],
                        });
                        p.setExcludeNameInput("");
                      }}
                      placeholder="Add name to skip"
                      aria-label="Exclude name"
                    />
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        const v = p.excludeNameInput.trim();
                        if (!v || p.filters.exclude_names.includes(v)) return;
                        p.updateFilters({
                          exclude_names: [...p.filters.exclude_names, v],
                        });
                        p.setExcludeNameInput("");
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        const next = sensibleFilters();
                        p.setFilters(next);
                        p.setMinSizeInput("");
                        p.setMaxSizeInput("");
                        p.setIncludeExtInput("");
                        p.setExcludeExtInput("");
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showPlaces && p.customRoots.length > 0 && (
        <ul className="folder-cards">
          {p.customRoots.map((r) => (
            <li key={r} className="folder-card">
              <div>
                <strong className="folder-name">{folderLabel(r)}</strong>
                {(advanced || p.moreOptionsOpen) && (
                  <div className="path meta">{r}</div>
                )}
              </div>
              <button
                type="button"
                className="ghost compact"
                onClick={() => p.setRoots((xs) => xs.filter((x) => x !== r))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {showPlaces && p.roots.length === 0 && (
        <p className="empty-hint">No places selected yet — tap at least one to continue.</p>
      )}

      {showProfilesRestore && (
        <>
          <button
            type="button"
            className="linkish"
            onClick={() => p.setPathEntryOpen((o) => !o)}
            aria-expanded={p.pathEntryOpen}
          >
            {p.pathEntryOpen ? "Hide path entry" : "Add folder by typing a path"}
          </button>
          {p.pathEntryOpen && (
            <div className="row" style={{ marginTop: "0.65rem" }}>
              <input
                type="text"
                value={p.rootInput}
                onChange={(e) => p.setRootInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && p.addRoot()}
                placeholder={p.desktop ? "D:\\Photos" : "/app/docker/fixtures"}
                aria-label="Folder path"
              />
              <button type="button" className="ghost" onClick={p.addRoot}>
                Add path
              </button>
            </div>
          )}

          <button
            type="button"
            className="linkish"
            onClick={() => p.setAdvancedOpen((o) => !o)}
            aria-expanded={p.advancedOpen}
          >
            {p.advancedOpen ? "Hide advanced" : "Advanced: faster re-scan index"}
          </button>
          {p.advancedOpen && (
            <div className="row" style={{ marginTop: "0.65rem" }}>
              <input
                type="text"
                value={p.indexPath}
                onChange={(e) => p.setIndexPath(e.target.value)}
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
                value={p.profileName}
                onChange={(e) => p.setProfileName(e.target.value)}
                placeholder="Profile name"
                aria-label="Profile name"
              />
              <button
                type="button"
                className="ghost"
                disabled={!p.profileName.trim() || p.roots.length === 0}
                onClick={p.saveProfile}
              >
                Save profile
              </button>
            </div>
            {p.profiles.length > 0 && (
              <ul className="roots" style={{ marginTop: "0.55rem" }}>
                {p.profiles.map((prof) => (
                  <li key={prof.id}>
                    <span className="path">{prof.name}</span>
                    <div className="row" style={{ marginTop: "0.35rem" }}>
                      <button
                        type="button"
                        className="ghost compact"
                        onClick={() => p.loadProfile(prof)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="ghost compact"
                        onClick={() => p.deleteProfileById(prof.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {simpleish && (
        <button
          type="button"
          className="linkish"
          onClick={() => p.setMoreOptionsOpen((o) => !o)}
          aria-expanded={p.moreOptionsOpen}
        >
          {p.moreOptionsOpen ? "Hide more options" : "More options"}
        </button>
      )}

      {showScanArea && (
        <>
          <p className="scan-summary meta" data-tour="tour-scan-summary">
            {simpleish && !p.moreOptionsOpen
              ? `${p.roots.length} place${p.roots.length === 1 ? "" : "s"} · recommended file types`
              : filterSummary(p.filters, p.roots.length)}
          </p>
          {p.busy && p.scanProgress && (
            <div className="progress-block" aria-live="polite">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      p.scanProgress.phase === "done"
                        ? 100
                        : p.scanProgress.files_seen === 0
                          ? 5
                          : Math.max(
                              8,
                              (p.scanProgress.files_hashed /
                                Math.max(1, p.scanProgress.files_seen)) *
                                100,
                            ),
                    )}%`,
                  }}
                />
              </div>
              <p className="meta">
                {p.scanProgress.phase}: {p.scanProgress.files_seen} seen ·{" "}
                {p.scanProgress.files_hashed} hashed ·{" "}
                {formatBytes(p.scanProgress.bytes_hashed)}
              </p>
            </div>
          )}
          <div className="row" style={{ marginTop: "0.65rem" }} data-tour="tour-scan">
            <button
              type="button"
              className="primary"
              disabled={p.busy || p.roots.length === 0}
              onClick={p.runScan}
            >
              {p.busy
                ? "Scanning…"
                : `Scan ${p.roots.length || ""} place${p.roots.length === 1 ? "" : "s"}`.trim()}
            </button>
            {p.busy && p.cancelScan && (
              <button type="button" className="ghost" onClick={p.cancelScan}>
                Cancel scan
              </button>
            )}
            {showProfilesRestore && (
              <button
                type="button"
                className="ghost"
                disabled={p.busy || p.roots.length === 0}
                onClick={() => {
                  p.setRestoreOpen((o) => !o);
                  if (!p.restoreOpen) void p.refreshQuarantine();
                }}
              >
                {p.restoreOpen ? "Hide restore" : "Restore from trash"}
              </button>
            )}
          </div>
          {p.restoreOpen && showProfilesRestore && (
            <div className="restore-panel">
              <h3 className="loc-heading">Quarantine (.dup-finder-trash)</h3>
              <p className="meta">
                Local quarantine only — not the system Trash / Recycle Bin.
              </p>
              <button
                type="button"
                className="ghost compact"
                onClick={() => void p.refreshQuarantine()}
              >
                Refresh list
              </button>
              {p.quarantine.length === 0 ? (
                <p className="meta">Nothing quarantined under selected places.</p>
              ) : (
                <ul className="roots">
                  {p.quarantine.map((q) => (
                    <li key={q.path}>
                      <label className="candidate">
                        <Checkbox
                          checked={!!p.quarantineSel[q.path]}
                          onChange={(on) =>
                            p.setQuarantineSel((s) => ({
                              ...s,
                              [q.path]: on,
                            }))
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
                disabled={p.busy || !Object.values(p.quarantineSel).some(Boolean)}
                onClick={p.restoreSelected}
              >
                Restore selected
              </button>
            </div>
          )}
        </>
      )}

      {guided && (
        <div className="row guided-nav" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="ghost"
            disabled={p.guidedSubstep === 0 || p.busy}
            onClick={() => p.setGuidedSubstep(Math.max(0, p.guidedSubstep - 1))}
          >
            Back
          </button>
          {p.guidedSubstep < 2 && (
            <button
              type="button"
              className="primary"
              disabled={
                p.busy ||
                (p.guidedSubstep === 0 && p.roots.length === 0) ||
                (p.guidedSubstep === 1 && p.filters.categories.length === 0)
              }
              onClick={() => p.setGuidedSubstep(p.guidedSubstep + 1)}
            >
              Next
            </button>
          )}
        </div>
      )}
    </section>
  );
}
