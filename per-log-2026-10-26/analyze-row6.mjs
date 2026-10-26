#!/usr/bin/env node
// Counts for the row-6 countersignature file at the pinned commit, plus one signature check.
// Fetch the file first with ./fetch-row6.sh; it is not committed (see .gitignore).
import fs from "node:fs";
import crypto from "node:crypto";

const FILE = process.argv[2] ?? "row6-countersignatures.jsonl";
const CUTOFF = "2026-10-26T12:35:00Z";
const EXPECTED_SHA = "aeb692a85623f0b75343c5259de074c818c14ba9dbf5fac2ccf9d42eb20c0d7a";
const EXPECTED_COMMIT = "05966e7a269feae78a1c5da7ef5a67fa5a0a3cd5";
const bytes = fs.readFileSync(FILE);
const sha = crypto.createHash("sha256").update(bytes).digest("hex");
const rows = bytes.toString("utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
if (sha !== EXPECTED_SHA) { console.error("sha256 " + sha + " != " + EXPECTED_SHA + "; refusing to analyze"); process.exit(1); }
const norm = (s) => /^verified from \d+$/.test(String(s));
const at = (r) => r.at;

function summarize(rs) {
  const byLog = {};
  for (const log of [...new Set(rs.map((r) => r.log))].sort()) {
    const logRows = rs.filter((r) => r.log === log).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    let prev = null, first = 0, verified = 0, sameSize = 0, mismatch = 0, noPrev = 0;
    const groups = {};
    for (const r of logRows) {
      if (r.consistency === "first observation") first++;
      else if (norm(r.consistency)) {
        verified++;
        const n = Number(r.consistency.match(/\d+/)[0]);
        if (n === r.tree_size) sameSize++;
        if (!prev) noPrev++;
        else if (n !== prev.tree_size) mismatch++;
      }
      prev = r;
      const g = groups[r.tree_size] ||= { rows: 0, keys: new Set(), sigs: new Set(), first_at: r.at, last_at: r.at };
      g.rows++; g.keys.add(r.witness_public_key); g.sigs.add(r.witness_sig);
      if (r.at < g.first_at) g.first_at = r.at;
      if (r.at > g.last_at) g.last_at = r.at;
    }
    const gs = Object.entries(groups).map(([size, g]) => ({ tree_size: Number(size), rows: g.rows, distinct_keys: g.keys.size, distinct_sigs: g.sigs.size, first_at: g.first_at, last_at: g.last_at })).sort((a, b) => b.rows - a.rows);
    byLog[log] = { rows: logRows.length, first_observations: first, verified, n_equals_tree_size: sameSize, n_not_previous_tree_size: mismatch, no_previous_line: noPrev, biggest_size_group: gs[0] ?? null };
  }
  return { lines: rs.length, byLog };
}

const cutoff = rows.filter((r) => at(r) < CUTOFF);
const full = rows;
const ledger11 = full.filter((r) => r.log === "ledger" && r.tree_size === 11).sort((a, b) => (a.at < b.at ? -1 : 1));
const sample = ledger11[ledger11.length - 1];
const b64u = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const key = crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: sample.witness_public_key }, format: "jwk" });
const preimage = "1f916.witness.v1:" + sample.registry + ":ledger:11:" + sample.root;
const sample_verified = crypto.verify(null, Buffer.from(preimage), key, b64u(sample.witness_sig));

const out = {
  source: {
    repo: "GavinOB/1f916-witness",
    path: "witness-state/countersignatures.jsonl",
    commit: EXPECTED_COMMIT,
    commit_date: "2026-10-26T17:07:03Z",
    sha256: sha,
    bytes: bytes.length,
    lines: rows.length,
  },
  cutoff_utc: CUTOFF,
  at_cutoff: summarize(cutoff),
  at_full: summarize(full),
  ledger_size_11: {
    rows: ledger11.length,
    distinct_keys: new Set(ledger11.map((r) => r.witness_public_key)).size,
    distinct_sigs: new Set(ledger11.map((r) => r.witness_sig)).size,
    first_at: ledger11[0].at,
    last_at: ledger11[ledger11.length - 1].at,
  },
  sample_verify: { at: sample.at, key: sample.witness_public_key, preimage, verified: sample_verified },
};
console.log(JSON.stringify(out, null, 2));
