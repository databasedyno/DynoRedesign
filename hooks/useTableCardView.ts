import useMediaQuery from "@mui/material/useMediaQuery";
import { SHELL_Q } from "@/styles/shellTokens";

/**
 * useTableCardView — the ONE shared responsive-table breakpoint.
 *
 * Data tables (transactions, invoices, customers) render as a CARD LIST on
 * phones, tablets (< 1024px) and touch screens up to 1279px (iPad landscape):
 * the tablet band used to squeeze the full desktop table into ~700px (wrapped
 * headers, cut columns — UX audit S4a) and gave fingers desktop density.
 *
 * @returns true when the viewport should render the card list.
 */
export default function useTableCardView(): boolean {
  return useMediaQuery(SHELL_Q.cardList, { noSsr: true });
}
