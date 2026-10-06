import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Card,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import adminBaseApi from "@/axiosAdmin";

const RANGES = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "All time", value: 0 },
];

const STUCK_FILTERS = [
  { key: "all", label: "All stuck" },
  { key: "signed_up", label: "Not verified" },
  { key: "verified", label: "No pay method" },
  { key: "has_method", label: "No payment yet" },
];

const STAGE_COPY: Record<string, { label: string; color: string }> = {
  signed_up: { label: "Signed up · not verified", color: "#b45309" },
  verified: { label: "Verified · no method", color: "#1d4ed8" },
  has_method: { label: "Has method · no payment", color: "#7c3aed" },
};

type Funnel = {
  signed_up: number;
  verified: number;
  created_method: number;
  created_link: number;
  created_apikey: number;
  first_payment: number;
  median_signup_to_method_secs: number | null;
  median_method_to_payment_secs: number | null;
};

type StuckRow = {
  user_id: number;
  name: string | null;
  email: string | null;
  email_verified: boolean;
  signed_up_at: string;
  days_since_signup: number;
  links: number;
  apikeys: number;
  tx_any: number;
  source: string | null;
  stage: string;
};

type Checkout = {
  links: { created: number; paid: number; expired_unpaid: number; pending: number };
  sessions: { views: number; address_shown: number; total_views: number };
  payments: { confirmed: number };
};

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

const humanDur = (secs: number | null): string => {
  if (secs == null) return "—";
  const s = Number(secs);
  if (!isFinite(s) || s <= 0) return "—";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round((s / 3600) * 10) / 10} hr`;
  return `${Math.round((s / 86400) * 10) / 10} days`;
};

const FunnelBar = ({
  label,
  value,
  base,
  prev,
  color,
  testid,
}: {
  label: string;
  value: number;
  base: number;
  prev?: number;
  color: string;
  testid: string;
}) => {
  const width = base > 0 ? Math.max((value / base) * 100, value > 0 ? 3 : 0) : 0;
  const drop = prev != null && prev > 0 ? prev - value : 0;
  return (
    <Box sx={{ mb: 2 }} data-testid={testid}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{label}</Typography>
        <Typography sx={{ fontSize: 14 }}>
          <strong>{value.toLocaleString()}</strong>
          <Typography component="span" sx={{ color: "text.secondary", ml: 0.75, fontSize: 13 }}>
            {pct(value, base)}%
          </Typography>
        </Typography>
      </Stack>
      <Box sx={{ height: 12, borderRadius: 6, bgcolor: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${width}%`, bgcolor: color, transition: "width .5s ease" }} />
      </Box>
      {prev != null && drop > 0 && (
        <Typography sx={{ fontSize: 12, color: "#dc2626", mt: 0.4 }}>
          ↓ {drop.toLocaleString()} dropped off here ({pct(drop, prev)}%)
        </Typography>
      )}
    </Box>
  );
};

const StatPill = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Box sx={{ flex: "1 1 120px", p: 1.5, borderRadius: 2, bgcolor: "rgba(0,0,0,0.03)", minWidth: 120 }}>
    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{label}</Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
    {sub && <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{sub}</Typography>}
  </Box>
);

const SectionCard: React.FC<{ title: string; subtitle?: string; testid: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  testid,
  children,
}) => (
  <Card sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }} data-testid={testid}>
    <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{title}</Typography>
    {subtitle && (
      <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2, mt: 0.5 }}>{subtitle}</Typography>
    )}
    <Box sx={{ mt: subtitle ? 0 : 2 }}>{children}</Box>
  </Card>
);

const AdminAnalytics = () => {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  // Stuck merchants
  const [stuckStage, setStuckStage] = useState("all");
  const [stuckRows, setStuckRows] = useState<StuckRow[]>([]);
  const [stuckCounts, setStuckCounts] = useState({ signed_up: 0, verified: 0, has_method: 0, total_stuck: 0 });
  const [stuckOffset, setStuckOffset] = useState(0);
  const [stuckLoading, setStuckLoading] = useState(false);
  const [stuckDone, setStuckDone] = useState(false);
  const LIMIT = 25;

  const loadTop = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        adminBaseApi.get("admin/analytics/activation-funnel", { params: { days } }),
        adminBaseApi.get("admin/analytics/checkout-funnel", { params: { days } }),
      ]);
      setFunnel(a.data?.data?.funnel || null);
      setCheckout(c.data?.data || null);
    } catch {
      setFunnel(null);
      setCheckout(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadStuck = useCallback(
    async (reset: boolean) => {
      setStuckLoading(true);
      const offset = reset ? 0 : stuckOffset;
      try {
        const r = await adminBaseApi.get("admin/analytics/stuck-merchants", {
          params: { days, stage: stuckStage, limit: LIMIT, offset },
        });
        const data = r.data?.data || {};
        const rows: StuckRow[] = data.rows || [];
        setStuckCounts(data.counts || { signed_up: 0, verified: 0, has_method: 0, total_stuck: 0 });
        setStuckRows((prev) => (reset ? rows : [...prev, ...rows]));
        setStuckOffset(offset + rows.length);
        setStuckDone(rows.length < LIMIT);
      } catch {
        if (reset) setStuckRows([]);
        setStuckDone(true);
      } finally {
        setStuckLoading(false);
      }
    },
    [days, stuckStage, stuckOffset]
  );

  useEffect(() => {
    loadTop();
  }, [loadTop]);

  useEffect(() => {
    loadStuck(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, stuckStage]);

  return (
    <Box data-testid="admin-analytics-page">
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Typography sx={{ color: "text.secondary", fontSize: 14, maxWidth: 620 }}>
          Where merchants and buyers drop off — from signup to first payment, and from opening a checkout to paying.
        </Typography>
        <Select
          size="small"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          data-testid="analytics-range-select"
          sx={{ minWidth: 150, borderRadius: 2 }}
        >
          {RANGES.map((r) => (
            <MenuItem key={r.value} value={r.value} data-testid={`range-opt-${r.value}`}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress data-testid="analytics-loading" />
        </Box>
      ) : (
        <>
          {/* ── Merchant activation funnel ── */}
          <SectionCard
            title="Merchant activation funnel"
            subtitle="How many signed-up merchants reach each milestone. A payment method = a payment link OR an API key."
            testid="activation-funnel-card"
          >
            {funnel && funnel.signed_up > 0 ? (
              <>
                <FunnelBar label="Signed up" value={funnel.signed_up} base={funnel.signed_up} color="#0f766e" testid="funnel-stage-signed_up" />
                <FunnelBar label="Verified email" value={funnel.verified} base={funnel.signed_up} prev={funnel.signed_up} color="#0e7490" testid="funnel-stage-verified" />
                <FunnelBar label="Created a payment method" value={funnel.created_method} base={funnel.signed_up} prev={funnel.verified} color="#4f46e5" testid="funnel-stage-method" />
                <FunnelBar label="Received first payment" value={funnel.first_payment} base={funnel.signed_up} prev={funnel.created_method} color="#16a34a" testid="funnel-stage-payment" />
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                  <StatPill label="Overall activation" value={`${pct(funnel.first_payment, funnel.signed_up)}%`} sub="signup → first payment" />
                  <StatPill label="Created pay link" value={funnel.created_link.toLocaleString()} />
                  <StatPill label="Generated API key" value={funnel.created_apikey.toLocaleString()} />
                  <StatPill label="Median signup → method" value={humanDur(funnel.median_signup_to_method_secs)} />
                  <StatPill label="Median method → payment" value={humanDur(funnel.median_method_to_payment_secs)} />
                </Stack>
              </>
            ) : (
              <Typography sx={{ color: "text.secondary" }} data-testid="activation-empty">
                No merchants signed up in this period.
              </Typography>
            )}
          </SectionCard>

          {/* ── Stuck merchants drill-down ── */}
          <SectionCard
            title="Stuck merchants"
            subtitle="Merchants who have NOT received a first payment — grouped by how far they got, so you can see where (and likely why) they stalled."
            testid="stuck-merchants-card"
          >
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {STUCK_FILTERS.map((f) => {
                const count =
                  f.key === "all"
                    ? stuckCounts.total_stuck
                    : (stuckCounts as Record<string, number>)[f.key] ?? 0;
                return (
                  <Chip
                    key={f.key}
                    label={`${f.label} (${count})`}
                    onClick={() => setStuckStage(f.key)}
                    color={stuckStage === f.key ? "primary" : "default"}
                    variant={stuckStage === f.key ? "filled" : "outlined"}
                    data-testid={`stuck-stage-${f.key}`}
                    sx={{ fontWeight: 600 }}
                  />
                );
              })}
            </Stack>

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" data-testid="stuck-merchants-table">
                <TableHead>
                  <TableRow>
                    <TableCell>Merchant</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell align="right">Days since signup</TableCell>
                    <TableCell align="center">Verified</TableCell>
                    <TableCell align="right">Links</TableCell>
                    <TableCell align="right">API keys</TableCell>
                    <TableCell align="right">Attempts</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stuckRows.map((r) => {
                    const sc = STAGE_COPY[r.stage];
                    return (
                      <TableRow key={r.user_id} data-testid={`stuck-row-${r.user_id}`}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{r.name || "—"}</Typography>
                          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{r.email || "—"}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={sc?.label || r.stage}
                            sx={{ bgcolor: `${sc?.color || "#666"}22`, color: sc?.color || "#666", fontWeight: 600, fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell align="right">{r.days_since_signup}</TableCell>
                        <TableCell align="center">{r.email_verified ? "✓" : "—"}</TableCell>
                        <TableCell align="right">{r.links}</TableCell>
                        <TableCell align="right">{r.apikeys}</TableCell>
                        <TableCell align="right">{r.tx_any}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 12, textTransform: "capitalize" }}>{r.source || "—"}</Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {stuckRows.length === 0 && !stuckLoading && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography sx={{ color: "text.secondary", py: 2, textAlign: "center" }} data-testid="stuck-empty">
                          No merchants in this group 🎉
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>

            <Box sx={{ textAlign: "center", mt: 2 }}>
              {stuckLoading ? (
                <CircularProgress size={22} />
              ) : (
                !stuckDone &&
                stuckRows.length > 0 && (
                  <Chip label="Load more" onClick={() => loadStuck(false)} data-testid="stuck-load-more" variant="outlined" sx={{ fontWeight: 600 }} />
                )
              )}
            </Box>
          </SectionCard>

          {/* ── Buyer / checkout funnel ── */}
          <SectionCard
            title="Buyer checkout funnel"
            subtitle="Why buyers don't complete a payment — payment-link outcomes (from live data) plus checkout opens vs. paid (new tracking, builds up from now)."
            testid="checkout-funnel-card"
          >
            {checkout ? (
              <>
                <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>Payment links</Typography>
                <FunnelBar label="Links created" value={checkout.links.created} base={checkout.links.created} color="#0f766e" testid="link-stage-created" />
                <FunnelBar label="Links paid" value={checkout.links.paid} base={checkout.links.created} prev={checkout.links.created} color="#16a34a" testid="link-stage-paid" />
                <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1 }}>
                  <StatPill label="Paid rate" value={`${pct(checkout.links.paid, checkout.links.created)}%`} />
                  <StatPill label="Expired unpaid" value={checkout.links.expired_unpaid.toLocaleString()} />
                  <StatPill label="Still awaiting payment" value={checkout.links.pending.toLocaleString()} />
                </Stack>

                <Divider sx={{ my: 2.5 }} />

                <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>
                  Checkout sessions{" "}
                  <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
                    (since tracking enabled)
                  </Typography>
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1.5}>
                  <StatPill label="Checkouts opened" value={checkout.sessions.views.toLocaleString()} sub={`${checkout.sessions.total_views.toLocaleString()} total views`} />
                  <StatPill label="Reached payment screen" value={checkout.sessions.address_shown.toLocaleString()} sub="partial — returning buyers" />
                  <StatPill label="Confirmed payments" value={checkout.payments.confirmed.toLocaleString()} sub="authoritative" />
                  <StatPill
                    label="Opened but unpaid"
                    value={Math.max(checkout.sessions.views - checkout.payments.confirmed, 0).toLocaleString()}
                    sub={`${pct(checkout.payments.confirmed, checkout.sessions.views)}% converted`}
                  />
                </Stack>
              </>
            ) : (
              <Typography sx={{ color: "text.secondary" }} data-testid="checkout-empty">
                No checkout data in this period.
              </Typography>
            )}
          </SectionCard>
        </>
      )}
    </Box>
  );
};

export default AdminAnalytics;
