#!/bin/sh
# Reproduce the row 6 push-receipts checks. Public data; no key, no write.
set -eu
cd "$(dirname "$0")"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c SHA256SUMS
else
  shasum -a 256 -c SHA256SUMS
fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet https://github.com/GavinOB/1f916-witness.git "$tmp/w"
git -C "$tmp/w" checkout --quiet 549267f451286255cce115db66856b6f0cbaf3ee
node check.mjs "$tmp/w"
