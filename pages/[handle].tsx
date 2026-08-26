import React from 'react'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import CreatorProfile, { CreatorData, CreatorLink } from '@/Components/Page/Creator/CreatorProfile'
import type { CreatorShopProduct } from '@/Components/Page/Creator/CreatorShopSection'
import { SupportWidgetData } from '@/Components/Page/Creator/SupportWidget'
import { CreatorAnalyticsData } from '@/Components/Page/Creator/AnalyticsWidget'
import { getCreatorBaseUrl } from '@/helpers/creatorUrl'

interface CreatorPageProps {
  creator: CreatorData
  links: CreatorLink[]
  siteUrl: string
  supportWidget: SupportWidgetData | null
  analytics: CreatorAnalyticsData | null
  products: CreatorShopProduct[]
}

const CreatorPage = ({ creator, links, siteUrl, supportWidget, analytics, products }: CreatorPageProps) => {
  const title = `${creator.name} (@${creator.handle}) · Dynopay`
  const description =
    creator.bio || `Support ${creator.name} with crypto — donate or pay securely via Dynopay.`
  const url = `${siteUrl}/${creator.handle}`
  const image = creator.photo || `${siteUrl}/og/dynopay-og.png`

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name='description' content={description} />
        <link rel='canonical' href={url} />
        <meta key='og:title' property='og:title' content={title} />
        <meta key='og:description' property='og:description' content={description} />
        <meta key='og:url' property='og:url' content={url} />
        <meta key='og:image' property='og:image' content={image} />
        <meta key='og:type' property='og:type' content='profile' />
        <meta key='twitter:image' name='twitter:image' content={image} />
        <meta key='twitter:title' name='twitter:title' content={title} />
        <meta key='twitter:description' name='twitter:description' content={description} />
      </Head>
      <CreatorProfile creator={creator} links={links} siteUrl={siteUrl} supportWidget={supportWidget} analytics={analytics} products={products} />
    </>
  )
}

// Public page — no auth chrome
;(CreatorPage as unknown as { layout: string }).layout = 'home'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const handle = String(ctx.params?.handle || '').toLowerCase()
  // Server-side fetch base: prefer an internal API URL (set in preview where
  // NEXT_PUBLIC_BASE_URL is empty), then the public app URL. This is used ONLY
  // to reach the backend during SSR — the shareable creator URL is separate.
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
  // Creator pages are served ONLY on the branded creator domain (dynopay.me);
  // a valid handle opened on another host is forwarded there (production only,
  // so the single-host Emergent preview always renders for verification).
  const creatorBase = getCreatorBaseUrl()
  let creatorHost = ''
  try { creatorHost = creatorBase ? new URL(creatorBase).host.toLowerCase() : '' } catch { creatorHost = '' }
  const reqHost = String(ctx.req.headers['x-forwarded-host'] || ctx.req.headers.host || '').split(',')[0].trim().toLowerCase()
  try {
    // Profile + analytics in parallel — analytics is optional and never blocks
    // the page render. If the endpoint 404s (older creator, network hiccup),
    // we just render without the momentum widget.
    const [r, ar] = await Promise.all([
      fetch(`${base}/api/pay/creator/${encodeURIComponent(handle)}`, { headers: { Accept: 'application/json' } }),
      fetch(`${base}/api/pay/creator/${encodeURIComponent(handle)}/analytics`, { headers: { Accept: 'application/json' } }).catch(() => null),
    ])
    if (!r.ok) {
      console.error(`[SSR /[handle]] creator fetch "${handle}" -> HTTP ${r.status} (base=${base})`)
      return { notFound: true }
    }
    const json = await r.json()
    const data = json?.data
    if (!data?.creator) return { notFound: true }

    // Off-domain (dynopay.com / checkout.*) → forward to the creator domain.
    if (process.env.NODE_ENV === 'production' && creatorHost && reqHost && reqHost !== creatorHost) {
      return { redirect: { destination: `${creatorBase}${ctx.resolvedUrl}`, permanent: true } }
    }

    // Live products render INLINE on this page (session 2026-08-12 storefront
    // merge) so the one link a merchant shares also shows what they sell.
    // Best-effort: a shop failure must never take the page down.
    let products: CreatorShopProduct[] = []
    // Respect the merchant's store-visibility settings: hide products from this
    // page when the store is OFF (store_enabled=false) OR when they've turned off
    // "show products on my page" (creator_page_show_products=false).
    const showProductsOnPage =
      data.creator?.store_enabled !== false &&
      data.creator?.creator_page_show_products !== false
    if (showProductsOnPage && String(process.env.NEXT_PUBLIC_ENABLE_PRODUCT_CATALOG ?? 'true').toLowerCase() !== 'false') {
      try {
        const sr = await fetch(`${base}/api/shop/${encodeURIComponent(handle)}`, { headers: { Accept: 'application/json' } })
        if (sr.ok) {
          const sj = await sr.json()
          const list = sj?.data?.products
          if (Array.isArray(list)) products = list as CreatorShopProduct[]
        }
      } catch { /* shop is optional — ignore */ }
    }

    // Analytics: only pass through when enabled=true AND we have some tips
    // (chart or top supporters non-empty). Otherwise widget stays hidden.
    let analytics: CreatorAnalyticsData | null = null
    try {
      if (ar && ar.ok) {
        const aj = await ar.json()
        const ad = aj?.data
        if (ad?.enabled) {
          const hasChart = Array.isArray(ad.chart) && ad.chart.some((b: { count?: number }) => Number(b?.count || 0) > 0)
          const hasSupporters = Array.isArray(ad.top_supporters) && ad.top_supporters.length > 0
          if (hasChart || hasSupporters) analytics = ad as CreatorAnalyticsData
        }
      }
    } catch { /* analytics fetch is best-effort — never blocks the page */ }

    // Public content — let DO's edge/CDN serve repeat hits so the backend + DB
    // are barely touched (60s fresh, 5min stale-while-revalidate). Set only on
    // the successful render path (not on notFound / redirect).
    ctx.res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    return {
      props: {
        creator: data.creator,
        links: Array.isArray(data.links) ? data.links : [],
        // Public creator pages are shared under the branded creator domain
        // (NEXT_PUBLIC_CREATOR_BASE_URL, e.g. dynopay.me); the API fetch above
        // still uses the app/internal base URL.
        siteUrl: getCreatorBaseUrl() || (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, ''),
        supportWidget: data.support_widget || null,
        analytics,
        products,
      },
    }
  } catch (e) {
    console.error(`[SSR /[handle]] creator render failed:`, e)
    return { notFound: true }
  }
}

export default CreatorPage
