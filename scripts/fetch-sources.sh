#!/bin/sh
# Fetch the 65 witness day files at the pinned commit and verify the hashes.
set -eu
root="$(cd "$(dirname "$0")/.." && pwd)"
commit="fa858d858a67eaae15fb75d709c99a90b873a3ae"
mkdir -p "$root/sources/witness"
cd "$root/sources/witness"
for n in $(awk '{print $2}' "$root/data/source-SHA256SUMS"); do
  curl -fsS -o "$n" "https://raw.githubusercontent.com/1f916-ai/1f916/$commit/witness/$n"
done
sha256sum -c "$root/data/source-SHA256SUMS"
