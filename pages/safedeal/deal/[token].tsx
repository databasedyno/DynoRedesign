import React from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import type { NextPageWithLayout } from "@/pages/_app";
import SafeDealShell from "@/Components/SafeDeal/SafeDealShell";
import DealPage from "@/Components/SafeDeal/DealPage";

interface DealShareMeta {
  title: string;
  description: string;
  image: string;
}

/** Deal page — SSR link-preview meta so a shared deal link unfurls with the real deal (title, amount, escrow state). */
const Page: NextPageWithLayout<{ share: DealShareMeta | null }> = ({ share }) => {
  const { token } = useRouter().query;
  return (
    <SafeDealShell
      title={share?.title || "Deal"}
      description={share?.description}
      ogImage={share?.image}
      ogImageAlt={share ? `${share.title} — SafeDeal escrow` : undefined}
      noindex
    >
      {token ? <DealPage token={String(token)} /> : null}
    </SafeDealShell>
  );
};
Page.layout = "none";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = String(ctx.params?.token || "").trim();
  // SSR fetch base: INTERNAL_API_URL on the preview pod (browser calls stay relative), public URL in prod.
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  let share: DealShareMeta | null = null;
  if (token && /^[a-f0-9]{16,96}$/i.test(token) && base) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(`${base}/api/safedeal/deals/${encodeURIComponent(token)}/preview`, { headers: { Accept: "application/json" }, signal: controller.signal });
      clearTimeout(timer);
      if (r.ok) {
        const j = await r.json();
        const s = j?.data?.share;
        if (s?.title) {
          // Serve the rendered card from the origin the link was shared on (safedeal.sh in prod, the pod host in preview).
          const host = String(ctx.req.headers["x-forwarded-host"] || ctx.req.headers.host || "safedeal.sh").split(",")[0].trim();
          const proto = String(ctx.req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
          share = { title: s.title, description: s.description, image: `${proto}://${host}/api/safedeal/og-image?d=${encodeURIComponent(token)}` };
        }
      }
    } catch (e) {
      console.error("[SSR /safedeal/deal] preview fetch failed (generic card):", e);
    }
  }
  return { props: { share } };
};

export default Page;
