import React, { memo, useRef } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { blogPosts, getBlogCover } from "@/utils/blogData";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

interface Card {
  id: string;
  kind: string;
  title: string;
  excerpt: string;
  meta: string;
  href: string;
  cover: string;
}

/** §2.3-11 Resources — the published blog posts and guides as a scroll-snap carousel. Content is real, nothing promised. */
const ResourcesV6: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const track = useRef<HTMLDivElement>(null);
  const accent = s.dark ? "#FFD100" : "#8B5E00";
  const posts: Card[] = [...blogPosts]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map((p) => ({ id: p.slug, kind: p.category, title: p.title, excerpt: p.excerpt, meta: p.readTime, href: `/blog/${p.slug}`, cover: getBlogCover(p) }));
  const guides: Card[] = [
    { id: "howto", kind: t("v6.resources.guide"), title: t("v6.resources.howtoT"), excerpt: t("v6.resources.howtoD"), meta: "dynopay.com/how-to", href: "/how-to", cover: "/og/how-to.png" },
    { id: "docs", kind: t("v6.resources.docs"), title: t("v6.resources.docsT"), excerpt: t("v6.resources.docsD"), meta: "dynopay.com/documentation", href: "/documentation", cover: "/og/fees.png" },
  ];
  const cards = [...posts, ...guides];
  const scrollBy = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth || 320) + 20), behavior: "smooth" });
  };
  const navBtn = { width: 40, height: 40, border: `1px solid ${s.lineStrong}`, color: s.ink, "&:hover": { borderColor: BRAND_ACCENT, color: accent, background: "transparent" } } as const;

  return (
    <Section id="resources" alt testId="resources">
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 3, flexWrap: "wrap" }}>
        <SectionHead eyebrow={t("v6.resources.eyebrow")} headline={t("v6.resources.headline")} body={t("v6.resources.body")} maxWidth={620} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: { xs: 3, md: 7 } }}>
          <Box component="a" href="/blog" data-testid="resources-all" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mr: 1.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {t("v6.resources.allPosts")} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
          <IconButton aria-label={t("v6.resources.prev")} data-testid="resources-prev" onClick={() => scrollBy(-1)} sx={navBtn}><ArrowBackRoundedIcon sx={{ fontSize: 20 }} /></IconButton>
          <IconButton aria-label={t("v6.resources.next")} data-testid="resources-next" onClick={() => scrollBy(1)} sx={navBtn}><ArrowForwardRoundedIcon sx={{ fontSize: 20 }} /></IconButton>
        </Box>
      </Box>
      <Stagger step={0.07} sx={{ mx: { xs: -3, md: -5 }, px: { xs: 3, md: 5 } }}>
        <Box ref={track} data-testid="resources-track" sx={{ display: "flex", gap: 2.5, overflowX: "auto", scrollSnapType: "x mandatory", scrollPaddingLeft: { xs: 24, md: 40 }, pb: 1.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" }, WebkitOverflowScrolling: "touch" }}>
          {cards.map((c, i) => (
            <StaggerItem key={c.id} i={i} y={16} style={{ flex: "0 0 auto", scrollSnapAlign: "start" }}>
              <Box component="a" href={c.href} data-card data-testid={`resource-${c.id}`} sx={{ ...cardSx(s, { radius: 22 }), display: "flex", flexDirection: "column", width: { xs: 280, sm: 320, md: 360 }, height: "100%", textDecoration: "none", overflow: "hidden", "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}>
                <Box sx={{ position: "relative", aspectRatio: "1200 / 630", overflow: "hidden", background: s.bgAlt, borderBottom: `1px solid ${s.line}` }}>
                  <Box component="img" src={c.cover} alt="" loading="lazy" decoding="async" width={1200} height={630} sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover", transition: "transform 600ms cubic-bezier(0.16,1,0.3,1)", "a:hover &": { transform: "scale(1.04)" } }} />
                </Box>
                <Box sx={{ p: { xs: 2.25, md: 2.75 }, display: "flex", flexDirection: "column", flex: 1 }}>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: accent, mb: 1.25 }}>{c.kind}</Typography>
                  <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17.5, letterSpacing: "-0.015em", lineHeight: 1.25, color: s.ink, mb: 1 }}>{c.title}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.excerpt}</Typography>
                  <Box sx={{ mt: "auto", pt: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.meta}</Typography>
                    <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: accent, whiteSpace: "nowrap", "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover & svg": { transform: "translate(2px,-2px)" } }}>
                      {t("v6.resources.readMore")} <ArrowOutwardRoundedIcon sx={{ fontSize: 15 }} />
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </StaggerItem>
          ))}
        </Box>
      </Stagger>
    </Section>
  );
};

export default memo(ResourcesV6);
