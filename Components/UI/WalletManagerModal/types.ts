export type AddRow = { key: string; currency: string; address: string; name: string; tag: string };
export type EditState = { name: string; address: string; tag: string; remove: boolean };
export type OpResult = {
  index: number;
  action: string;
  currency?: string;
  wallet_id?: number;
  status: "ok" | "error";
  message: string;
};
export type OpMeta = { origin: "existing" | "add"; walletId?: string | number; addKey?: string };
export type Tw = (key: string, defaultValue: string, options?: any) => string;

const TAG_CHAINS = ["XRP", "RLUSD"];
export const isTagChain = (c: string) => TAG_CHAINS.includes(c);
export const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const SUDO_DEFAULT_TTL = 600;

export const tone = (dark: boolean) => ({
  surface: dark ? "rgba(255,255,255,0.03)" : "#FAFAFC",
  surfaceHover: dark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
  indigo: dark ? "#818CF8" : "#4338CA",
  indigoSoft: dark ? "rgba(129,140,248,0.14)" : "rgba(67,56,202,0.08)",
  emerald: dark ? "#34D399" : "#047857",
  emeraldSoft: dark ? "rgba(52,211,153,0.12)" : "rgba(16,185,129,0.10)",
  amber: dark ? "#FBBF24" : "#B45309",
  amberSoft: dark ? "rgba(251,191,36,0.14)" : "rgba(245,158,11,0.12)",
  rose: dark ? "#FB7185" : "#BE123C",
  roseSoft: dark ? "rgba(251,113,133,0.12)" : "rgba(244,63,94,0.08)",
});
