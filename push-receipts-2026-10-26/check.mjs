import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const repo = process.argv[2];
if (!repo) {
  console.error("usage: node check.mjs <path-to-GavinOB/1f916-witness>");
  process.exit(2);
}
const FILE = "witness-state/push-receipts.jsonl";
const EXPECTED_SHA = "dbd95a64971b10fd827258d30d60b447972463dda5697814cd3055ebac1be255";
const file = repo + "/" + FILE;
let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "PASS" : "FAIL") + " " + name + (ok ? "" : " got=" + JSON.stringify(got) + " want=" + JSON.stringify(want)));
  if (!ok) failed++;
};
const assert = (name, cond, detail = "") => {
  console.log((cond ? "PASS" : "FAIL") + " " + name + (cond ? "" : " " + detail));
  if (!cond) failed++;
};

const bytes = readFileSync(file);
check("sha256", createHash("sha256").update(bytes).digest("hex"), EXPECTED_SHA);
const lines = bytes.toString("utf8").trimEnd().split("\n");
const rows = lines.map((l) => JSON.parse(l));
check("lines", lines.length, 466);
check("first now_utc", rows[0].now_utc, "2026-10-17T06:07:04.063Z");
check("last now_utc", rows[rows.length - 1].now_utc, "2026-10-26T22:07:04.122Z");

const hours = [...new Set(rows.map((r) => r.now_utc.slice(0, 13)))];
check("distinct UTC hours", hours.length, 233);
let gaps = 0;
for (let i = 1; i < hours.length; i++) {
  if (Date.parse(hours[i] + ":00:00Z") - Date.parse(hours[i - 1] + ":00:00Z") !== 3600000) gaps++;
}
check("hour gaps", gaps, 0);

const id = rows.filter((r) => r.log === "identity_events");
const led = rows.filter((r) => r.log === undefined);
check("identity rows", id.length, 233);
check("ledger rows", led.length, 233);
check("identity distinct sigs", new Set(id.map((r) => r.receipt.sig)).size, 233);
check("ledger distinct sigs", new Set(led.map((r) => r.receipt.sig)).size, 1);
check("ledger deduplicated true", led.filter((r) => r.deduplicated === true).length, 233);
check("identity deduplicated true", id.filter((r) => r.deduplicated === true).length, 0);
check("distinct sigs, all rows", new Set(rows.map((r) => r.receipt.sig)).size, 234);
check("ledger rows missing log", led.filter((r) => r.log === undefined).length, 233);
check("ledger rows missing registry_public_key", led.filter((r) => r.registry_public_key === undefined).length, 233);
check("ledger rows missing witness_id", led.filter((r) => r.witness_id === undefined).length, 233);
check("ledger rows missing tree_size", led.filter((r) => r.tree_size === undefined).length, 233);
check("identity keys", Object.keys(id[0]), ["now", "now_utc", "accepted", "receipt", "registry_public_key", "witness_id", "log", "tree_size"]);
check("ledger keys", Object.keys(led[0]), ["now", "now_utc", "accepted", "deduplicated", "receipt"]);

const key = createPublicKey({
  key: { kty: "OKP", crv: "Ed25519", x: id[0].registry_public_key.x },
  format: "jwk",
});
check("all 466 signatures verify",
  rows.filter((r) => verify(null, Buffer.from(r.receipt.payload, "utf8"), key, Buffer.from(r.receipt.sig, "base64url"))).length,
  466);
const mut = rows[0].receipt.payload.slice(0, -1) + (rows[0].receipt.payload.endsWith("0") ? "1" : "0");
check("negative control (one-character mutation) false",
  verify(null, Buffer.from(mut, "utf8"), key, Buffer.from(rows[0].receipt.sig, "base64url")),
  false);
check("ledger payload timestamp",
  new Date(Number(led[0].receipt.payload.split(":").pop())).toISOString(),
  "2026-10-17T04:06:49.791Z");

const git = (cmd) => execSync(cmd, { cwd: repo, encoding: "utf8" }).trim();
const fileCommits = git("git log --format=%H -- " + FILE).split("\n");
check("commits touching the file", fileCommits.length, 233);
const pickaxe = git("git log --all -S'witness-receipt.v1' --format=%H --").split("\n");
check("pickaxe set equals file commits",
  [...pickaxe].sort().join(","), [...fileCommits].sort().join(","));
check("first add commit",
  git("git log --diff-filter=A --format=%H -- " + FILE),
  "0b7105921ada83777513f08e6fa699763863bfaf");
assert("feature commit adds receipt keeping",
  git("git show -s --format=%s 55b2388ddc4cbb2c276c9490675e20a2cba7e67b").includes("keep receipts"));

let prev = 0, stepBad = 0;
for (const c of [...fileCommits].reverse()) {
  const n = Number(git("git show " + c + ":" + FILE + " | wc -l"));
  if (n !== prev + 2) stepBad++;
  prev = n;
}
check("append-only, each commit adds 2 lines", stepBad, 0);
check("final line count", prev, 466);
const grepPaths = execSync(
  "git rev-list --all | xargs git grep -l 'witness-receipt.v1' 2>/dev/null | sed 's/^[0-9a-f]*://' | sort -u",
  { cwd: repo, encoding: "utf8", shell: "/bin/bash" }
).trim();
check("receipt string path", grepPaths, FILE);

console.log(failed ? "\n" + failed + " FAIL" : "\nALL PASS");
process.exit(failed ? 1 : 0);
