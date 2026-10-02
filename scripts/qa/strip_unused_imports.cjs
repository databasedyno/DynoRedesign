#!/usr/bin/env node
/**
 * Remove unused import bindings using the TypeScript compiler's own
 * noUnusedLocals diagnostics (TS6133 / TS6192 / TS6196 / TS6198).
 *   node scripts/qa/strip_unused_imports.cjs <path/to/tsconfig.json> [--dry] [--skip=dir1,dir2]
 * Only import declarations are touched; side-effect imports (`import "x"`)
 * are never flagged by tsc and are left alone. Re-run until it reports 0.
 */
const fs = require("fs");
const path = require("path");

const configPath = path.resolve(process.argv[2]);
const check = process.argv.includes("--check");
const dry = process.argv.includes("--dry") || check;
const skipArg = (process.argv.find((a) => a.startsWith("--skip=")) || "--skip=").slice(7);
const skipDirs = skipArg ? skipArg.split(",").filter(Boolean) : [];
const projectRoot = path.dirname(configPath);
const ts = require(require.resolve("typescript", { paths: [projectRoot, process.cwd()] }));

const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
if (cfg.error) throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, projectRoot);
parsed.options.noUnusedLocals = true;
parsed.options.noEmit = true;
parsed.options.incremental = false;
delete parsed.options.tsBuildInfoFile;

const program = ts.createProgram(parsed.fileNames, parsed.options);
const CODES = new Set([6133, 6192, 6196, 6198]);
const diags = ts.getPreEmitDiagnostics(program).filter((d) => d.file && CODES.has(d.code));

const byFile = new Map();
for (const d of diags) {
  const f = d.file.fileName;
  if (f.includes("/node_modules/") || f.endsWith(".d.ts")) continue;
  const rel = path.relative(projectRoot, f);
  if (skipDirs.some((s) => rel === s || rel.startsWith(s + "/"))) continue;
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(d);
}

const findNode = (sf, pos) => {
  let best = sf;
  const visit = (n) => {
    if (pos >= n.getStart(sf) && pos < n.getEnd()) {
      best = n;
      ts.forEachChild(n, visit);
    }
  };
  visit(sf);
  return best;
};

let filesChanged = 0;
let bindingsRemoved = 0;
let declsRemoved = 0;

for (const [fileName, fileDiags] of byFile) {
  const sf = program.getSourceFile(fileName);
  const text = sf.getFullText();
  // decl -> { dropDefault, dropNamespace, dropSpecifiers:Set<node>, dropAll }
  const plan = new Map();
  const planFor = (decl) => {
    if (!plan.has(decl)) plan.set(decl, { dropDefault: false, dropNamespace: false, dropSpecifiers: new Set(), dropAll: false });
    return plan.get(decl);
  };

  for (const d of fileDiags) {
    let n = findNode(sf, d.start);
    let decl = n;
    while (decl && !ts.isImportDeclaration(decl)) decl = decl.parent;
    if (!decl || !decl.importClause) continue; // not an import (local var, param, …) or side-effect import
    if (d.code === 6192 || n === decl) {
      // 6192, or a 6133 anchored on the whole statement (sole default/namespace binding)
      planFor(decl).dropAll = true;
      continue;
    }
    // climb to the binding node
    let b = n;
    while (b && !(ts.isImportSpecifier(b) || ts.isNamespaceImport(b) || ts.isImportClause(b))) b = b.parent;
    if (!b) continue;
    const p = planFor(decl);
    if (ts.isImportSpecifier(b)) p.dropSpecifiers.add(b);
    else if (ts.isNamespaceImport(b)) p.dropNamespace = true;
    else if (ts.isImportClause(b)) {
      // diagnostic on the default-import identifier
      if (b.name && d.start >= b.name.getStart(sf) && d.start < b.name.getEnd()) p.dropDefault = true;
    }
  }

  const edits = []; // {start,end,replacement}
  for (const [decl, p] of plan) {
    const clause = decl.importClause;
    const named = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : null;
    const ns = clause.namedBindings && ts.isNamespaceImport(clause.namedBindings) ? clause.namedBindings : null;
    const keepDefault = !!clause.name && !p.dropDefault && !p.dropAll;
    const keepNs = !!ns && !p.dropNamespace && !p.dropAll;
    const keptSpecs = named && !p.dropAll ? named.elements.filter((e) => !p.dropSpecifiers.has(e)) : [];
    const removedCount = (clause.name && !keepDefault ? 1 : 0) + (ns && !keepNs ? 1 : 0) + (named ? named.elements.length - keptSpecs.length : 0);
    bindingsRemoved += removedCount;

    const fullStart = decl.getFullStart();
    const start = decl.getStart(sf);
    const end = decl.getEnd();
    if (!keepDefault && !keepNs && keptSpecs.length === 0) {
      // remove the whole statement incl. its line break
      let delEnd = end;
      if (text[delEnd] === "\r") delEnd++;
      if (text[delEnd] === "\n") delEnd++;
      // keep leading trivia (comments) but drop the blank-line-only prefix
      const lead = text.slice(fullStart, start);
      const lastNl = lead.lastIndexOf("\n");
      const delStart = lastNl >= 0 && lead.slice(lastNl + 1).trim() === "" ? fullStart + lastNl + 1 : start;
      edits.push({ start: delStart, end: delEnd, replacement: "" });
      declsRemoved++;
      continue;
    }
    const parts = [];
    if (keepDefault) parts.push(clause.name.getText(sf));
    if (keepNs) parts.push(ns.getText(sf));
    if (keptSpecs.length) {
      const multiline = named.getText(sf).includes("\n");
      parts.push(multiline ? `{\n  ${keptSpecs.map((e) => e.getText(sf)).join(",\n  ")},\n}` : `{ ${keptSpecs.map((e) => e.getText(sf)).join(", ")} }`);
    }
    const typeOnly = clause.isTypeOnly ? "type " : "";
    const attrs = decl.attributes || decl.assertClause;
    const tail = attrs ? ` ${attrs.getText(sf)}` : "";
    const semi = text[end - 1] === ";" ? ";" : "";
    edits.push({ start, end, replacement: `import ${typeOnly}${parts.join(", ")} from ${decl.moduleSpecifier.getText(sf)}${tail}${semi}` });
  }
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  filesChanged++;
  if (!dry) fs.writeFileSync(fileName, out);
}

console.log(`${dry ? "[dry] " : ""}${filesChanged} files, ${bindingsRemoved} unused import bindings removed (${declsRemoved} whole import statements). Non-import unused locals left untouched: ${diags.length - bindingsRemoved}`);
if (check && bindingsRemoved > 0) {
  for (const [fileName, fileDiags] of byFile) {
    for (const d of fileDiags) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      console.log(`  ${path.relative(projectRoot, fileName)}:${line + 1}:${character + 1}  ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
    }
  }
  console.error(`✖ Unused imports found — run: node scripts/qa/strip_unused_imports.cjs ${process.argv[2]}`);
  process.exit(1);
}
