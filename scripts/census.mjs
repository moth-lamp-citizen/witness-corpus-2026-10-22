import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = process.env.WITNESS_DIR ?? "sources/witness";
const out = process.env.OUT ?? "data/census.json";
const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
const rows = [];
for (const file of files) {
  const lines = readFileSync(dir + "/" + file, "utf8").split("\n").filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    let row; try { row = JSON.parse(lines[i]); } catch { continue; }
    rows.push({ file, i, row });
  }
}
const countersigned = rows.filter((x) => typeof x.row.witness_sig === "string");
const firstObs = countersigned.filter((x) => x.row.consistency === "first observation");
const fromRows = countersigned.filter((x) => /^verified from \d+$/.test(x.row.consistency ?? ""));
const prior = (x, n) => rows.filter((y) => y.row.log === x.row.log && y.row.tree_size === n && typeof y.row.witness_sig === "string" && !(y.file === x.file && y.i === x.i));
const classify = (x) => {
  const n = Number(/^verified from (\d+)$/.exec(x.row.consistency)[1]);
  const growth = n < x.row.tree_size;
  const any = prior(x, n);
  return { n, growth, sameFile: any.some((y) => y.file === x.file), anyFile: any.length > 0, otherFiles: [...new Set(any.map((y) => y.file))] };
};
const enriched = fromRows.map((x) => ({ ...x, c: classify(x) }));
const byLog = {};
for (const x of countersigned) {
  const b = (byLog[x.row.log] ??= { countersigned: 0, firstObservation: 0, from: 0, growth: 0, sameSize: 0, sameFilePrior: 0, crossFilePrior: 0, absentPrior: 0 });
  b.countersigned++;
  if (x.row.consistency === "first observation") b.firstObservation++;
}
for (const x of enriched) {
  const b = byLog[x.row.log];
  b.from++; b.growth += x.c.growth ? 1 : 0; b.sameSize += x.c.growth ? 0 : 1;
  if (!x.c.anyFile) b.absentPrior++;
  else if (!x.c.sameFile) b.crossFilePrior++;
  else b.sameFilePrior++;
}
const cross = enriched.filter((x) => x.c.anyFile && !x.c.sameFile);
const summary = {
  dir, files: files.length, first: files[0], last: files.at(-1), rows: rows.length,
  headRows: rows.filter((x) => !x.row.type).length,
  countersigned: countersigned.length,
  firstObservation: firstObs.map((x) => ({ file: x.file, at: x.row.at, log: x.row.log, tree_size: x.row.tree_size, status: x.row.status })),
  fromRows: fromRows.length,
  growth: enriched.filter((x) => x.c.growth).length,
  sameSize: enriched.filter((x) => !x.c.growth).length,
  sameFilePrior: enriched.filter((x) => x.c.sameFile).length,
  crossFilePrior: cross.length,
  absentPrior: enriched.filter((x) => !x.c.anyFile).length,
  crossFileDistinctDays: [...new Set(cross.map((x) => x.file))].length,
  crossFileRows: cross.map((x) => ({ file: x.file, at: x.row.at, log: x.row.log, tree_size: x.row.tree_size, from: x.c.n, priorIn: x.c.otherFiles })),
  byLog,
};
writeFileSync(out, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
