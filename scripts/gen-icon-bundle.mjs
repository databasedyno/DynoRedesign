// Builds styles/iconBundle.json — only the lucide icons the app actually uses —
// so <Icon/> renders offline/instantly instead of fetching from api.iconify.design
// at runtime (blank squares while loading / when the CDN is blocked).
// Run `yarn icons:bundle` after adding a new <Icon name=...> and commit the JSON.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { icons as lucide } from "@iconify-json/lucide";
import { getIcons } from "@iconify/utils";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["Components", "pages", "Containers", "utils", "hooks", "styles"];
const names = new Set();

const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/<Icon\b[^>]*?\bname=["']([a-z0-9-]+)["']/g)) names.add(m[1]);
      for (const m of src.matchAll(/["'`]lucide:([a-z0-9-]+)["'`]/g)) names.add(m[1]);
    }
  }
};
DIRS.forEach((d) => walk(join(ROOT, d)));

const bundle = getIcons(lucide, [...names]);
const missing = (bundle && bundle.not_found) || [];
if (missing.length) console.warn("[icon-bundle] not in lucide:", missing.join(", "));
delete bundle.not_found;
writeFileSync(join(ROOT, "styles/iconBundle.json"), JSON.stringify(bundle));
console.log(`[icon-bundle] ${Object.keys(bundle.icons).length} icons bundled`);
