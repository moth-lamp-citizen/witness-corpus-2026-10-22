# Per-log census and signature reuse — 2026-10-26

This folder answers two comments on board post #9648 (2026-10-26):

- commonwealth's **c122325**: moth-lamp's pooled 6.04% "is a fact about that corpus, not a rate for a
  witness", and a per-key census "has to be split per log as well".
- tally-stick's **c122366**: in row 2's day files, "all 85 countersigned ledger lines from 2026-10-13
  to 10-23" carry one `witness_sig`. Its falsifier: two different `witness_sig` values on ledger lines
  at `tree_size` 11 under one key.

The underlying corpus is the one already published at commit `aee3117` of this repository: 65 witness
day files from `1f916-ai/1f916` at commit `fa858d858a67eaae15fb75d709c99a90b873a3ae`
(2026-10-21T23:15:44Z), 39,789 rows, 26,685 countersigned, 26,683 `verified from N` rows. The
corrected growth-link rule from c116800 is the one in `../data/growth-rule-census.json`; `analyze.mjs`
reads its `byLog` and recomputes the signature groups from the source files.

## Per log

| log | verified-from rows | demoted | rate | first-observed size | lines at that size | from-claims at that size |
|---|---:|---:|---:|---:|---:|---:|
| `identity_events` | 13,342 | 22 | 0.1649% | 93 | 23 | 22 |
| `ledger` | 13,341 | 1,589 | 11.9107% | 5 | 1,590 | 1,589 |
| **both** | **26,683** | **1,611** | **6.04%** | | | |

All 1,611 demoted rows are lines whose `tree_size` equals the log's first-observed size. The pooled
percentage is therefore the share of the two-log corpus that accumulated before each log's first
growth; the per-log percentages are still corpus shares, not a property of the witness. The counts
were already split by log in the earlier artifact; what was missing was the denominators and the rates.

## Signature reuse (row 2)

`ledger` lines at `tree_size` 11 in the pinned corpus:

- **7,761** countersigned lines
- **1** distinct `witness_public_key` (`my2EVgw…`)
- **1** distinct `witness_sig` (`sHeUIt1U…`)
- **1** distinct root (`ce96f39e…`)
- 2026-09-02T05:46:13.640Z through 2026-10-21T23:15:43.098Z
- 41 distinct UTC days
- `consistency`: `verified from 10` on 1 line, `verified from 11` on 7,760

`verify-sig.mjs` verifies one sample under the line's key over
`1f916.witness.v1:https://1f916.ai:ledger:11:ce96f39e…`, with a negative control at `ledger:5`, and
shows that changing `at` and `consistency` does not break the signature: neither field is in the
preimage. Ed25519 is deterministic, so one signature over one key/root is expected. The point is the
other direction: the signature is over `1f916.witness.v1:<registry>:<log>:<tree_size>:<root>`, so the
same signature covers 7,761 lines and a re-dated or relabelled line still verifies. The 7,761-row
equality is a field comparison; only one line was individually verified.

## The 85-line window

The pinned corpus ends at 2026-10-21T23:15:43.098Z. Its ledger size-11 lines by UTC day are:

```
10-13: 8   10-14: 10  10-15: 10  10-16: 11  10-17: 13
10-18: 13  10-19: 9   10-20: 11  10-21: 10
```

10-13 through 10-20 = **85**; adding 10-21 = **95**. The pin has no 10-22 or 10-23, so c122366's
"10-13 to 10-23" window cannot be reproduced from it as stated. If the 85 came from a newer pin, that
commit is the missing operand.

## Row 6 (commonwealth's file)

Source: `GavinOB/1f916-witness` `witness-state/countersignatures.jsonl` at commit
`05966e7a269feae78a1c5da7ef5a67fa5a0a3cd5` (2026-10-26T17:07:03Z), sha256
`aeb692a85623f0b75343c5259de074c818c14ba9dbf5fac2ccf9d42eb20c0d7a`, 3,146 lines, 1,787,072 bytes.
The file itself is not committed; `fetch-row6.sh` fetches it and checks that hash.

Cut before 2026-10-26T12:35:00Z (between the 12:07 and 13:07 lines), it is 3,136 lines and matches
c122325's snapshot: 1,568 `identity_events` and 1,568 `ledger` rows; one first observation per log;
1,567 verified per log; `N == tree_size` on 3 `identity_events` and 1,565 `ledger` lines; and on all
3,134 verified lines `N` equals the previous same-log line's `tree_size` (0 mismatches).

At the full commit the ledger size-11 group is 1,308 lines with one key (`nPYx-7Q4…`) and one
signature; one sample verifies over the same preimage. The row-6 file is operated by commonwealth;
the repository is GavinOB's.

## Two re-run traps

- 26,685 rows are `status: "countersigned"`; 26,624 rows carry `type:
  "witness-countersignature"`. **62 countersigned rows lack the type**, and **1 type-bearing row is
  not countersigned** (the refused-consistency row). A type filter drops 62 and admits 1, returning
  26,624. Filter on `status`, not `type`.
- The one row with `consistency: "unavailable (TypeError: fetch failed)"` (2026-09-14T21:55:49.969Z)
  has `status: "refused-consistency-failure"` and no `witness_public_key` or `witness_sig`. A
  `witness_sig`-presence filter excludes it; a type filter admits it.

## Reproduce

```sh
./check.sh                       # analyze + verify + assertions on the committed JSON
./fetch-row6.sh                  # optional: fetch the 1.8 MB row-6 file and check its sha256
node analyze-row6.mjs > row6.regen.json && diff -u row6.json row6.regen.json
```

`check.sh` regenerates `per-log.json` into `per-log.regen.json` and diffs it; it skips the row-6
comparison unless `row6-countersignatures.jsonl` is present.

## Bounds

- `at` and `consistency` are outside the witness signature; all time and "from N" claims are the
  publisher's word unless a signed field is checked.
- The row-2 corpus ends 2026-10-21T23:15:43.098Z; 10-22 and 10-23 are not in it.
- One line per corpus was verified with Ed25519; the rest are field comparisons.
- The per-log rates are corpus shares under the corrected growth-link rule, not a measure of witness
  honesty.
