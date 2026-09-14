import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Avatar, Box, Button, Container, IconButton, Stack, Typography, useTheme } from "@mui/material";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { useTranslation } from "react-i18next";
import useSavedMerchants from "@/hooks/useSavedMerchants";
import { BRAND_ACCENT } from "@/constants/theme";

// Device-local list of merchants the buyer chose to keep after paying.
const SavedMerchantsPage = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation("landing");
  const { items, hydrated, remove } = useSavedMerchants();
  const border = theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)";
  const fmtDate = (ts: number) => {
    try { return new Intl.DateTimeFormat(i18n.language || "en", { dateStyle: "medium" }).format(new Date(ts)); } catch { return ""; }
  };

  return (
    <>
      <Head>
        <title>{`${t("saved.pageTitle", { defaultValue: "Saved merchants" })} · Dynopay`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Container maxWidth="md" sx={{ pt: { xs: "96px", md: "128px" }, pb: { xs: 6, md: 10 }, minHeight: "70vh" }} data-testid="saved-page">
        <Typography component="h1" sx={{ fontFamily: "var(--font-hero), var(--font-sans)", fontWeight: 800, fontSize: { xs: "1.75rem", md: "2.25rem" }, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {t("saved.title", { defaultValue: "Your saved merchants" })}
        </Typography>
        <Typography sx={{ mt: 1, color: "text.secondary", fontSize: { xs: 14, md: 15 }, maxWidth: 560 }} data-testid="saved-subtitle">
          {t("saved.subtitle", { defaultValue: "Merchants you saved after paying. Stored on this device only — no account needed." })}
        </Typography>

        {hydrated && items.length === 0 && (
          <Stack spacing={2} alignItems="center" sx={{ py: 8, textAlign: "center" }} data-testid="saved-empty-state">
            <Box sx={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: "action.hover", color: "text.secondary" }}>
              <FavoriteBorderRounded sx={{ fontSize: 34 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{t("saved.emptyTitle", { defaultValue: "Nothing saved yet" })}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 14, maxWidth: 420 }}>
              {t("saved.emptyBody", { defaultValue: "After you pay a merchant with Dynopay, tap “Save for next time” on the receipt screen and they'll show up here." })}
            </Typography>
            <Button component={Link} href="/" variant="contained" disableElevation endIcon={<ArrowForwardRounded />} data-testid="saved-empty-home-btn"
              sx={{ textTransform: "none", borderRadius: 999, px: 3, py: 1.1, fontWeight: 700, background: BRAND_ACCENT, "&:hover": { background: "#4338CA" } }}>
              {t("saved.browse", { defaultValue: "Back to home" })}
            </Button>
          </Stack>
        )}

        {items.length > 0 && (
          <Box sx={{ mt: 4, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }} data-testid="saved-list">
            {items.map((m) => (
              <Box key={m.handle} data-testid={`saved-merchant-${m.handle}`}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, borderRadius: "16px", border: `1px solid ${border}`, bgcolor: "background.paper", minWidth: 0 }}>
                <Avatar src={m.avatar || undefined} alt="" sx={{ width: 48, height: 48, bgcolor: BRAND_ACCENT, fontWeight: 800 }}>
                  {(m.name || m.handle).slice(0, 1).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="saved-merchant-name">{m.name}</Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: 12.5, fontFamily: "var(--font-tech), monospace", overflowWrap: "anywhere" }} data-testid="saved-merchant-meta">
                    @{m.handle} · {t("saved.savedOn", { defaultValue: "Saved {{date}}", date: fmtDate(m.savedAt) })}
                  </Typography>
                  <Button component={Link} href={`/${m.handle}`} size="small" variant="outlined" data-testid="saved-merchant-visit"
                    sx={{ mt: 1, textTransform: "none", borderRadius: 999, fontWeight: 700, fontSize: 12.5, px: 1.75, borderColor: border, color: "text.primary", "&:hover": { borderColor: BRAND_ACCENT } }}>
                    {t("saved.visit", { defaultValue: "Visit page" })}
                  </Button>
                </Box>
                <IconButton size="small" onClick={() => remove(m.handle)} aria-label={t("saved.remove", { defaultValue: "Remove" })} data-testid="saved-merchant-remove" sx={{ alignSelf: "flex-start", color: "text.secondary" }}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </>
  );
};

(SavedMerchantsPage as unknown as { layout: string }).layout = "home";
export default SavedMerchantsPage;
