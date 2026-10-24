// Makes the web export work from any folder (for example inside an artifact):
// every absolute /_expo and /assets path becomes relative to the page, and
// file names with brackets (which some hosts mangle) are renamed.
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const dist = process.argv[2] ?? "dist";
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

const renames = [];
for (const file of walk(dist)) {
  const name = basename(file);
  if (!/[[\]]/.test(name)) continue;
  const safe = name.replace(/\[\.\.\.|\[|\]/g, (m) => (m === "[..." ? "all-" : ""));
  renameSync(file, join(dirname(file), safe));
  renames.push([name, safe]);
}

for (const file of walk(dist).filter((f) => /\.(js|html)$/.test(f))) {
  const before = readFileSync(file, "utf8");
  let after = before
    .replaceAll('"/_expo/', '"_expo/')
    .replaceAll('"/assets/', '"assets/')
    .replaceAll('href="/favicon.ico"', 'href="favicon.ico"');
  for (const [from, to] of renames) after = after.replaceAll(from, to);
  if (after !== before) writeFileSync(file, after);
}
console.log("relative paths ready in", dist, renames.length ? `(renamed ${renames.map((r) => r[1]).join(", ")})` : "");
