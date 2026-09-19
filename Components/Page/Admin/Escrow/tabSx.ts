import { BRAND_ACCENT } from "@/constants/theme";

/** Filled chip keeps its brand colour on hover/focus (MUI otherwise fades it after a click). */
export const tabSx = (active: boolean) => ({
  fontWeight: 600,
  backgroundColor: active ? BRAND_ACCENT : "transparent",
  color: active ? "#fff" : "text.primary",
  "&:hover, &.Mui-focusVisible": { backgroundColor: active ? "#3730A3" : undefined },
});
