// Lists every installed package whose engines.node excludes Node 20 (used to pin resolutions for the Node 20 Docker build).
const fs = require("fs");
const path = require("path");
const semver = require("semver");
const root = path.resolve(__dirname, "..", "..", "node_modules");
const seen = new Set();
const out = [];
function walk(dir, depth) {
  if (depth > 6 || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (name.startsWith("@")) { walk(p, depth); continue; }
    const pj = path.join(p, "package.json");
    if (fs.existsSync(pj)) {
      try {
        const j = JSON.parse(fs.readFileSync(pj, "utf8"));
        const range = j.engines && j.engines.node;
        const key = `${j.name}@${j.version}`;
        if (range && !seen.has(key) && !semver.satisfies("20.20.2", range, { includePrerelease: true })) { seen.add(key); out.push(`${key} engines.node=${range}  (${path.relative(root, p)})`); }
      } catch {}
      walk(path.join(p, "node_modules"), depth + 1);
    }
  }
}
walk(root, 0);
console.log(out.sort().join("\n") || "OK: every installed package supports Node 20");
