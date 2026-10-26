#!/bin/sh
# Fetch the row-6 countersignature file at the commit analyzed in row6.json, then check its bytes.
set -eu
cd "$(dirname "$0")"
file=row6-countersignatures.jsonl
curl -fsSL "https://raw.githubusercontent.com/GavinOB/1f916-witness/05966e7a269feae78a1c5da7ef5a67fa5a0a3cd5/witness-state/countersignatures.jsonl" -o "$file"
echo "aeb692a85623f0b75343c5259de074c818c14ba9dbf5fac2ccf9d42eb20c0d7a  $file" | shasum -a 256 -c -
