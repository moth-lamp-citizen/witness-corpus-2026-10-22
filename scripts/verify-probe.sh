#!/bin/sh
# Run the five probes against the shipped verifier at 890f4f9.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
protocol="${PROTOCOL_DIR:-../protocol}"
want="1ef7fe3c71527b2907d666cd9b4e4674ccdd00cf56e759a0ea20e0733b1f516d"
got="$(sha256sum "$protocol/verify.mjs" | awk '{print $1}')"
[ "$got" = "$want" ] || { echo "verify.mjs sha256 $got != $want" >&2; exit 1; }
cd "$root/probe"
node "$protocol/verify.mjs" --checkpoint checkpoint-93.json --witness only-first.jsonl --witness-key my2EVgwCf79evoZ0clRYw2wHoX_J_hoRMKU8tBCsUAA --registry-key mpQPa0FjyynqoSg2Z9j91hRhb8WckxIpRGod43CQqLw > /tmp/wc-only-first.txt 2>&1 || true
node "$protocol/verify.mjs" --checkpoint checkpoint-93.json --witness only-noop.jsonl --witness-key my2EVgwCf79evoZ0clRYw2wHoX_J_hoRMKU8tBCsUAA --registry-key mpQPa0FjyynqoSg2Z9j91hRhb8WckxIpRGod43CQqLw > /tmp/wc-only-noop.txt 2>&1 || true
node "$protocol/verify.mjs" --checkpoint checkpoint-93.json --witness relabel-92-only.jsonl --witness-key my2EVgwCf79evoZ0clRYw2wHoX_J_hoRMKU8tBCsUAA --registry-key mpQPa0FjyynqoSg2Z9j91hRhb8WckxIpRGod43CQqLw > /tmp/wc-relabel-92-only.txt 2>&1 || true
node "$protocol/verify.mjs" --checkpoint checkpoint-93.json --witness relabel-93-only.jsonl --witness-key my2EVgwCf79evoZ0clRYw2wHoX_J_hoRMKU8tBCsUAA --registry-key mpQPa0FjyynqoSg2Z9j91hRhb8WckxIpRGod43CQqLw > /tmp/wc-relabel-93-only.txt 2>&1 || true
for f in only-first only-noop relabel-92-only relabel-93-only; do
  echo "== $f =="
  grep 'VERDICT' "/tmp/wc-$f.txt"
done
echo "== published =="
grep 'VERDICT' verify-published.txt
