// v8 marketing footer — always-dark near-black panel (both themes) with a gold
// hairline, faded wordmark and the globe language control (opens upward).
// Link/route map is unchanged from the previous footer.
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import Facebook from "@/assets/Icons/home/Facebook.svg";
import Instagram from "@/assets/Icons/home/instagram.svg";
import LinkedIn from "@/assets/Icons/home/LinkeIn.svg";
import X from "@/assets/Icons/home/X.svg";
import { Box, Typography } from "@mui/material";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { getRuntimeFlags } from "@/helpers/runtimeFlags";
import { useRouter } from "next/router";
import { FC, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL } from "@/Components/Page/Home/v8/kit";
import HeaderLangMenu from "../HomeHeader/HeaderLangMenu";
import {
  BottomSection,
  CopyrightText,
  FooterContainer,
  FooterWrapper,
  LogoWrapper,
  SocialItem,
  SocialsWrapper,
} from "./styled";

interface SocialItemType {
  readonly label: string;
  readonly icon: StaticImageData;
  readonly link: string;
}

interface FooterLink {
  readonly label: string;
  readonly link: string;
}

interface FooterColumn {
  readonly heading: string;
  readonly links: readonly FooterLink[];
}

const SOCIALS: readonly SocialItemType[] = [
  { label: "X", icon: X, link: "https://x.com/Dynopaycom" },
  { label: "Instagram", icon: Instagram, link: "https://www.instagram.com/dynopay" },
  { label: "LinkedIn", icon: LinkedIn, link: "https://www.linkedin.com/company/dynopay/" },
  { label: "Facebook", icon: Facebook, link: "https://www.facebook.com/dynopay" },
] as const;

// Social links can be hidden platform-wide via env (NEXT_PUBLIC_SHOW_SOCIAL_LINKS=false).
// Read at render time from the server-provided runtime flags — NEVER from process.env directly:
// a build-time/runtime disagreement here hydration-mismatched the whole landing page (2026-09).

const TRUST = ["nonCustodial", "chains", "encrypted", "gdpr", "noChargebacks"] as const;

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const StatusPill: FC<{ label: string }> = ({ label }) => (
  <Box
    component={Link}
    href="/system-status"
    data-testid="footer-status-link" data-touch-44=""
    sx={{
      display: "inline-flex",
      alignItems: "center",
      gap: 1,
      px: 1.5,
      py: 0.75,
      borderRadius: "999px",
      border: `1px solid ${PANEL.line}`,
      background: PANEL.surface,
      color: PANEL.ink2,
      textDecoration: "none",
      fontFamily: FONT_BODY,
      fontSize: 13,
      transition: "color 160ms ease, border-color 160ms ease",
      "&:hover": { color: PANEL.ink, borderColor: PANEL.lineStrong },
    }}
  >
    <Box
      sx={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: PANEL.green,
        boxShadow: "0 0 0 3px rgba(52,211,153,0.2)",
        animation: "dp-foot-pulse 2.4s ease-in-out infinite",
        "@keyframes dp-foot-pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    />
    {label}
  </Box>
);

const FooterCol: FC<{ col: FooterColumn }> = ({ col }) => (
  <Box component="nav" aria-label={col.heading}>
    <Typography component="h2" sx={{ color: PANEL.ink3, fontSize: 11.5, fontWeight: 600, fontFamily: FONT_MONO, letterSpacing: "0.16em", textTransform: "uppercase", mb: 2.5 }}>
      {col.heading}
    </Typography>
    {/* Links are ≥ 24px boxes with a mouse / 44px on touch (UX audit S18); the gap shrinks to
        match so the column keeps its rhythm on desktop. */}
    <Box sx={{ display: "flex", flexDirection: "column", gap: "9px", "@media (pointer: coarse)": { gap: 0 } }}>
      {col.links.map((l) => (
        <Box
          key={`${l.label}-${l.link}`}
          component={Link}
          href={l.link}
          data-testid={`footer-link-${slugOf(l.link)}-${slugOf(l.label)}`}
          sx={{
            color: PANEL.ink2,
            fontSize: 14,
            fontFamily: FONT_BODY,
            textDecoration: "none",
            width: "fit-content",
            display: "inline-flex",
            alignItems: "center",
            minHeight: 24,
            "@media (pointer: coarse)": { minHeight: 44 },
            transition: "color 160ms ease, transform 160ms ease",
            "&:hover": { color: PANEL.gold, transform: "translateX(2px)" },
          }}
        >
          {l.label}
        </Box>
      ))}
    </Box>
  </Box>
);

const Wordmark: FC = () => (
  <Box
    aria-hidden
    data-testid="footer-wordmark"
    sx={{
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: "clamp(64px, 16vw, 228px)",
      lineHeight: 0.9,
      letterSpacing: "-0.055em",
      textAlign: "center",
      whiteSpace: "nowrap",
      userSelect: "none",
      pointerEvents: "none",
      background: "linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.012) 88%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
      mt: { xs: 4, md: 5 },
      mb: { xs: 3, md: 4 },
    }}
  >
    dynopay
  </Box>
);

const HomeFooter: FC = () => {
  const showSocialLinks = getRuntimeFlags().showSocialLinks;
  const router = useRouter();
  const { t } = useTranslation("landing");

  // Column model (Products · Solutions · Developers · Company · Legal). Every href is a real public route.
  const columns: readonly FooterColumn[] = useMemo(
    () => [
      {
        heading: t("v6.footer.products"),
        links: [
          { label: t("v6.footer.links"), link: "/products" },
          { label: t("v6.footer.checkout"), link: "/pay/demo" },
          { label: t("v6.footer.storefront"), link: "/for/creators" },
          { label: t("v6.footer.donations"), link: "/pay/donation-demo" },
          { label: t("v6.footer.invoices"), link: "/products" },
          { label: t("headerFees"), link: "/fees" },
        ],
      },
      {
        heading: t("footerNav.solutions"),
        links: [
          { label: t("footerNav.verticals.ecommerce"), link: "/for/ecommerce" },
          { label: t("footerNav.verticals.saas"), link: "/for/saas" },
          { label: t("footerNav.verticals.freelancers"), link: "/for/freelancers" },
          { label: t("footerNav.verticals.digitalDownloads"), link: "/for/digital-downloads" },
          { label: t("footerNav.verticals.marketplaces"), link: "/for/marketplaces" },
          { label: t("footerNav.verticals.nonprofits"), link: "/for/nonprofits" },
          { label: t("footerNav.verticals.gaming"), link: "/for/gaming" },
          { label: t("footerNav.verticals.hosting"), link: "/for/hosting" },
          { label: t("footerNav.verticals.agencies"), link: "/for/agencies" },
        ],
      },
      {
        heading: t("v6.footer.developers"),
        links: [
          { label: t("documentation"), link: "/documentation" },
          { label: t("v6.footer.api"), link: "/documentation#authentication" },
          { label: t("v6.footer.webhooks"), link: "/documentation#webhooks" },
          { label: t("v6.footer.embeds"), link: "/documentation#buy-button" },
          { label: t("footerApiStatus"), link: "/system-status" },
        ],
      },
      {
        heading: t("footerNav.company"),
        links: [
          { label: t("v6.footer.about"), link: "/about" },
          { label: t("blog"), link: "/blog" },
          { label: t("v6.footer.press"), link: "/press" },
          { label: t("v6.footer.howto"), link: "/how-to" },
          { label: t("referralProgram"), link: "/referral-program" },
          { label: t("footerSupport"), link: "/help-support" },
        ],
      },
      {
        heading: t("v6.footer.legal"),
        links: [
          { label: t("footerTerms"), link: "/terms-conditions" },
          { label: t("footerPrivacy"), link: "/privacy-policy" },
          { label: t("v6.footer.aml"), link: "/aml-policy" },
          { label: t("v6.footer.trustCentre", { defaultValue: "Trust Centre" }), link: "/trust" },
        ],
      },
    ],
    [t],
  );

  return (
    <FooterWrapper data-testid="site-footer">
      <Box aria-hidden sx={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,209,0,0.5), transparent)" }} />
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(45% 55% at 88% 0%, rgba(255,209,0,0.09), transparent 62%)", pointerEvents: "none" }} />
      <FooterContainer>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1.6fr repeat(5, 1fr)" }, gap: { xs: 4.5, md: 4 } }}>
          <Box sx={{ maxWidth: 340, gridColumn: { xs: "1 / -1", md: "auto" } }}>
            <LogoWrapper onClick={() => router.push("/")} data-testid="footer-logo">
              <Image src={WhiteLogo} alt={t("footerNav.logoAlt")} width={128} height={43} priority />
            </LogoWrapper>
            <Typography sx={{ mt: 2.5, color: PANEL.ink2, fontSize: 14.5, lineHeight: 1.65, fontFamily: FONT_BODY, maxWidth: 320 }}>
              {t("footerDescription1")} {t("footerDescription2")}
            </Typography>
            <Box sx={{ mt: 3 }}>
              <StatusPill label={t("v3.footer.systemsOperational")} />
            </Box>
            {showSocialLinks && (
              <SocialsWrapper sx={{ mt: 3 }}>
                {SOCIALS.map((item) => (
                  <Link key={item.label} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={item.label} data-testid={`footer-social-${slugOf(item.label)}`} data-touch-44="square" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <SocialItem>
                      <Image src={item.icon} alt={item.label} width={18} height={18} />
                    </SocialItem>
                  </Link>
                ))}
              </SocialsWrapper>
            )}
          </Box>
          {columns.map((col) => (
            <FooterCol key={col.heading} col={col} />
          ))}
        </Box>

        <Wordmark />

        <Box data-testid="footer-trust-row" aria-label={t("footerNav.trustAria")} sx={{ pb: 4, display: "flex", flexWrap: "wrap", gap: { xs: 1, md: 1.25 }, alignItems: "center" }}>
          {TRUST.map((label) => (
            <Box key={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, px: 1.5, py: 0.6, borderRadius: "999px", border: `1px solid ${PANEL.line}`, background: PANEL.surface }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.gold }} />
              <Typography sx={{ color: PANEL.ink2, fontSize: 12, fontFamily: FONT_BODY, letterSpacing: "0.02em" }}>
                {t(`footerNav.trust.${label}`)}
              </Typography>
            </Box>
          ))}
        </Box>

        <BottomSection>
          <CopyrightText data-testid="footer-copyright">{t("footerCopyright", { year: new Date().getFullYear() })}</CopyrightText>
          <Box
            sx={{
              "& [data-testid='footer-language-globe']": { color: PANEL.ink2, borderColor: PANEL.line, background: PANEL.surface },
              "& [data-testid='footer-language-globe']:hover": { color: PANEL.ink, borderColor: PANEL.gold, background: PANEL.surfaceStrong },
            }}
          >
            <HeaderLangMenu placement="top" align="right" idPrefix="footer" />
          </Box>
        </BottomSection>
      </FooterContainer>
    </FooterWrapper>
  );
};

export default memo(HomeFooter);
