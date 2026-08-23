import React, { useState } from "react";
import { useRouter } from "next/router";
import { Box, Typography, Skeleton, useTheme } from "@mui/material";
import { Icon as Iconify } from "@iconify/react";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import HandleQrCode from "@/Components/Page/Creator/HandleQrCode";
import { buildCreatorUrl, prettyCreatorUrl } from "@/helpers/creatorUrl";
import copyToClipboard from "@/helpers/copyToClipboard";
import { brandFg } from "@/constants/theme";
import useStorefrontProfile from "@/hooks/useStorefrontProfile";
import StorefrontPendingCard from "@/Components/Page/Storefront/StorefrontPendingCard";

const MONO = 'ui-monospace, "Roboto Mono", SFMono-Regular, Menlo, monospace';

/**
 * Storefront → Share.
 *
 * One page, one link. Everything a merchant sells — tips, products and payment
 * links — lives behind this URL, so this tab is the single place to copy it,
 * scan it or push it to a social network. Storefront-per-company: the handle +
 * QR + share links are for the ACTIVE company, so each company is promoted
 * separately.
 */
const ShareTab: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const accent = brandFg(theme.palette.mode === "dark");
  const { profile, loading } = useStorefrontProfile();
  const handle = profile?.handle as string | undefined;
  const isPublished = Boolean(handle && profile?.creator_page_enabled);
  const url = buildCreatorUrl(handle);
  const pretty = prettyCreatorUrl(handle);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const shareText = profile?.name
    ? `Pay ${profile.name} in crypto — no signup needed.`
    : `Pay me in crypto — no signup needed.`;
  const targets = [
    {
      key: "x",
      icon: "mdi:twitter",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    },
    {
      key: "whatsapp",
      icon: "mdi:whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
    {
      key: "telegram",
      icon: "mdi:telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      key: "email",
      icon: "mdi:email-outline",
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent("My Dynopay page")}&body=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
  ];

  if (loading) {
    return (
      <PanelCard title="">
        <Box data-testid="storefront-share-loading" sx={{ py: 3 }}>
          <Skeleton variant="rounded" height={64} sx={{ borderRadius: "12px", mb: 2 }} />
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: "12px" }} />
        </Box>
      </PanelCard>
    );
  }

  if (profile?.storefront_pending) {
    return <StorefrontPendingCard />;
  }

  if (!handle) {
    return (
      <PanelCard title="">
        <Box
          data-testid="storefront-share-no-handle"
          sx={{ textAlign: "center", py: 6, px: 3 }}
        >
          <Iconify icon="mdi:link-variant-off" width={32} color={theme.palette.text.secondary} />
          <Typography sx={{ fontSize: 17, fontWeight: 700, mt: 1.25 }}>
            Claim your handle to get a link
          </Typography>
          <Typography
            sx={{
              fontSize: 13.5,
              color: theme.palette.text.secondary,
              mt: 0.75,
              mb: 2.5,
              maxWidth: 420,
              mx: "auto",
              lineHeight: 1.55,
            }}
          >
            Your page lives at a short URL you can put in any bio. Pick a handle
            on the Page tab and this is where you&apos;ll share it.
          </Typography>
          <CustomButton
            label="Set up my page"
            variant="primary"
            size="medium"
            data-testid="storefront-share-setup-cta"
            onClick={() => router.push("/storefront?tab=page")}
          />
        </Box>
      </PanelCard>
    );
  }

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
      data-testid="storefront-share"
    >
      <PanelCard
        title="Your page link"
        subTitle={
          isPublished
            ? "Live — anyone with this link can tip you, buy your products and pay your links."
            : "Not published yet — turn on the publish toggle on the Page tab to make this link work."
        }
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            p: 1.75,
            borderRadius: "12px",
            border: `1px solid ${theme.palette.border.main}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              flex: "1 1 260px",
              minWidth: 0,
              fontFamily: MONO,
              fontSize: 14.5,
              fontWeight: 600,
              color: theme.palette.text.primary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            data-testid="storefront-share-url"
          >
            {pretty}
          </Box>
          <CustomButton
            label={copied ? "Copied" : "Copy link"}
            variant={copied ? "outlined" : "primary"}
            size="small"
            data-testid="storefront-share-copy"
            onClick={copy}
          />
          <CustomButton
            label="Open"
            variant="outlined"
            size="small"
            data-testid="storefront-share-open"
            onClick={() => window.open(url, "_blank")}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
          {targets.map((s) => (
            <Box
              key={s.key}
              component="a"
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`storefront-share-${s.key}`}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.75,
                height: 38,
                borderRadius: 999,
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 600,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.border.main}`,
                transition: "border-color 160ms ease, transform 160ms ease",
                "&:hover": { borderColor: accent, transform: "translateY(-1px)" },
              }}
            >
              <Iconify icon={s.icon} width={17} />
              {s.label}
            </Box>
          ))}
        </Box>
      </PanelCard>

      <PanelCard
        title="QR code"
        subTitle="Print it, drop it in a video, stick it on a flyer — it opens your page."
      >
        <HandleQrCode handle={handle} size="full" />
      </PanelCard>
    </Box>
  );
};

export default ShareTab;
