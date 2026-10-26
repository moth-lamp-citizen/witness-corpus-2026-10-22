#!/usr/bin/env node
// Per-log census and witness-signature reuse for the 65 day files in ../sources/witness.
// The demoted counts come from ../data/growth-rule-census.json (the corrected growth-link rule,
// c116800); this script adds the per-log denominators and the signature groups. Read-only.
import fs from "node:fs";

const DIR = process.env.WITNESS_DIR ?? new URL("../sources/witness/", import.meta.url).pathname;
const CENSUS = process.env.GROWTH_CENSUS ?? new URL("../data/growth-rule-census.json", import.meta.url).pathname;
const files = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
const rows = [];
for (const file of files) {
  for (const line of fs.readFileSync(DIR + "/" + file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (j.status === "countersigned" && j.log) rows.push({ ...j, file });
  }
}
const census = JSON.parse(fs.readFileSync(CENSUS, "utf8"));
const norm = (s) => /^verified from \d+$/.test(String(s));
const pct = (n, d) => Math.round((n / d) * 1000000) / 10000;

const byLog = {};
for (const log of [...new Set(rows.map((r) => r.log))].sort()) {
  const rs = rows.filter((r) => r.log === log);
  const from = rs.filter((r) => norm(r.consistency));
  const first = rs.find((r) => r.consistency === "first observation");
  const atFirst = first ? rs.filter((r) => r.tree_size === first.tree_size) : [];
  const c = census.byLog[log];
  byLog[log] = {
    countersigned: rs.length,
    fromClaims: from.length,
    demoted: c.demoted,
    demotedPct: pct(c.demoted, c.fromClaims),
    firstObservationSize: first ? first.tree_size : null,
    linesAtFirstObservationSize: atFirst.length,
    fromClaimsAtFirstObservationSize: atFirst.filter((r) => norm(r.consistency)).length,
  };
}

// Signature groups: every (log, tree_size) group with more than one countersigned line.
const groups = {};
for (const r of rows) {
  const k = r.log + ":" + r.tree_size;
  const g = groups[k] ||= { log: r.log, tree_size: r.tree_size, rows: 0, keys: new Set(), sigs: new Set(), roots: new Set(), consistency: {}, first_at: r.at, last_at: r.at, days: new Set() };
  g.rows++;
  g.keys.add(r.witness_public_key);
  g.sigs.add(r.witness_sig);
  g.roots.add(r.root);
  g.consistency[r.consistency] = (g.consistency[r.consistency] || 0) + 1;
  g.days.add(r.at.slice(0, 10));
  if (r.at < g.first_at) g.first_at = r.at;
  if (r.at > g.last_at) g.last_at = r.at;
}
const slim = (g) => ({ tree_size: g.tree_size, rows: g.rows, distinct_keys: g.keys.size, distinct_sigs: g.sigs.size, distinct_roots: g.roots.size, first_at: g.first_at, last_at: g.last_at, distinct_days: g.days.size, consistency: g.consistency });
const ledger = Object.values(groups).filter((g) => g.log === "ledger").sort((a, b) => a.tree_size - b.tree_size).map(slim);
const identity = Object.values(groups).filter((g) => g.log === "identity_events" && g.rows > 1).sort((a, b) => b.rows - a.rows).slice(0, 20).map(slim);

const countersignedWithType = rows.filter((r) => r.type === "witness-countersignature").length;
const allLines = [];
for (const file of files) {
  for (const line of fs.readFileSync(DIR + "/" + file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    if (j.type === "witness-countersignature" || j.status === "countersigned" || j.status === "refused-consistency-failure") allLines.push({ ...j, file });
  }
}
const refused = allLines.filter((r) => r.status && r.status !== "countersigned" && r.log).map((r) => ({ file: r.file ?? null, at: r.at, log: r.log, tree_size: r.tree_size, consistency: r.consistency, status: r.status, has_key: !!r.witness_public_key, has_sig: !!r.witness_sig }));

const out = {
  source: {
    repo: "1f916-ai/1f916",
    commit: "fa858d858a67eaae15fb75d709c99a90b873a3ae",
    files: files.length,
    rows: census.rows,
    countersigned: rows.length,
    fromClaims: rows.filter((r) => norm(r.consistency)).length,
  },
  aggregate: {
    demoted: census.demoted,
    fromClaims: census.fromClaims,
    demotedPct: census.demotedPct,
  },
  byLog,
  signatureReuse: { ledger, identity_events_top_repeated: identity },
  typeStatus: {
    countersigned: rows.length,
    typeRowsAll: allLines.filter((r) => r.type === "witness-countersignature").length,
    countersignedWithType,
    countersignedWithoutType: rows.filter((r) => r.type !== "witness-countersignature").length,
    typeWithoutCountersigned: allLines.filter((r) => r.type === "witness-countersignature" && r.status !== "countersigned").length,
  },
  refusedConsistency: refused,
};
console.log(JSON.stringify(out, null, 2));