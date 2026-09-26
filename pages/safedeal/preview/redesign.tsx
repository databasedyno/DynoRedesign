import React, { useState } from "react";
import Head from "next/head";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import type { NextPageWithLayout } from "@/pages/_app";
import { useSdHref } from "@/Components/SafeDeal/sdRouting";
import { SafeDealLogo } from "@/Components/SafeDeal/SafeDealShell";
import { SD_GOLD, SD_GOLD_DARK, SD_INK, SD_BORDER, SD_TEXT_MUTED, goldAlpha } from "@/Components/SafeDeal/sdTheme";

/**
 * PRIVATE compare page for the SafeDeal landing redesign round.
 * Shows the three full-page mockups (A/B/C) inside live iframes so each can be
 * scrolled top-to-bottom and viewed at desktop OR true mobile (390px) widths.
 * noindex + unlinked — not part of navigation, not in sitemaps.
 */
const TABS: Array<{ key: "a" | "b" | "c"; code: string; name: string }> = [
  { key: "a", code: "A", name: "The Vault" },
  { key: "b", code: "B", name: "The Handshake" },
  { key: "c", code: "C", name: "The Flow" },
];

const PHONE_W = 390;

/** A single mockup rendered inside a 390px "phone" so MUI mobile breakpoints truly apply. */
function PhoneFrame({ code, name, url, height }: { code: string; name: string; url: string; height: string }) {
  return (
    <Stack spacing={1.2} alignItems="center" sx={{ flexShrink: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: SD_GOLD, color: SD_INK, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13 }}>{code}</Box>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{name}</Typography>
        <Button size="small" href={url} target="_blank" sx={{ minWidth: 0, color: SD_GOLD, textTransform: "none", fontWeight: 700 }} endIcon={<Icon icon="mdi:open-in-new" width={15} />}>Open</Button>
      </Stack>
      <Box sx={{ width: PHONE_W, maxWidth: "100%", borderRadius: 5, overflow: "hidden", border: "3px solid #1C1C21", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", backgroundColor: "#fff" }}>
        <iframe data-testid={`sd-redesign-frame-${code.toLowerCase()}`} title={`SafeDeal redesign ${name}`} src={url} loading="lazy" style={{ width: "100%", height, border: 0, display: "block" }} />
      </Box>
    </Stack>
  );
}

const Page: NextPageWithLayout = () => {
  const href = useSdHref();
  const [view, setView] = useState<"a" | "b" | "c" | "all">("a");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const src = (k: string) => href(`/preview/${k}`);

  const seg = (active: boolean) => ({
    textTransform: "none" as const,
    fontWeight: 800,
    borderRadius: 99,
    px: 2,
    py: 0.7,
    fontSize: 13,
    color: active ? SD_INK : "#fff",
    backgroundColor: active ? SD_GOLD : "transparent",
    "&:hover": { backgroundColor: active ? SD_GOLD_DARK : "rgba(255,255,255,0.08)" },
  });

  const frameH = "calc(100vh - 150px)";

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: SD_INK, color: "#fff" }} data-testid="sd-redesign-compare">
      <Head>
        <title>SafeDeal landing redesign · private preview</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Toolbar */}
      <Box sx={{ position: "sticky", top: 0, zIndex: 30, backgroundColor: "rgba(10,10,11,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Container maxWidth={false} sx={{ py: 1.2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1.4} alignItems="center" sx={{ mr: "auto" }}>
            <SafeDealLogo light size={18} />
            <Box sx={{ px: 1.1, py: 0.3, borderRadius: 99, border: `1px solid ${goldAlpha(0.5)}`, fontSize: 11, fontWeight: 800, color: SD_GOLD }}>Redesign preview</Box>
          </Stack>

          {/* A / B / C / All */}
          <Stack direction="row" spacing={0.5} sx={{ p: 0.5, borderRadius: 99, border: "1px solid rgba(255,255,255,0.12)" }}>
            {TABS.map((t) => (
              <Button key={t.key} onClick={() => setView(t.key)} data-testid={`sd-redesign-tab-${t.key}`} sx={seg(view === t.key)}>{t.code} · {t.name}</Button>
            ))}
            <Button onClick={() => setView("all")} data-testid="sd-redesign-tab-all" sx={seg(view === "all")}>Compare all</Button>
          </Stack>

          {/* Device toggle (single view only) */}
          {view !== "all" && (
            <Stack direction="row" spacing={0.5} sx={{ p: 0.5, borderRadius: 99, border: "1px solid rgba(255,255,255,0.12)" }}>
              <Button onClick={() => setDevice("desktop")} data-testid="sd-redesign-device-desktop" startIcon={<Icon icon="mdi:monitor" width={16} />} sx={seg(device === "desktop")}>Desktop</Button>
              <Button onClick={() => setDevice("mobile")} data-testid="sd-redesign-device-mobile" startIcon={<Icon icon="mdi:cellphone" width={16} />} sx={seg(device === "mobile")}>Mobile</Button>
            </Stack>
          )}
        </Container>
      </Box>

      {/* Hint */}
      <Container maxWidth={false} sx={{ pt: 1.5 }}>
        <Typography sx={{ fontSize: 12.5, color: SD_TEXT_MUTED, textAlign: "center" }}>
          Private preview · pick a direction (A / B / C), toggle Desktop / Mobile, or Compare all side-by-side. Mix-and-match feedback (e.g. “A’s hero with B’s steps”) is welcome.
        </Typography>
      </Container>

      {/* Stage */}
      <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
        {view === "all" ? (
          <Box sx={{ overflowX: "auto", pb: 2 }}>
            <Stack direction="row" spacing={3} sx={{ width: "max-content", mx: "auto", px: 1 }}>
              {TABS.map((t) => (<PhoneFrame key={t.key} code={t.code} name={t.name} url={src(t.key)} height={frameH} />))}
            </Stack>
          </Box>
        ) : device === "mobile" ? (
          <Stack alignItems="center">
            <PhoneFrame code={TABS.find((t) => t.key === view)?.code || ""} name={TABS.find((t) => t.key === view)?.name || ""} url={src(view)} height={frameH} />
          </Stack>
        ) : (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 1.2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                {TABS.find((t) => t.key === view)?.code} · {TABS.find((t) => t.key === view)?.name}
              </Typography>
              <Button size="small" href={src(view)} target="_blank" sx={{ minWidth: 0, color: SD_GOLD, textTransform: "none", fontWeight: 700 }} endIcon={<Icon icon="mdi:open-in-new" width={15} />}>Open full page</Button>
            </Stack>
            <Box sx={{ maxWidth: 1440, mx: "auto", borderRadius: 3, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 70px rgba(0,0,0,0.5)", backgroundColor: "#fff" }}>
              <iframe data-testid={`sd-redesign-frame-${view}`} title={`SafeDeal redesign ${view}`} src={src(view)} style={{ width: "100%", height: frameH, border: 0, display: "block" }} />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
Page.layout = "none";
export default Page;
