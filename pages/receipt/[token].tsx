/**
 * Public shareable receipt — /receipt/<token>
 *
 * A buyer-facing proof of payment that needs no login and no PDF file: the
 * token in the URL is the credential (22 chars, ~128 bits, minted at settlement).
 * Renders an immutable snapshot served by GET /api/pay/receipt/:token — the
 * SAME figures and the SAME localized strings as the emailed PDF, so the three
 * surfaces (email, PDF, page) can never disagree. Labels arrive pre-localized in
 * the receipt's own language, so this page needs no i18n of its own.
 *
 * Styling follows the checkout paid card ("Quiet Money"): flat card, hairline
 * borders, mono amounts, dot-plus-text status, indigo accent only on actions.
 */
import React, { useCallback, useMemo, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { Box, Button, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import Logo from '@/assets/Icons/Logo'
import { BRAND_ACCENT, brandFg } from '@/constants/theme'
import { CRYPTO_INFO, MONO } from '@/Components/Page/Pay3Components/checkout/checkoutConstants'

type PublicReceipt = {
  token: string
  lang: string
  url: string
  pdfUrl: string
  status: string
  amount: string
  currency: string
  cryptoAmount: string | null
  cryptoCurrency: string | null
  coinSymbol: string | null
  coinName: string | null
  network: string | null
  merchant: {
    name: string
    logo: string | null
    verified: boolean
    contact?: { legalName: string | null; email: string | null; website: string | null; phone: string | null; address: string | null } | null
  }
  customer: { name: string | null; emailMasked: string | null }
  transactionId: string
  transactionReference: string | null
  explorerUrl: string | null
  paymentDate: string
  description: string | null
  paymentMethod: string
  labels: Record<string, string>
}

interface Props {
  receipt: PublicReceipt
  siteUrl: string
}

const SUCCESS = '#12B76A'

/** Trim trailing zeros on crypto strings ("0.00312450" -> "0.0031245"), keep fiat as-is. */
const trimCrypto = (v: string | null): string => {
  if (!v) return ''
  if (!/^\d+\.\d+$/.test(v)) return v
  return v.replace(/0+$/, '').replace(/\.$/, '')
}

const Row = ({ label, children, mono, testId }: { label: string; children: React.ReactNode; mono?: boolean; testId?: string }) => {
  const theme = useTheme()
  const muted = theme.palette.text.secondary
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 2,
        py: 1.25,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography sx={{ fontSize: 13, color: muted, flexShrink: 0, minWidth: 120 }}>{label}</Typography>
      <Typography
        component="div"
        sx={{
          fontSize: mono ? 12.5 : 13.5,
          fontFamily: mono ? MONO : undefined,
          color: theme.palette.text.primary,
          textAlign: 'right',
          wordBreak: 'break-all',
          fontWeight: mono ? 400 : 600,
        }}
      >
        {children}
      </Typography>
    </Box>
  )
}

const ReceiptPage = ({ receipt, siteUrl }: Props) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const muted = theme.palette.text.secondary
  const border = theme.palette.divider
  const L = receipt.labels
  const [copied, setCopied] = useState(false)

  const dateLocale = receipt.lang === 'en' ? 'en-US' : receipt.lang
  const when = useMemo(() => new Date(receipt.paymentDate), [receipt.paymentDate])
  const dateLong = useMemo(
    () => new Intl.DateTimeFormat(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' }).format(when),
    [dateLocale, when],
  )
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      }).format(when),
    [dateLocale, when],
  )

  const coinMeta = receipt.cryptoCurrency ? CRYPTO_INFO[receipt.cryptoCurrency.toUpperCase()] : undefined
  const coinIcon = coinMeta?.icon || (receipt.coinSymbol ? `cryptocurrency-color:${receipt.coinSymbol.toLowerCase()}` : 'mdi:currency-usd')
  const pdfHref = `/api/pay/receipt/${encodeURIComponent(receipt.token)}/pdf`
  // Canonical share URL comes from the backend (same one printed in the email + PDF footer).
  const shareUrl = receipt.url || `${siteUrl}/receipt/${receipt.token}`
  const logoOk = !!receipt.merchant.logo && /^(https?:\/\/|data:image\/)/i.test(receipt.merchant.logo)
  const monogram = (receipt.merchant.name || 'M').trim().charAt(0).toUpperCase() || 'M'

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the URL is already in the address bar */
    }
  }, [shareUrl])

  const contact = receipt.merchant.contact || null
  const showLegalName = !!contact?.legalName && contact.legalName.trim().toLowerCase() !== receipt.merchant.name.trim().toLowerCase()
  const printPage = useCallback(() => { if (typeof window !== 'undefined') window.print() }, [])

  const ogTitle = `${L.title} · ${receipt.amount} ${receipt.currency} · ${receipt.merchant.name}`
  const ogDesc = `${L.successful} — ${dateLong}${receipt.cryptoAmount ? ` · ${trimCrypto(receipt.cryptoAmount)} ${receipt.coinSymbol}${receipt.network ? ` · ${receipt.network}` : ''}` : ''} · Dynopay`

  return (
    <>
      <Head>
        <title>{`${L.title} · ${receipt.merchant.name} · Dynopay`}</title>
        <meta key="robots" name="robots" content="noindex, nofollow" />
        <meta key="og:type" property="og:type" content="website" />
        <meta key="og:title" property="og:title" content={ogTitle} />
        <meta key="og:description" property="og:description" content={ogDesc} />
        <meta key="og:url" property="og:url" content={shareUrl} />
        <meta key="og:image" property="og:image" content={`${siteUrl}/og/dynopay-og.png?v=2`} />
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:title" name="twitter:title" content={ogTitle} />
        <meta key="twitter:description" name="twitter:description" content={ogDesc} />
      </Head>

      <Box
        sx={{
          minHeight: '100vh', bgcolor: theme.palette.background.default, py: { xs: 3, sm: 6 }, px: 2,
          '@media print': { minHeight: 0, py: 0, px: 0, bgcolor: '#fff', '& .receipt-no-print': { display: 'none' }, '& .receipt-card': { border: 'none' } },
        }}
        data-testid="public-receipt-page"
      >
        <Box sx={{ maxWidth: 560, mx: 'auto' }}>
          {/* Brand row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Logo width={22} height={26} />
              <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: muted }}>DYNOPAY</Typography>
            </Box>
            <Typography sx={{ fontFamily: MONO, fontSize: 12, color: muted }} data-testid="public-receipt-number">
              {L.receiptNo}
            </Typography>
          </Box>

          {/* Card */}
          <Box className="receipt-card" sx={{ border: `1px solid ${border}`, borderRadius: '16px', bgcolor: theme.palette.background.paper, overflow: 'hidden' }}>
            {/* Status + date */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: { xs: 2.5, sm: 3.5 }, pt: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} data-testid="public-receipt-status">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SUCCESS, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary }}>{L.successful}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: muted, textAlign: 'right' }}>{dateLong}</Typography>
            </Box>

            {/* Amount hero */}
            <Box sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 2.5, pb: 3, borderBottom: `1px solid ${border}` }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted }}>{L.amountPaid}</Typography>
              <Typography
                data-testid="public-receipt-amount"
                sx={{ fontFamily: MONO, fontSize: { xs: 34, sm: 40 }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, mt: 0.5, color: theme.palette.text.primary }}
              >
                {receipt.amount} <Box component="span" sx={{ fontSize: '0.5em', fontWeight: 600, color: muted, letterSpacing: 0 }}>{receipt.currency}</Box>
              </Typography>
              {receipt.cryptoAmount && receipt.coinSymbol && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }} data-testid="public-receipt-crypto">
                  <Icon icon={coinIcon} width={20} height={20} color={coinMeta?.iconColor} />
                  <Typography sx={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: theme.palette.text.primary }}>
                    {trimCrypto(receipt.cryptoAmount)} {receipt.coinSymbol}
                  </Typography>
                  {receipt.network && (
                    <Typography sx={{ fontSize: 13, color: muted }}>· {receipt.network}</Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Parties */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5, px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: `1px solid ${border}` }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, mb: 1 }}>{L.paidTo}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  {logoOk ? (
                    <Box component="img" src={receipt.merchant.logo as string} alt="" sx={{ width: 40, height: 40, borderRadius: '10px', objectFit: 'cover', border: `1px solid ${border}` }} />
                  ) : (
                    <Box sx={{ width: 40, height: 40, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: isDark ? 'rgba(129,140,248,0.14)' : 'rgba(67,56,202,0.08)', color: brandFg(isDark), fontWeight: 700, fontSize: 18, border: `1px solid ${border}` }}>
                      {monogram}
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.2 }} noWrap data-testid="public-receipt-merchant">
                      {receipt.merchant.name}
                    </Typography>
                    {receipt.merchant.verified && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }} data-testid="public-receipt-verified">
                        <Icon icon="mdi:check-decagram" width={14} color={SUCCESS} />
                        <Typography sx={{ fontSize: 12, color: SUCCESS, fontWeight: 600 }}>{L.verifiedMerchant}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
              {(receipt.customer.name || receipt.customer.emailMasked) && (
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, mb: 1 }}>{L.customer}</Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.2 }} noWrap>
                    {receipt.customer.name || receipt.customer.emailMasked}
                  </Typography>
                  {receipt.customer.name && receipt.customer.emailMasked && (
                    <Typography sx={{ fontSize: 12.5, color: muted, mt: 0.25 }} noWrap>{receipt.customer.emailMasked}</Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Transaction details */}
            <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: `1px solid ${border}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: theme.palette.text.primary, mb: 0.5 }}>{L.transactionDetails}</Typography>
              <Row label={L.transactionId} mono testId="public-receipt-txid">{receipt.transactionId}</Row>
              {receipt.transactionReference && (
                <Row label={L.reference} mono testId="public-receipt-reference">
                  {receipt.transactionReference}
                  {receipt.explorerUrl && (
                    <Box
                      component="a"
                      href={receipt.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="public-receipt-explorer-link"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ml: 1, fontFamily: 'inherit', fontSize: 12, color: brandFg(isDark), textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {L.viewOnExplorer}
                      <Icon icon="mdi:open-in-new" width={12} />
                    </Box>
                  )}
                </Row>
              )}
              <Row label={L.paymentMethod}>{receipt.paymentMethod}</Row>
              {receipt.network && <Row label={L.network} testId="public-receipt-network">{receipt.network}</Row>}
              <Row label={L.status}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: SUCCESS }} />
                  {L.completed}
                </Box>
              </Row>
              <Row label={L.dateTime}>{dateTime}</Row>
            </Box>

            {/* Description */}
            {receipt.description && (
              <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: `1px solid ${border}` }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, mb: 0.75 }}>{L.description}</Typography>
                <Typography sx={{ fontSize: 14, color: theme.palette.text.primary }} data-testid="public-receipt-description">{receipt.description}</Typography>
              </Box>
            )}

            {/* Merchant contact — legal name, e-mail, website, phone, address (live from the brand profile) */}
            {contact && (
              <Box sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2.5, borderBottom: `1px solid ${border}` }} data-testid="public-receipt-merchant-contact">
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted, mb: 0.5 }}>{L.merchantContact}</Typography>
                {showLegalName && <Row label={L.legalName} testId="public-receipt-legal-name">{contact.legalName}</Row>}
                {contact.email && (
                  <Row label={L.emailLabel} testId="public-receipt-contact-email">
                    <Box component="a" href={`mailto:${contact.email}?subject=${encodeURIComponent(L.receiptNo)}`} sx={{ color: brandFg(isDark), textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{contact.email}</Box>
                  </Row>
                )}
                {contact.website && (
                  <Row label={L.websiteLabel} testId="public-receipt-contact-website">
                    <Box component="a" href={contact.website} target="_blank" rel="noopener noreferrer" sx={{ color: brandFg(isDark), textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {contact.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                    </Box>
                  </Row>
                )}
                {contact.phone && <Row label={L.phoneLabel} testId="public-receipt-contact-phone">{contact.phone}</Row>}
                {contact.address && <Row label={L.addressLabel} testId="public-receipt-contact-address">{contact.address}</Row>}
              </Box>
            )}

            {/* Actions */}
            <Box className="receipt-no-print" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, px: { xs: 2.5, sm: 3.5 }, py: 2.5 }}>
              <Button
                component="a"
                href={pdfHref}
                variant="contained"
                disableElevation
                data-testid="public-receipt-download-pdf"
                startIcon={<Icon icon="mdi:file-download-outline" width={18} />}
                sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 700, fontSize: 13.5, px: 2.5, minHeight: 40, bgcolor: BRAND_ACCENT, '&:hover': { bgcolor: '#3730A3' } }}
              >
                {L.downloadPdf}
              </Button>
              <Button
                variant="outlined"
                disableElevation
                onClick={copyLink}
                data-testid="public-receipt-copy-link"
                startIcon={<Icon icon={copied ? 'mdi:check' : 'mdi:link-variant'} width={18} />}
                sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 700, fontSize: 13.5, px: 2.5, minHeight: 40, color: theme.palette.text.primary, borderColor: border, '&:hover': { borderColor: theme.palette.text.primary, backgroundColor: 'transparent' } }}
              >
                {copied ? L.linkCopied : L.copyLink}
              </Button>
              <Button
                variant="outlined"
                disableElevation
                onClick={printPage}
                data-testid="public-receipt-print"
                startIcon={<Icon icon="mdi:printer-outline" width={18} />}
                sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 700, fontSize: 13.5, px: 2.5, minHeight: 40, color: theme.palette.text.primary, borderColor: border, '&:hover': { borderColor: theme.palette.text.primary, backgroundColor: 'transparent' } }}
              >
                {L.print}
              </Button>
            </Box>
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 2.5, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12.5, color: muted }}>{L.contactMerchant}</Typography>
            <Typography sx={{ fontSize: 12.5, color: muted, mt: 0.75, maxWidth: 480, mx: 'auto', lineHeight: 1.5 }} data-testid="public-receipt-refund-note">{L.refundNote}</Typography>
            <Typography sx={{ fontSize: 12, color: muted, mt: 1.5 }}>
              {L.tagline} ·{' '}
              <Box component="a" href="https://dynopay.com" target="_blank" rel="noopener noreferrer" sx={{ color: brandFg(isDark), textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                dynopay.com
              </Box>{' '}
              ·{' '}
              <Box component="a" href="https://dynopay.com/help-support" target="_blank" rel="noopener noreferrer" sx={{ color: brandFg(isDark), textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                {L.support}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: muted, mt: 0.5, opacity: 0.8 }}>{L.rights} · {L.autoGenerated}</Typography>
          </Box>
        </Box>
      </Box>
    </>
  )
}

// Public page — no dashboard chrome and no auth redirect.
;(ReceiptPage as unknown as { layout: string }).layout = 'none'

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const token = String(ctx.params?.token || '')
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return { notFound: true }
  // Server-side only: prefer the in-cluster backend URL, then the public app URL.
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
  try {
    const r = await fetch(`${base}/api/pay/receipt/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return { notFound: true }
    const json = await r.json()
    const receipt = json?.data as PublicReceipt | undefined
    if (!receipt?.token) return { notFound: true }
    const proto = (ctx.req.headers['x-forwarded-proto'] as string) || 'https'
    const host = (ctx.req.headers['x-forwarded-host'] as string) || ctx.req.headers.host || ''
    const siteUrl = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || (host ? `${proto}://${host}` : '')).replace(/\/+$/, '')
    ctx.res.setHeader('Cache-Control', 'private, max-age=300')
    return { props: { receipt, siteUrl } }
  } catch {
    return { notFound: true }
  }
}

export default ReceiptPage
