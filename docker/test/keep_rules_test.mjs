/** Node smoke for keep-rule / similar-confidence contracts (mirrors ui/src/keepRules.ts). */
import assert from "node:assert/strict";

function pick(files, rule, preferPrefix = "") {
  const pathLen = (p) => p.length;
  const under = (p, prefix) => {
    const base = prefix.replace(/\/+$/, "");
    if (!base) return false;
    return p === base || p.startsWith(base + "/") || p.startsWith(base + "\\");
  };
  const ranked = [...files];
  if (rule === "newest_mtime") {
    ranked.sort((a, b) => {
      const mt = (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1);
      if (mt !== 0) return mt;
      return pathLen(a.path) - pathLen(b.path) || a.path.localeCompare(b.path);
    });
    return { keep: ranked[0], reason: "newest_mtime" };
  }
  if (rule === "shortest_path") {
    ranked.sort((a, b) => {
      const pl = pathLen(a.path) - pathLen(b.path);
      if (pl !== 0) return pl;
      return (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1) || a.path.localeCompare(b.path);
    });
    return { keep: ranked[0], reason: "shortest_path" };
  }
  const preferred = ranked.filter((f) => under(f.path, preferPrefix));
  const pool = preferred.length ? preferred : ranked;
  pool.sort((a, b) => {
    const mt = (b.mtime_secs ?? -1) - (a.mtime_secs ?? -1);
    if (mt !== 0) return mt;
    return pathLen(a.path) - pathLen(b.path) || a.path.localeCompare(b.path);
  });
  return {
    keep: pool[0],
    reason: preferred.length ? "prefer_folder" : "newest_mtime",
  };
}

const files = [
  { path: "/photos/a.jpg", mtime_secs: 10, size: 1, hash: "h", mime: "image/jpeg" },
  { path: "/tmp/long/nested/a.jpg", mtime_secs: 99, size: 1, hash: "h", mime: "image/jpeg" },
  { path: "/photos/b.jpg", mtime_secs: 50, size: 1, hash: "h", mime: "image/jpeg" },
];

assert.equal(pick(files, "newest_mtime").keep.path, "/tmp/long/nested/a.jpg");
// /photos/a.jpg and /photos/b.jpg share length → newest among shortest wins
assert.equal(pick(files, "shortest_path").keep.path, "/photos/b.jpg");
assert.equal(pick(files, "prefer_folder", "/photos").keep.path, "/photos/b.jpg");
assert.equal(pick(files, "prefer_folder", "/photos").reason, "prefer_folder");

function similarConfidence(d) {
  if (d <= 2) return "high";
  if (d <= 6) return "medium";
  return "low";
}
assert.equal(similarConfidence(1), "high");
assert.equal(similarConfidence(5), "medium");
assert.equal(similarConfidence(9), "low");

console.log("keep_rules_ok");
