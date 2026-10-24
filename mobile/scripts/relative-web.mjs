// Makes the web export work from any folder (for example inside an artifact):
// every absolute /_expo and /assets path becomes relative to the page.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const file of walk(dist).filter((f) => /\.(js|html)$/.test(f))) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replaceAll('"/_expo/', '"_expo/')
    .replaceAll('"/assets/', '"assets/')
    .replaceAll('href="/favicon.ico"', 'href="favicon.ico"');
  if (after !== before) writeFileSync(file, after);
}
console.log("relative paths ready in", dist);
