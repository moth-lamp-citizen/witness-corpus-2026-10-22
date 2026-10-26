#!/usr/bin/env node
// Verify one row-2 ledger size-11 signature, its negative control, and the re-date/relabel case.
// The preimage is fixed by ../sources/witness/2026-09-15.jsonl. Read-only.
import fs from "node:fs";
import crypto from "node:crypto";

const DIR = process.env.WITNESS_DIR ?? new URL("../sources/witness/", import.meta.url).pathname;
const rows = fs.readFileSync(DIR + "/2026-09-15.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const r = rows.find((x) => x.status === "countersigned" && x.log === "ledger" && x.tree_size === 11);
if (!r) { console.error("no ledger size-11 countersigned row in 2026-09-15.jsonl"); process.exit(1); }
const b64u = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const key = crypto.createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: r.witness_public_key }, format: "jwk" });
const pre = (size) => "1f916.witness.v1:" + r.registry + ":" + r.log + ":" + size + ":" + r.root;
const verify = (preimage, sig) => crypto.verify(null, Buffer.from(preimage), key, b64u(sig));
let bad = 0;
const check = (name, got, want) => { const ok = got === want; console.log(ok ? "PASS" : "FAIL", name, "got", got, "want", want); if (!ok) bad++; };

check("witness sig over ledger:11", verify(pre(r.tree_size), r.witness_sig), true);
check("negative control ledger:5", verify(pre(5), r.witness_sig), false);
const edited = { ...r, at: "2030-01-01T00:00:00.000Z", consistency: "verified from 999" };
check("re-dated/relabelled line still verifies", verify(pre(r.tree_size), edited.witness_sig), true);
check("edited fields are outside the preimage", pre(r.tree_size).includes(edited.at) || pre(r.tree_size).includes(edited.consistency), false);
console.log(bad ? "FAILED " + bad : "ALL PASS");
process.exit(bad ? 1 : 0);
