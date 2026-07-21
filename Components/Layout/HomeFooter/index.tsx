import Logo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import Facebook from "@/assets/Icons/home/Facebook.svg";
import Instagram from "@/assets/Icons/home/instagram.svg";
import LinkedIn from "@/assets/Icons/home/LinkeIn.svg";
import X from "@/assets/Icons/home/X.svg";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
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

const TRUST = ["Non-custodial", "15+ chains", "SOC 2 track", "GDPR / AML aligned", "No chargebacks"] as const;

const HomeFooter: FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");

  // Column model — keeps i18n keys where they already exist, plain labels for
  // the SEO industry pages (kept in sync with /app/data/seo-pages/verticals).
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
        ],
      },
      {
        heading: "Company",
        links: [
          { label: t("blog"), link: "/blog" },
          { label: t("footerSupport"), link: "/help-support" },
          { label: t("footerTerms"), link: "/terms-conditions" },
          { label: t("footerPrivacy"), link: "/privacy-policy" },
        ],
      },
    ],
    [t],
  );

  const socialItems = useMemo(
    () =>
      SOCIALS.map((item) => (
        <Link key={item.label} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
          <SocialItem>
            <Image src={item.icon} alt={item.label} width={18} height={18} className="themed-icon" />
          </SocialItem>
        </Link>
      )),
    [],
  );

  const linkSx = {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    fontFamily: "var(--font-sans)",
    textDecoration: "none",
    width: "fit-content",
    transition: "color 0.18s ease, transform 0.18s ease",
    "&:hover": { color: "#A5B4FC", transform: "translateX(2px)" },
  } as const;

  const headingSx = {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-tech), var(--font-sans)",
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
              <Image src={Logo} alt="Dynopay logo" width={128} height={43} priority />
            </LogoWrapper>
            <Typography
              sx={{
                mt: 2.5,
                color: "rgba(255,255,255,0.58)",
                fontSize: 14.5,
                lineHeight: 1.6,
                fontFamily: "var(--font-sans)",
                maxWidth: 320,
              }}
            >
              {t("footerDescription1")} {t("footerDescription2")}
            </Typography>
            <SocialsWrapper sx={{ mt: 3.5 }}>{socialItems}</SocialsWrapper>
          </Box>

          {/* Link columns */}
          {columns.map((col) => (
            <Box key={col.heading} component="nav" aria-label={col.heading}>
              <Typography component="h3" sx={headingSx}>
                {col.heading}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {col.links.map((l) => (
                  <Link key={l.link} href={l.link} passHref legacyBehavior>
                    <Box component="a" sx={linkSx}>
                      {l.label}
                    </Box>
                  </Link>
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
            pt: { xs: 4, md: 4 },
            borderTop: "1px solid rgba(255,255,255,0.08)",
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
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              <Typography sx={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: "var(--font-sans)", letterSpacing: "0.02em" }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ── Bottom bar ────────────────────────────────────────────── */}
        <BottomSection sx={{ mt: { xs: 4, md: 5 } }}>
          <CopyrightText>{t("footerCopyright", { year: new Date().getFullYear() })}</CopyrightText>
          <Box
            component={Link}
            href="/system-status"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              transition: "color 0.18s ease",
              "&:hover": { color: "rgba(255,255,255,0.9)" },
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
            All systems operational
          </Box>
        </BottomSection>
      </FooterContainer>
    </FooterWrapper>
  );
};

export default memo(HomeFooter);
