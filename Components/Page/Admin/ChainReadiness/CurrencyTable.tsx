import React, { useState } from "react";
import { Box, Chip, Collapse, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { CheckCircleRounded, ErrorRounded, ExpandMoreRounded, InfoRounded, WarningRounded } from "@mui/icons-material";
import { CheckStatus, CurrencyReadiness, Overall } from "@/api/chainReadiness";
import { formatDate } from "../adminUi";

const OVERALL_CHIP: Record<Overall, { label: string; color: "success" | "warning" | "error" }> = {
  ready: { label: "Ready", color: "success" },
  degraded: { label: "Degraded", color: "warning" },
  blocked: { label: "Blocked", color: "error" },
};

const FAMILY_LABEL: Record<CurrencyReadiness["family"], string> = {
  utxo: "UTXO · fee from amount",
  native: "Native · pays own gas",
  token: "Token · needs gas wallet",
  tag: "Tag-based · master wallet",
};

export const OverallChip = ({ overall, testid }: { overall: Overall; testid?: string }) => {
  const c = OVERALL_CHIP[overall];
  return <Chip size="small" label={c.label} color={c.color} data-testid={testid} data-overall={overall} sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />;
};

const CheckIcon = ({ status }: { status: CheckStatus }) => {
  if (status === "ok") return <CheckCircleRounded sx={{ fontSize: 16, color: "success.main" }} />;
  if (status === "warn") return <WarningRounded sx={{ fontSize: 16, color: "warning.main" }} />;
  if (status === "fail") return <ErrorRounded sx={{ fontSize: 16, color: "error.main" }} />;
  return <InfoRounded sx={{ fontSize: 16, color: "text.disabled" }} />;
};

const CurrencyRow: React.FC<{ row: CurrencyReadiness; defaultOpen: boolean }> = ({ row, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const fails = row.checks.filter((c) => c.status === "fail").length;
  const warns = row.checks.filter((c) => c.status === "warn").length;
  return (
    <>
      <TableRow hover data-testid={`chain-row-${row.currency}`} data-overall={row.overall} sx={{ cursor: "pointer", "& td": { borderBottom: open ? "none" : undefined } }} onClick={() => setOpen((v) => !v)}>
        <TableCell sx={{ width: 36, pr: 0 }}>
          <IconButton size="small" data-testid={`chain-row-${row.currency}-toggle`} sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><ExpandMoreRounded sx={{ fontSize: 18 }} /></IconButton>
        </TableCell>
        <TableCell>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{row.currency}</Typography>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{row.network} · {FAMILY_LABEL[row.family]}</Typography>
        </TableCell>
        <TableCell><OverallChip overall={row.overall} testid={`chain-row-${row.currency}-overall`} /></TableCell>
        <TableCell sx={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
          {fails > 0 && <Box component="span" sx={{ color: "error.main", fontWeight: 700, mr: 1 }}>{fails} failing</Box>}
          {warns > 0 && <Box component="span" sx={{ color: "warning.main", fontWeight: 600 }}>{warns} warning{warns > 1 ? "s" : ""}</Box>}
          {fails === 0 && warns === 0 && <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>All checks pass</Box>}
        </TableCell>
        <TableCell sx={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{row.gas_wallet_id ? (row.gas_wallet_id === "XRP_MASTER" ? "XRP master" : `${row.gas_wallet_id} fee wallet`) : "—"}</TableCell>
        <TableCell sx={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{row.family === "tag" ? "master + tags" : `${row.pool.available + row.pool.pre_reserved} ready`}</TableCell>
        <TableCell sx={{ fontSize: 12.5, whiteSpace: "nowrap" }} data-testid={`chain-row-${row.currency}-settlements`}>
          {row.settlements.count_120d > 0 ? `${row.settlements.count_120d} · last ${formatDate(row.settlements.last_at)}` : <Box component="span" sx={{ color: "warning.main" }}>none (unproven)</Box>}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : "none" }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ py: 1.25, pl: 4.5, display: "grid", gap: 0.75 }} data-testid={`chain-row-${row.currency}-checks`}>
              {row.checks.map((c) => (
                <Box key={c.key} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }} data-testid={`chain-check-${row.currency}-${c.key}`} data-status={c.status}>
                  <Box sx={{ pt: "1px" }}><CheckIcon status={c.status} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", wordBreak: "break-all" }}>{c.detail}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

/** All supported currencies with an expandable per-check breakdown. Blocked/degraded rows start expanded. */
const CurrencyTable: React.FC<{ rows: CurrencyReadiness[] }> = ({ rows }) => (
  <Box sx={{ overflowX: "auto" }}>
    <Table size="small" data-testid="chain-readiness-table">
      <TableHead>
        <TableRow>
          <TableCell />
          <TableCell>Currency</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Checks</TableCell>
          <TableCell>Gas source</TableCell>
          <TableCell>Addresses</TableCell>
          <TableCell>Settled · 120d</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => <CurrencyRow key={r.currency} row={r} defaultOpen={r.overall === "blocked"} />)}
      </TableBody>
    </Table>
  </Box>
);

export default CurrencyTable;
