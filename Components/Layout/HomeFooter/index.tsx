import Logo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import Facebook from "@/assets/Icons/home/Facebook.svg";
import Instagram from "@/assets/Icons/home/instagram.svg";
import LinkedIn from "@/assets/Icons/home/LinkeIn.svg";
import X from "@/assets/Icons/home/X.svg";
import useIsMobile from "@/hooks/useIsMobile";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import {
  BottomSection,
  ContentRow,
  CopyrightText,
  DescriptionText,
  FooterContainer,
  FooterWrapper,
  LogoWrapper,
  Navigation,
  NavigationList,
  SocialItem,
  SocialsWrapper,
  TopSection,
} from "./styled";

interface SocialItemType {
  readonly label: string;
  readonly icon: StaticImageData;
  readonly link: string;
}

interface RouteItemType {
  readonly labelKey: string;
  readonly link: string;
  readonly external?: boolean;
}

interface SEOLinkItem {
  readonly label: string;
  readonly link: string;
  readonly flag?: string;
}

const SOCIALS: readonly SocialItemType[] = [
  { label: "X", icon: X, link: "https://x.com/Dynopaycom" },
  { label: "Instagram", icon: Instagram, link: "https://www.instagram.com/dynopay" },
  { label: "LinkedIn", icon: LinkedIn, link: "https://www.linkedin.com/company/dynopay/" },
  { label: "Facebook", icon: Facebook, link: "https://www.facebook.com/dynopay" },
] as const;

const ROUTES: readonly RouteItemType[] = [
  { labelKey: "documentation", link: "/documentation" },
  { labelKey: "footerTerms", link: "/terms-conditions" },
  { labelKey: "footerPrivacy", link: "/privacy-policy" },
  { labelKey: "footerApiStatus", link: "/system-status" },
  { labelKey: "footerSupport", link: "/help-support" },
] as const;

/**
 * SEO landing pages surfaced in the footer to spread PageRank across every
 * public page. Keep in sync with /app/data/seo-pages/{countries,verticals}/*.json.
 */
const SEO_VERTICALS: readonly SEOLinkItem[] = [
  { label: "E-commerce", link: "/for/ecommerce" },
  { label: "SaaS", link: "/for/saas" },
  { label: "Freelancers", link: "/for/freelancers" },
  { label: "Gaming", link: "/for/gaming" },
  { label: "Remittance", link: "/for/remittance" },
  { label: "Digital Downloads", link: "/for/digital-downloads" },
] as const;

const HomeFooter: FC = () => {
  const router = useRouter();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("landing");

  const routeItems = useMemo(
    () =>
      ROUTES.map((item) =>
        item.external ? (
          <a
            key={item.labelKey}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <Navigation>{t(item.labelKey)}</Navigation>
          </a>
        ) : (
          <Link key={item.labelKey} href={item.link}>
            <Navigation>{t(item.labelKey)}</Navigation>
          </Link>
        ),
      ),
    [t],
  );

  const socialItems = useMemo(
    () =>
      SOCIALS.map((item) => (
        <Link
          key={item.label}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SocialItem>
            <Image src={item.icon} alt={item.label} width={20} height={20} className="themed-icon" />
          </SocialItem>
        </Link>
      )),
    [],
  );

  return (
    <FooterWrapper>
      <FooterContainer>
        <TopSection>
          <LogoWrapper onClick={() => router.push("/")}>
            <Image
              src={Logo}
              alt="Dynopay logo"
              width={134}
              height={45}
              priority
            />
          </LogoWrapper>

          <ContentRow>
            <DescriptionText>
              {t("footerDescription1")}
              <br />
              {t("footerDescription2")}
            </DescriptionText>

            <NavigationList>{routeItems}</NavigationList>
          </ContentRow>
        </TopSection>

        {/* ── SEO link block (crawl depth + PageRank distribution) ────── */}
        <Box
          component="section"
          data-testid="footer-seo-links"
          aria-label="Industry guides"
          sx={{
            mt: { xs: 4, md: 6 },
            pt: { xs: 4, md: 5 },
            pb: { xs: 3, md: 4 },
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: { xs: 3, md: 6 },
          }}
        >
          <Box>
            <Typography
              component="h3"
              sx={{
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                opacity: 0.85,
                mb: 2,
              }}
            >
              {t('footerByIndustry')}
            </Typography>
            <Box
              component="ul"
              data-testid="footer-seo-verticals"
              sx={{
                listStyle: "none",
                p: 0,
                m: 0,
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
                gap: { xs: 1.25, md: 1.5 },
              }}
            >
              {SEO_VERTICALS.map((v) => (
                <Box component="li" key={v.link} sx={{ display: "flex" }}>
                  <Link href={v.link} passHref legacyBehavior>
                    <Box
                      component="a"
                      data-testid={`footer-vertical-link-${v.link.split("/").pop()}`}
                      sx={{
                        color: "#FCFBF8",
                        opacity: 0.75,
                        fontSize: 13,
                        fontFamily: "var(--font-sans)",
                        textDecoration: "none",
                        transition: "opacity 0.15s ease",
                        "&:hover": { opacity: 1, textDecoration: "underline" },
                      }}
                    >
                      {v.label}
                    </Box>
                  </Link>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <BottomSection>
          <CopyrightText>{t("footerCopyright", { year: new Date().getFullYear() })}</CopyrightText>
          <SocialsWrapper>{socialItems}</SocialsWrapper>
        </BottomSection>
      </FooterContainer>
    </FooterWrapper>
  );
};

export default memo(HomeFooter);
