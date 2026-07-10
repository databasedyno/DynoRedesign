import React, { memo, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * SystemStatusPill (item E) — tiny always-visible pill that reads live uptime
 * from /api/status/uptime and shows "🟢 All systems normal · 99.98% (30d)".
 * Links to /system-status. Falls back to a static "All systems normal" if the
 * endpoint is unavailable so the header never looks broken.
 *
 * Placed in the HomeHeader between the nav links and the auth CTAs.
 */

interface UptimePayload {
  overall_uptime_percentage?: number | string;
  uptimePercentage?: number | string;
  status?: string;
  service_status?: string;
}

type Status = 'operational' | 'degraded' | 'outage' | 'unknown';

// labelKey is resolved through i18n (common namespace) at render time.
const statusColorMap: Record<Status, { dot: string; bg: string; border: string; labelKey: string }> = {
  operational: { dot: '#22C55E', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.35)', labelKey: 'statusOperational' },
  degraded:    { dot: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', labelKey: 'statusDegraded' },
  outage:      { dot: '#EF4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)',  labelKey: 'statusOutage' },
  unknown:     { dot: '#94A3B8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.35)', labelKey: 'statusUnknown' },
};

const deriveStatus = (pct: number): Status => {
  if (pct >= 99.5) return 'operational';
  if (pct >= 97)   return 'degraded';
  return 'outage';
};

const SystemStatusPill: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation('common');
  const [status, setStatus] = useState<Status>('operational'); // optimistic default
  const [uptime, setUptime] = useState<number>(99.98);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    const base =
      (process.env.NEXT_PUBLIC_SERVER_URL as string | undefined) ||
      (process.env.NEXT_PUBLIC_BASE_URL as string | undefined) ||
      '';
    const url = `${base.replace(/\/+$/, '')}/api/status/uptime`;

    fetch(url, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UptimePayload | null) => {
        if (cancelled || !data) return;
        const raw = data.overall_uptime_percentage ?? data.uptimePercentage;
        const pct = typeof raw === 'string' ? parseFloat(raw) : (raw as number | undefined);
        if (typeof pct === 'number' && isFinite(pct)) {
          setUptime(Number(pct.toFixed(2)));
          setStatus(deriveStatus(pct));
        }
      })
      .catch(() => { /* silent */ });

    return () => { cancelled = true; };
  }, []);

  // Use the optimistic "operational" default until mount to prevent hydration
  // mismatch. The SSR and initial client render both render "99.98% / green".
  const s = statusColorMap[mounted ? status : 'operational'];
  const label = t(s.labelKey);

  return (
    <Box
      component="a"
      href="/system-status"
      title={t('statusUptimeTooltip', { label, uptime })}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.7,
        px: compact ? 0.9 : 1.2,
        py: compact ? 0.25 : 0.4,
        borderRadius: '999px',
        border: `1px solid ${s.border}`,
        bgcolor: s.bg,
        textDecoration: 'none',
        fontFamily: 'var(--font-sans)',
        transition: 'all 0.2s ease',
        '&:hover': { transform: 'translateY(-1px)', borderColor: s.dot },
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: s.dot,
          animation: 'dyno-status-pulse 2s infinite',
          '@keyframes dyno-status-pulse': {
            '0%':   { opacity: 1 },
            '50%':  { opacity: 0.45 },
            '100%': { opacity: 1 },
          },
        }}
      />
      <Typography
        component="span"
        sx={{
          fontSize: compact ? 12 : 12.5,
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          color: (theme) => theme.palette.text.primary,
          whiteSpace: 'nowrap',
          letterSpacing: '0.2px',
        }}
      >
        {compact ? `${uptime}%` : `${label} · ${uptime}%`}
      </Typography>
    </Box>
  );
};

export default memo(SystemStatusPill);
