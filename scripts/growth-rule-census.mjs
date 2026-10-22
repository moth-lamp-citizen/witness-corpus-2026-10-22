#!/usr/bin/env node
// READ-ONLY. The corrected growth-link rule, run as a census over the 65 published
// witness day files (1f916-ai/1f916@fa858d8, fetched 2026-10-22).
//
// Rule under test (tally-stick c116800, as implemented independently by Jaybob #9713):
// a from-claim is "witnessed" only if walking back through claimed from_size links
// reaches a GROWTH link: two distinct countersigned rows at m < n. Same-size steps
// (m === n) are allowed only to an earlier distinct row with the same signed root,
// and never stand in for a growth step.
//
// Honest bound: the day files carry no consistency proofs, so this walk trusts the
// witness's own signed "verified from m" claim for the fold itself. It tests
// reachability of a growth link, not that the path folds.
//
// Usage: node scripts/growth-rule-census.mjs [dir]
//   dir defaults to $WITNESS_DIR or sources/witness.
//   Writes $OUT (default data/growth-rule-census.json).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const dir = process.argv[2] ?? process.env.WITNESS_DIR ?? "sources/witness";
const out = process.env.OUT ?? "data/growth-rule-census.json";
const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
const rows = [];
for (const file of files) {
  const lines = readFileSync(dir + "/" + file, "utf8").split("\n").filter(Boolean);
  for (let idx = 0; idx < lines.length; idx++) {
    let row;
    try { row = JSON.parse(lines[idx]); } catch { continue; }
    if (typeof row.witness_sig === "string") rows.push({ file, idx, ...row });
  }
}

const key = (r) => r.log + "|" + r.tree_size;
const by = new Map();
for (const r of rows) {
  const k = key(r);
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(r);
}
for (const arr of by.values()) arr.sort((a, b) => a.file.localeCompare(b.file) || a.idx - b.idx);

const cache = new Map();
function walk(r) {
  const id = r.file + "|" + r.idx;
  if (cache.has(id)) return cache.get(id);
  const m = /^verified from (\d+)$/.exec(r.consistency ?? "");
  if (!m) {
    const res = { ok: false, reason: "no from-claim" };
    cache.set(id, res); return res;
  }
  const n = Number(m[1]);
  if (n < r.tree_size) {
    const prior = (by.get(r.log + "|" + n) ?? []).filter((x) => !(x.file === r.file && x.idx === r.idx));
    const res = { ok: prior.length > 0, reason: prior.length ? "growth" : "no prior at from_size" };
    cache.set(id, res); return res;
  }
  if (n === r.tree_size) {
    const earlier = (by.get(key(r)) ?? []).filter(
      (x) => (x.file < r.file || (x.file === r.file && x.idx < r.idx)) && x.root === r.root
    );
    if (!earlier.length) {
      const res = { ok: false, reason: "same-size, no earlier equal-root prior" };
      cache.set(id, res); return res;
    }
    const res = walk(earlier[earlier.length - 1]);
    const out = {
      ok: res.ok,
      reason: res.ok ? "same-size then growth" : res.reason === "no from-claim"
        ? "same-size chain ends at a first observation (no growth link)"
        : res.reason,
    };
    cache.set(id, out); return out;
  }
  const res = { ok: false, reason: "from_size > tree_size" };
  cache.set(id, res); return res;
}

const from = rows.filter((r) => /^verified from \d+$/.test(r.consistency ?? ""));
const firstObs = rows.filter((r) => r.consistency === "first observation");
const results = from.map((r) => ({ row: r, walk: walk(r) }));
const demoted = results.filter((x) => !x.walk.ok);
const byLog = {};
for (const log of [...new Set(rows.map((r) => r.log))]) {
  byLog[log] = {
    countersigned: rows.filter((r) => r.log === log).length,
    fromClaims: from.filter((r) => r.log === log).length,
    witnessed: results.filter((x) => x.row.log === log && x.walk.ok).length,
    demoted: demoted.filter((x) => x.row.log === log).length,
    firstObservation: firstObs.filter((r) => r.log === log).map((r) => ({ file: r.file, at: r.at, tree_size: r.tree_size })),
  };
}

// Sanity: every demotion must be a same-size claim at a genesis size, not a later
// size. If this assertion ever fails, the census is reporting a different rule.
const badReasons = [...new Set(demoted.map((x) => x.walk.reason))];
const genesis = new Set(firstObs.map((r) => r.log + "|" + r.tree_size));
for (const x of demoted) {
  const m = /^verified from (\d+)$/.exec(x.row.consistency ?? "");
  if (!m || Number(m[1]) !== x.row.tree_size) throw new Error("demotion is not a same-size claim: " + x.row.file + " " + x.row.consistency);
  if (!genesis.has(x.row.log + "|" + x.row.tree_size)) throw new Error("demotion is not at a first-observation size: " + x.row.log + " " + x.row.tree_size);
}
const firstGrowth = {};
for (const log of [...new Set(rows.map((r) => r.log))]) {
  const g = rows.find((r) => r.log === log && /^verified from (\d+)$/.test(r.consistency ?? "") && Number(/^verified from (\d+)$/.exec(r.consistency)[1]) < r.tree_size);
  firstGrowth[log] = g ? { file: g.file, at: g.at, tree_size: g.tree_size, consistency: g.consistency } : null;
}
const demotedDays = [...new Set(demoted.map((x) => x.row.file))].length;
const summary = {
  dir, files: files.length, first: files[0], last: files.at(-1),
  countersigned: rows.length,
  firstObservation: firstObs.length,
  fromClaims: from.length,
  witnessedUnderGrowthRule: results.length - demoted.length,
  demoted: demoted.length,
  demotedPct: +(100 * demoted.length / from.length).toFixed(2),
  badReasons,
  firstGrowth,
  demotedDays,
  byLog,
  demotedRows: demoted.map((x) => ({
    file: x.row.file, at: x.row.at, log: x.row.log,
    tree_size: x.row.tree_size, consistency: x.row.consistency, reason: x.walk.reason,
  })),
};
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  files: summary.files, countersigned: summary.countersigned, firstObservation: summary.firstObservation,
  fromClaims: summary.fromClaims, witnessedUnderGrowthRule: summary.witnessedUnderGrowthRule,
  demoted: summary.demoted, demotedPct: summary.demotedPct, badReasons: summary.badReasons,
  firstGrowth: summary.firstGrowth, demotedDays: summary.demotedDays, byLog: summary.byLog,
}, null, 2));
