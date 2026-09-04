import { FC, KeyboardEvent, memo, useState } from "react";
import { Box, alpha } from "@mui/material";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { Eyebrow } from "./styled.v3";
import { useAurora, FONT_TECH } from "./theme.v3";

const PANELS = [
  { key: "pain", Component: dynamic(() => import("./PainSolutionV3")) },
  { key: "solutions", Component: dynamic(() => import("./SolutionsGridV3")) },
  { key: "ways", Component: dynamic(() => import("./WaysToGetPaidV3")) },
  { key: "whopays", Component: dynamic(() => import("./WhoPaysFeeV3")) },
  { key: "refunds", Component: dynamic(() => import("./RefundsTrustV3")) },
  { key: "learn", Component: dynamic(() => import("./LearnDocsCards")) },
] as const;

/**
 * "More about Dynopay" — five lower-priority sections folded into one tabbed
 * block (≈40% shorter page). Only the active panel is mounted, so the folded
 * sections cost nothing until a visitor asks for them.
 */
const MoreAboutV3: FC = () => {
  const { t } = useTranslation("landing");
  const s = useAurora();
  const [tab, setTab] = useState(0);
  const Active = PANELS[tab].Component;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (tab + (e.key === "ArrowRight" ? 1 : PANELS.length - 1)) % PANELS.length;
    setTab(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  return (
    <Box component="section" data-testid="more-about" sx={{ background: s.bg, pt: { xs: 10, md: 16 }, pb: { xs: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Eyebrow sx={{ mb: 2.5 }}>{t("v3.more.eyebrow")}</Eyebrow>
        <Box
          role="tablist"
          aria-label={t("v3.more.eyebrow")}
          onKeyDown={onKeyDown}
          data-testid="more-about-tabs"
          sx={{
            display: "flex",
            gap: 1,
            overflowX: "auto",
            pb: 1,
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {PANELS.map((p, i) => {
            const selected = i === tab;
            return (
              <Box
                key={p.key}
                component="button"
                type="button"
                role="tab"
                id={`more-tab-${p.key}`}
                aria-selected={selected}
                aria-controls={`more-panel-${p.key}`}
                tabIndex={selected ? 0 : -1}
                data-testid={`more-tab-${p.key}`}
                onClick={() => setTab(i)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  flex: "0 0 auto",
                  fontFamily: FONT_TECH,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  lineHeight: 1,
                  px: 2,
                  py: 1.5,
                  borderRadius: 999,
                  border: `1px solid ${selected ? "transparent" : s.line}`,
                  color: selected ? (s.dark ? s.bg : "#FFFFFF") : s.ink2,
                  background: selected ? (s.dark ? "#FFFFFF" : s.ink) : "transparent",
                  transition: "background-color 200ms ease, color 200ms ease, border-color 200ms ease",
                  "&:hover": { borderColor: selected ? "transparent" : alpha(s.ink, 0.35), color: selected ? undefined : s.ink },
                  "&:focus-visible": { outline: `2px solid ${s.indigo}`, outlineOffset: 2 },
                }}
              >
                {t(`v3.more.tabs.${p.key}`)}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box
        key={PANELS[tab].key}
        role="tabpanel"
        id={`more-panel-${PANELS[tab].key}`}
        aria-labelledby={`more-tab-${PANELS[tab].key}`}
        data-testid="more-about-panel"
        sx={(theme) => ({
          animation: "moreAboutIn 420ms cubic-bezier(0.16,1,0.3,1) both",
          "@keyframes moreAboutIn": { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "none" } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          // The folded sections keep their own headline/body but drop their band chrome.
          "& > section": {
            background: "transparent",
            borderTop: 0,
            paddingTop: theme.spacing(5),
            paddingBottom: theme.spacing(4),
            [theme.breakpoints.up("md")]: { paddingTop: theme.spacing(8), paddingBottom: theme.spacing(6) },
          },
        })}
      >
        <Active />
      </Box>
    </Box>
  );
};

export default memo(MoreAboutV3);
