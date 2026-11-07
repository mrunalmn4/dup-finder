#!/usr/bin/env node
/** Pure logic checks for UI session resume helpers (no browser). */
function sessionIsResumable(s) {
  if (!s) return false;
  if (s.step === "results" && s.suggest && s.scanId) return true;
  if (s.step === "confirm" && s.deleteReport && s.scanId) return true;
  return false;
}

function basenamePath(p) {
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i < 0 ? n : n.slice(i + 1);
}

function friendlyPath(p) {
  const base = basenamePath(p);
  const n = p.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  const parent = i <= 0 ? "" : n.slice(0, i);
  const parentBase = parent ? basenamePath(parent) : "";
  return parentBase ? `${parentBase} / ${base}` : base;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL", msg);
    failed += 1;
  } else {
    console.log("ok", msg);
  }
}

assert(!sessionIsResumable(null), "null not resumable");
assert(
  !sessionIsResumable({ step: "roots", scanId: "x", suggest: {} }),
  "roots not resumable",
);
assert(
  sessionIsResumable({
    step: "results",
    scanId: "abc",
    suggest: { groups: [] },
  }),
  "results+scan+suggest resumable",
);
assert(
  sessionIsResumable({
    step: "confirm",
    scanId: "abc",
    deleteReport: { outcomes: [] },
  }),
  "confirm+deleteReport resumable",
);
assert(basenamePath("/a/b/c.txt") === "c.txt", "basename unix");
assert(basenamePath("D:\\\\Photos\\\\x.jpg") === "x.jpg", "basename win-ish");
assert(friendlyPath("/Users/me/Downloads/a.pdf") === "Downloads / a.pdf", "friendly");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("session_logic_test passed");
