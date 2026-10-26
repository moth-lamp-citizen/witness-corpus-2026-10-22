#!/bin/sh
# Run the per-log census, the signature checks, and the assertions on the committed JSON.
set -eu
cd "$(dirname "$0")"

if [ ! -f ../sources/witness/2026-08-09.jsonl ]; then
  echo "sources/witness missing; fetching the 65 files at the pinned commit"
  ../scripts/fetch-sources.sh
fi

node analyze.mjs > per-log.regen.json
diff -u per-log.json per-log.regen.json
node verify-sig.mjs
node - <<'NODE'
const j = require("./per-log.json");
const assert = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? "PASS" : "FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want));
  if (!ok) process.exitCode = 1;
};
assert("countersigned", j.source.countersigned, 26685);
assert("fromClaims", j.source.fromClaims, 26683);
assert("demoted total", j.aggregate.demoted, 1611);
assert("identity_events demoted", j.byLog.identity_events.demoted, 22);
assert("ledger demoted", j.byLog.ledger.demoted, 1589);
assert("identity_events rate", j.byLog.identity_events.demotedPct, 0.1649);
assert("ledger rate", j.byLog.ledger.demotedPct, 11.9107);
const l11 = j.signatureReuse.ledger.find((g) => g.tree_size === 11);
assert("ledger 11 rows", l11.rows, 7761);
assert("ledger 11 keys", l11.distinct_keys, 1);
assert("ledger 11 sigs", l11.distinct_sigs, 1);
assert("ledger 11 roots", l11.distinct_roots, 1);
assert("ledger 11 first", l11.first_at, "2026-09-02T05:46:13.640Z");
assert("ledger 11 last", l11.last_at, "2026-10-21T23:15:43.098Z");
assert("ledger 11 days", l11.distinct_days, 41);
assert("type rows", j.typeStatus.typeRowsAll, 26624);
assert("countersigned without type", j.typeStatus.countersignedWithoutType, 62);
assert("type without countersigned", j.typeStatus.typeWithoutCountersigned, 1);
assert("refused rows", j.refusedConsistency.length, 1);
assert("refused status", j.refusedConsistency[0].status, "refused-consistency-failure");
NODE

if [ -f row6-countersignatures.jsonl ]; then
  node analyze-row6.mjs > row6.regen.json
  diff -u row6.json row6.regen.json
  echo "PASS row6 counts (cutoff 3136, full 3146)"
else
  echo "SKIP row6 (run ./fetch-row6.sh first)"
fi
echo "ALL PASS"