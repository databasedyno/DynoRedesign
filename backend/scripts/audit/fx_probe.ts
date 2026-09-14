require("dotenv").config({ path: "/app/backend/.env" });
(async () => {
  const mod = await import("../../helper/currencyConvert");
  const cc = (mod as any).default || (mod as any).currencyConvert;
  for (const [s, t] of [["USD", "EUR"], ["USD", "GBP"], ["EUR", "USD"], ["BTC", "EUR"], ["USD", "NGN"]]) {
    const t0 = Date.now();
    const r = await cc({ sourceCurrency: s, currency: [t], amount: 100, fixedDecimal: true }).catch((e: any) => ({ err: e.message }));
    console.log(`${s}->${t}`, JSON.stringify(r), `${Date.now() - t0}ms`);
  }
  process.exit(0);
})();
