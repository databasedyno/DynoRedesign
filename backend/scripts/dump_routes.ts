/* eslint-disable @typescript-eslint/no-explicit-any */
// Dumps every mounted Express route (method + full path) as JSON. Read-only.
import dotenv from "dotenv";
dotenv.config();
import express from "express";

async function main() {
  const app = express();
  const router = (await import("../routes")).default;
  const { publishableKeyRouter, embedPublicRouter } = await import("../routes/publishableKeyRouter");
  const diagnosticsRouter = (await import("../routes/diagnosticsRouter")).default;
  const ledgerRouter = (await import("../routes/ledgerRouter")).default;
  const refundRouter = (await import("../routes/refundRouter")).default;
  const { buyButtonRouter } = await import("../routes/buyButtonRouter");
  app.use("/api/embed/public", embedPublicRouter);
  app.use("/api", router);
  app.use("/api/diagnostics", diagnosticsRouter);
  app.use("/api/ledger", ledgerRouter);
  app.use("/api/refunds", refundRouter);
  app.use("/api/publishable-keys", publishableKeyRouter);
  app.use("/api/buy-buttons", buyButtonRouter);

  const out: { method: string; path: string; mw: string[] }[] = [];
  const pathFromRegexp = (re: RegExp): string => {
    let s = re.source;
    s = s.replace(/^\^\\\//, "/").replace(/\\\/\?\(\?=\\\/\|\$\)$/, "").replace(/\\\//g, "/").replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":p").replace(/\$$/, "").replace(/\^/, "");
    return s === "/?(?=/|$)" || s === "" ? "" : s;
  };
  const nameOf = (h: any): string => (h && h.name && h.name !== "<anonymous>" ? h.name : "anon");
  const walk = (stack: any[], prefix: string, inheritedIn: string[]) => {
    const pending: Record<string, string[]> = {};
    let inherited = [...inheritedIn];
    for (const layer of stack) {
      const src = layer.regexp?.source || "";
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
        const p = layer.route.path;
        const paths = Array.isArray(p) ? p : [p];
        const mws = layer.route.stack.map((l: any) => nameOf(l.handle));
        for (const pp of paths) for (const m of methods) out.push({ method: m.toUpperCase(), path: (prefix + pp).replace(/\/+/g, "/"), mw: [...inherited, ...mws] });
      } else if (layer.name === "router" && layer.handle?.stack) {
        let seg = "";
        if (layer.regexp && layer.regexp.source !== "^\\/?$") {
          seg = pathFromRegexp(layer.regexp);
          if (layer.keys?.length) {
            for (const k of layer.keys) seg = seg.replace(":p", ":" + k.name);
          }
        }
        walk(layer.handle.stack, prefix + seg, [...inherited, ...(pending[src] || [])]);
      } else if (src && src !== "^\\/?$" && src !== "^\\/?(?=\\/|$)") {
        (pending[src] ||= []).push(nameOf(layer.handle));
      } else if (prefix && (src === "^\\/?$" || src === "^\\/?(?=\\/|$)")) {
        inherited = [...inherited, "use:" + nameOf(layer.handle)];
      }
    }
  };
  walk(app._router.stack, "", []);
  const uniq = new Map<string, { method: string; path: string; mw: string[] }>();
  for (const r of out) uniq.set(r.method + " " + r.path, r);
  process.stdout.write(JSON.stringify([...uniq.values()], null, 0));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
