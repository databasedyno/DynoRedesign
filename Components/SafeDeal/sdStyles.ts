import { BRAND_ACCENT } from "@/constants/theme";

export const primaryBtn = { textTransform: "none", fontWeight: 800, borderRadius: 99, backgroundColor: BRAND_ACCENT, "&:hover": { backgroundColor: "#3730A3" } } as const;
export const ghostBtn = { textTransform: "none", fontWeight: 700, borderRadius: 99 } as const;
export const card = { p: { xs: 2, md: 2.5 }, borderRadius: 3, backgroundColor: "#fff", border: "1px solid #E5E7EB" } as const;
