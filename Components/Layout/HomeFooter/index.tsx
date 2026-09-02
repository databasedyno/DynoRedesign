// Coinbase-style marketing footer — theme-aware to match the new header,
// with the same globe language control (opens upward here). Link/route map is
// unchanged from the previous footer; only the styling + language globe are new.
import BlackLogo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import Facebook from "@/assets/Icons/home/Facebook.svg";
import Instagram from "@/assets/Icons/home/instagram.svg";
import LinkedIn from "@/assets/Icons/home/LinkeIn.svg";
import X from "@/assets/Icons/home/X.svg";
import { Box, Typography, useTheme } from "@mui/material";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import HeaderLangMenu from "../HomeHeader/HeaderLangMenu";
import { BRAND_ACCENT } from "@/constants/theme";
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

// Social media links can be hidden platform-wide via env.
// Set NEXT_PUBLIC_SHOW_SOCIAL_LINKS=false to hide them. Default (unset) = shown.
const SHOW_SOCIAL_LINKS = process.env.NEXT_PUBLIC_SHOW_SOCIAL_LINKS !== "false";

const TRUST = ["Non-custodial", "9 blockchains", "Encrypted", "GDPR / AML aligned", "No chargebacks"] as const;

const HomeFooter: FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";

  // Theme mode is SSR'd from the cookie, so `dark` is hydration-safe.
  const logoSrc = dark ? WhiteLogo : BlackLogo;

  const linkColor = dark ? "rgba(255,255,255,0.66)" : "#3F3F46";
  const linkHover = dark ? "#A5B4FC" : BRAND_ACCENT;
  const headingColor = dark ? "rgba(255,255,255,0.5)" : "#8A8A94";
  const descColor = dark ? "rgba(255,255,255,0.58)" : "#52525B";
  const trustBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)";
  const trustBg = dark ? "rgba(255,255,255,0.03)" : "rgba(10,10,10,0.02)";
  const trustText = dark ? "rgba(255,255,255,0.78)" : "#3F3F46";
  const divider = dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)";

  // Column model — keeps existing i18n keys + the SEO industry pages.
  const columns: readonly FooterColumn[] = useMemo(
    () => [
      {
        heading: "Product",
        links: [
          { label: t("features"), link: "/#features" },
          { label: t("headerFees"), link: "/fees" },
          { label: t("documentation"), link: "/documentation" },
          { label: t("footerApiStatus"), link: "/system-status" },
        ],
      },
      {
        heading: "Solutions",
        links: [
          { label: "E-commerce", link: "/for/ecommerce" },
          { label: "SaaS", link: "/for/saas" },
          { label: "Gaming", link: "/for/gaming" },
          { label: "Freelancers", link: "/for/freelancers" },
          { label: "Remittance", link: "/for/remittance" },
          { label: "Digital Downloads", link: "/for/digital-downloads" },
          { label: "Hosting & Domains", link: "/for/hosting" },
          { label: "VPN & Privacy", link: "/for/vpn" },
          { label: "Marketplaces", link: "/for/marketplaces" },
          { label: "Agencies & Consultants", link: "/for/agencies" },
          { label: "Nonprofits", link: "/for/nonprofits" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: t("blog"), link: "/blog" },
          { label: t("referralProgram"), link: "/referral-program" },
          { label: t("footerSupport"), link: "/help-support" },
          { label: t("footerTerms"), link: "/terms-conditions" },
          { label: t("footerPrivacy"), link: "/privacy-policy" },
        ],
      },
    ],
    [t],
  );

  const linkSx = {
    color: linkColor,
    fontSize: 14,
    fontFamily: "var(--font-body)",
    textDecoration: "none",
    width: "fit-content",
    transition: "color 0.18s ease, transform 0.18s ease",
    "&:hover": { color: linkHover, transform: "translateX(2px)" },
  } as const;

  const headingSx = {
    color: headingColor,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-tech), var(--font-body)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    mb: 2.25,
  } as const;

  return (
    <FooterWrapper>
      <FooterContainer>
        {/* ── Top: brand + link columns ─────────────────────────────── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1.7fr 1fr 1fr 1fr" },
            gap: { xs: 5, md: 6 },
            pb: { xs: 6, md: 8 },
          }}
        >
          {/* Brand */}
          <Box sx={{ maxWidth: 340 }}>
            <LogoWrapper onClick={() => router.push("/")}>
              <Image src={logoSrc} alt="Dynopay logo" width={128} height={43} priority />
            </LogoWrapper>
            <Typography
              sx={{
                mt: 2.5,
                color: descColor,
                fontSize: 14.5,
                lineHeight: 1.6,
                fontFamily: "var(--font-body)",
                maxWidth: 320,
              }}
            >
              {t("footerDescription1")} {t("footerDescription2")}
            </Typography>
            {SHOW_SOCIAL_LINKS && (
              <SocialsWrapper sx={{ mt: 3.5 }}>
                {SOCIALS.map((item) => (
                  <Link key={item.label} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                    <SocialItem>
                      <Image src={item.icon} alt={item.label} width={18} height={18} />
                    </SocialItem>
                  </Link>
                ))}
              </SocialsWrapper>
            )}
          </Box>

          {/* Link columns */}
          {columns.map((col) => (
            <Box key={col.heading} component="nav" aria-label={col.heading}>
              <Typography component="h3" sx={headingSx}>
                {col.heading}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {col.links.map((l) => (
                  <Box key={l.link} component={Link} href={l.link} sx={linkSx}>
                    {l.label}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* ── Trust / compliance signals ────────────────────────────── */}
        <Box
          data-testid="footer-trust-row"
          aria-label="Trust and compliance"
          sx={{
            pt: 4,
            borderTop: `1px solid ${divider}`,
            display: "flex",
            flexWrap: "wrap",
            gap: { xs: 1, md: 1.25 },
            alignItems: "center",
          }}
        >
          {TRUST.map((label) => (
            <Box
              key={label}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.6,
                borderRadius: "999px",
                border: `1px solid ${trustBorder}`,
                background: trustBg,
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              <Typography sx={{ color: trustText, fontSize: 12, fontFamily: "var(--font-body)", letterSpacing: "0.02em" }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ── Bottom bar ────────────────────────────────────────────── */}
        <BottomSection sx={{ mt: { xs: 4, md: 5 } }}>
          <CopyrightText>{t("footerCopyright", { year: new Date().getFullYear() })}</CopyrightText>

          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, md: 2.5 }, flexWrap: "wrap" }}>
            <HeaderLangMenu placement="top" align="right" idPrefix="footer" />

            <Box
              component={Link}
              href="/system-status"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                textDecoration: "none",
                color: dark ? "rgba(255,255,255,0.6)" : "#52525B",
                fontSize: 13,
                fontFamily: "var(--font-body)",
                transition: "color 0.18s ease",
                "&:hover": { color: dark ? "rgba(255,255,255,0.9)" : "#0A0A0A" },
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#22C55E",
                  boxShadow: "0 0 0 3px rgba(34,197,94,0.22)",
                }}
              />
              {t("v3.footer.systemsOperational")}
            </Box>
          </Box>
        </BottomSection>
      </FooterContainer>
    </FooterWrapper>
  );
};

export default memo(HomeFooter);
