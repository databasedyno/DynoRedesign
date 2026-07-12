import React from 'react'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import CreatorProfile, { CreatorData, CreatorLink } from '@/Components/Page/Creator/CreatorProfile'

interface CreatorPageProps {
  creator: CreatorData
  links: CreatorLink[]
  siteUrl: string
}

const CreatorPage = ({ creator, links, siteUrl }: CreatorPageProps) => {
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
      <CreatorProfile creator={creator} links={links} siteUrl={siteUrl} />
    </>
  )
}

// Public page — no auth chrome
;(CreatorPage as unknown as { layout: string }).layout = 'home'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const handle = String(ctx.params?.handle || '').toLowerCase()
  const base = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
  try {
    const r = await fetch(`${base}/api/pay/creator/${encodeURIComponent(handle)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) return { notFound: true }
    const json = await r.json()
    const data = json?.data
    if (!data?.creator) return { notFound: true }
    return {
      props: {
        creator: data.creator,
        links: Array.isArray(data.links) ? data.links : [],
        siteUrl: base,
      },
    }
  } catch {
    return { notFound: true }
  }
}

export default CreatorPage
