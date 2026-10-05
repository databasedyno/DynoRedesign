import React, { useCallback, useEffect, useState } from "react";
import { Box, Chip, CircularProgress, LinearProgress, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { SmartToyOutlined, RefreshRounded } from "@mui/icons-material";
import { Button } from "@mui/material";
import adminBaseApi from "@/axiosAdmin";
import { useRefetchOnVisible } from "@/hooks/useRefetchOnVisible";
import { SectionCard, formatNumber, formatDateTime } from "../adminUi";

interface Summary { last24h: number; last7d: number; last30d: number; bots: number }
interface BotRow { bot: string; hits: number; last_seen: string | null }
interface PathRow { path: string; hits: number }
interface RecentRow { bot: string; path: string | null; host: string | null; created_at: string }
interface Report { summary: Summary; byBot: BotRow[]; daily: { day: string; hits: number }[]; topPaths: PathRow[]; recent: RecentRow[] }

/** Admin › Overview — AI crawler traffic (ChatGPT, Perplexity, Claude, Common Crawl, Apple…). */
const BotHitPanel: React.FC = () => {
  const [data, setData] = useState<Report | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminBaseApi.get("/admin/bot-analytics");
      setData((res.data?.data as Report) || null);
    } catch {
      setData(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefetchOnVisible(load);

  const maxBot = Math.max(1, ...(data?.byBot || []).map((b) => b.hits));
  const summary = data?.summary;

  return (
    <SectionCard
      title="AI crawlers"
      testid="admin-bot-analytics"
      action={
        <Button size="small" onClick={load} startIcon={<RefreshRounded sx={{ fontSize: 16 }} />} data-testid="admin-bot-analytics-refresh" sx={{ textTransform: "none", fontSize: 12.5 }}>
          Refresh
        </Button>
      }
    >
      {!loaded ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
      ) : (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }} data-testid="admin-bot-analytics-summary">
            <Chip size="small" variant="outlined" label={`24h · ${formatNumber(summary?.last24h ?? 0)}`} sx={{ height: 24, fontSize: 11.5 }} data-testid="admin-bot-analytics-24h" />
            <Chip size="small" variant="outlined" label={`7d · ${formatNumber(summary?.last7d ?? 0)}`} sx={{ height: 24, fontSize: 11.5 }} data-testid="admin-bot-analytics-7d" />
            <Chip size="small" variant="outlined" label={`30d · ${formatNumber(summary?.last30d ?? 0)}`} sx={{ height: 24, fontSize: 11.5 }} data-testid="admin-bot-analytics-30d" />
            <Chip size="small" variant="outlined" color="info" label={`${summary?.bots ?? 0} engines`} sx={{ height: 24, fontSize: 11.5 }} data-testid="admin-bot-analytics-engines" />
          </Box>

          {(data?.byBot?.length ?? 0) === 0 ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2, color: "text.secondary" }} data-testid="admin-bot-analytics-empty">
              <SmartToyOutlined sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: 13.5 }}>No AI-crawler visits recorded yet (last 30 days). GPTBot, PerplexityBot, ClaudeBot, CCBot and others appear here as they crawl the marketing site.</Typography>
            </Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4, mb: 1 }}>By engine · 30 days</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                {data!.byBot.map((b) => (
                  <Box key={b.bot} data-testid={`admin-bot-row-${b.bot}`}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{b.bot}</Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                        {formatNumber(b.hits)}{b.last_seen ? ` · ${formatDateTime(b.last_seen)}` : ""}
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(b.hits / maxBot) * 100} sx={{ height: 7, borderRadius: 4 }} />
                  </Box>
                ))}
              </Box>

              {(data?.topPaths?.length ?? 0) > 0 && (
                <>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4, mb: 1 }}>Most-crawled pages · 30 days</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 2 }} data-testid="admin-bot-analytics-paths">
                    {data!.topPaths.map((p) => (
                      <Box key={p.path} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                        <Tooltip title={p.path} arrow><Typography noWrap sx={{ fontSize: 12.5, flex: 1 }}>{p.path}</Typography></Tooltip>
                        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{formatNumber(p.hits)}</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              {(data?.recent?.length ?? 0) > 0 && (
                <Box sx={{ overflowX: "auto" }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4, mb: 1 }}>Recent hits</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>When</TableCell>
                        <TableCell>Engine</TableCell>
                        <TableCell>Page</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data!.recent.map((r, i) => (
                        <TableRow key={i} hover data-testid="admin-bot-recent-row">
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>{formatDateTime(r.created_at)}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{r.bot}</TableCell>
                          <TableCell sx={{ fontSize: 12, maxWidth: 320 }}>
                            <Tooltip title={`${r.host || ""}${r.path || ""}`} arrow><Typography noWrap sx={{ fontSize: 12 }}>{r.path || "—"}</Typography></Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
};

export default BotHitPanel;
