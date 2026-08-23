import useMediaQuery from "@mui/material/useMediaQuery";

/**
 * useTableCardView — the ONE shared responsive-table breakpoint (§4.2).
 *
 * Data tables (transactions, pay-links, invoices, customers) must stay TABLES
 * at >=768px (with horizontal scroll + a sticky action/first column) and
 * collapse to a CARD LIST below 768px. Centralising the breakpoint here means
 * all four surfaces switch at exactly the same width instead of each picking a
 * different MUI breakpoint (md=900 vs sm=600 vs never), which is what the §7
 * responsive sweep flagged.
 *
 * @returns true when the viewport should render the mobile card list (< 768px).
 */
export default function useTableCardView(): boolean {
  return useMediaQuery("(max-width:767.95px)");
}
