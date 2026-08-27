/* Thorough per-file hardcoded-string extractor for the 5 high-priority files. */
const fs = require("fs");
const files = [
  "pages/invoices.tsx",
  "Components/Page/Customers/index.tsx",
  "Components/UI/ForgotPasswordDialog/index.tsx",
  "Components/Page/Profile/AccountSetting.tsx",
  "pages/referrals.tsx",
];

const patterns = [
  { re: /\b(label|placeholder|title|subTitle|subtitle|helperText|heading|description|text|tooltip|message|content|header|emptyMessage|confirmText|cancelText|buttonText|okText)\s*=\s*"([^"]{3,})"/g, tag: "prop" },
  { re: /(?:toast|enqueueSnackbar|showToast|Swal\.fire|setError|setMessage|alert)\s*(?:\.\w+)?\s*\(\s*"([^"]{5,})"/g, tag: "toast" },
  { re: />\s*([A-Z][a-zA-Z][a-zA-Z0-9 ,.'&!?:%()\/’–-]{4,})\s*</g, tag: "jsx" },
  { re: /["']([A-Z][a-z]+(?: [A-Za-z][a-z]+){1,}[.!?]?)["']/g, tag: "str" },
];
const isNoise = (s) =>
  /Urbanist|fontFamily|rgba|#[0-9a-fA-F]{3,}|https?:|data-testid|\$\{|<|>|Mui|palette|\.png|\.svg|\.json|application\/|image\/|API|USD|BTC|ETH/.test(s) ||
  /^[A-Z][a-z]+[A-Z]/.test(s); // camelCase identifiers

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  const hits = new Map();
  for (const { re, tag } of patterns) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const val = (m[2] || m[1]).trim();
      if (val.length < 4 || isNoise(val)) continue;
      // find line number
      const idx = src.slice(0, m.index).split("\n").length;
      const key = `${idx}:${val}`;
      if (!hits.has(val)) hits.set(val, `${tag} @${idx}`);
    }
  }
  console.log(`\n########## ${f}  (${hits.size} unique) ##########`);
  for (const [val, meta] of hits) console.log(`  [${meta}] ${val}`);
}
