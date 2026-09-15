import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, Typography, useTheme } from '@mui/material'
import { Icon } from '@iconify/react'
import { QRCodeCanvas } from 'qrcode.react'

interface Props {
  creatorName: string
  handle: string
  avatarUrl?: string | null
  accent: string
  amountLabel: string
  message?: string | null
  pageUrl: string
}

const SIZE = 1080

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s?\S*$/, '…')
  return lines
}

const shade = (hex: string, amt: number) => {
  const m = hex.replace('#', '')
  const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

/** 1080×1080 "I supported {creator}" card — drawn on a canvas so it can be downloaded or shared as a PNG. */
const TipThankYouCard = ({ creatorName, handle, avatarUrl, accent, amountLabel, message, pageUrl }: Props) => {
  const { t } = useTranslation('landing')
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const qrRef = useRef<HTMLCanvasElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  const prettyUrl = pageUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')

  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const avatar = avatarUrl ? await loadImage(avatarUrl) : null
      if (cancelled) return

      const g = ctx.createLinearGradient(0, 0, SIZE, SIZE)
      g.addColorStop(0, shade(accent, 20))
      g.addColorStop(1, shade(accent, -70))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath(); ctx.arc(SIZE * 0.85, SIZE * 0.15, 260, 0, Math.PI * 2); ctx.fill()

      // inner card
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, 80, 80, SIZE - 160, SIZE - 160, 48)
      ctx.fill()

      // avatar / initial
      const cx = SIZE / 2, cy = 265, r = 92
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
      if (avatar) ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2)
      else {
        ctx.fillStyle = accent; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        ctx.fillStyle = '#fff'; ctx.font = '700 88px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText((creatorName || handle).charAt(0).toUpperCase(), cx, cy + 6)
      }
      ctx.restore()
      ctx.lineWidth = 8; ctx.strokeStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke()

      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#6B7280'; ctx.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(t('creator.card.iSupported', { defaultValue: 'I just supported' }), cx, 430)
      ctx.fillStyle = '#111827'; ctx.font = '800 72px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      const nameLines = wrap(ctx, creatorName, SIZE - 300, 2)
      nameLines.forEach((l, i) => ctx.fillText(l, cx, 520 + i * 80))
      const afterName = 520 + (nameLines.length - 1) * 80

      ctx.fillStyle = accent; ctx.font = '800 96px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(amountLabel, cx, afterName + 130)

      let y = afterName + 210
      const msg = (message || '').trim()
      if (msg) {
        ctx.fillStyle = '#374151'; ctx.font = 'italic 500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
        wrap(ctx, `“${msg}”`, SIZE - 340, 3).forEach((l, i) => ctx.fillText(l, cx, y + i * 46))
        y += 46 * Math.min(3, wrap(ctx, `“${msg}”`, SIZE - 340, 3).length)
      }

      // footer: QR + url + powered by
      const qr = qrRef.current
      const qrSize = 150, qrX = 140, qrY = SIZE - 80 - 60 - qrSize
      if (qr) { ctx.drawImage(qr, qrX, qrY, qrSize, qrSize) }
      ctx.textAlign = 'left'
      ctx.fillStyle = '#111827'; ctx.font = '700 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(prettyUrl.length > 34 ? `${prettyUrl.slice(0, 33)}…` : prettyUrl, qrX + qrSize + 36, qrY + 62)
      ctx.fillStyle = '#6B7280'; ctx.font = '600 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.fillText(t('creator.card.poweredBy', { defaultValue: 'Powered by Dynopay · non-custodial crypto payments' }), qrX + qrSize + 36, qrY + 112)

      if (!cancelled) setDataUrl(canvas.toDataURL('image/png'))
    }
    draw()
    return () => { cancelled = true }
  }, [creatorName, handle, avatarUrl, accent, amountLabel, message, prettyUrl, t])

  const toBlob = useCallback(
    () =>
      new Promise<Blob | null>((res) => {
        const c = canvasRef.current
        if (!c) { res(null); return }
        c.toBlob((b) => res(b), 'image/png')
      }),
    [],
  )
  const fileName = `supported-${handle || 'creator'}.png`

  const download = useCallback(async () => {
    setBusy('download')
    const blob = await toBlob()
    if (blob) {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = fileName
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    }
    setBusy(null)
  }, [toBlob, fileName])

  const share = useCallback(async () => {
    setBusy('share')
    const text = t('creator.card.shareText', { name: creatorName, defaultValue: 'I just supported {{name}} 💛' })
    const blob = await toBlob()
    const nav = typeof navigator !== 'undefined' ? navigator : null
    try {
      if (blob && nav?.canShare && nav.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })) {
        await nav.share({ files: [new File([blob], fileName, { type: 'image/png' })], text, url: pageUrl })
      } else if (nav?.share) {
        await nav.share({ text, url: pageUrl })
      } else {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${pageUrl}`)}`, '_blank', 'noopener,noreferrer')
        await download()
      }
    } catch { /* user cancelled */ }
    setBusy(null)
  }, [toBlob, fileName, creatorName, pageUrl, t, download])

  return (
    <Box data-testid="tip-thankyou-card" sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 1 }}>
        {t('creator.card.title', { defaultValue: 'Your thank-you card' })}
      </Typography>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ display: 'none' }} aria-hidden />
      <Box sx={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden>
        <QRCodeCanvas ref={qrRef} value={pageUrl} size={300} level="M" marginSize={1} bgColor="#FFFFFF" fgColor="#111827" />
      </Box>
      {dataUrl ? (
        <Box component="img" src={dataUrl} alt={t('creator.card.alt', { name: creatorName, defaultValue: 'I supported {{name}} card' })} data-testid="tip-thankyou-card-preview" sx={{ width: '100%', maxWidth: 320, mx: 'auto', display: 'block', borderRadius: '14px', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }} />
      ) : (
        <Box sx={{ width: '100%', maxWidth: 320, aspectRatio: '1 / 1', mx: 'auto', borderRadius: '14px', bgcolor: theme.palette.action.hover }} />
      )}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={download} disabled={!dataUrl || busy !== null} startIcon={<Icon icon="mdi:download" width={16} />} data-testid="tip-thankyou-card-download" sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 700 }}>
          {t('creator.card.download', { defaultValue: 'Download card' })}
        </Button>
        <Button size="small" variant="contained" onClick={share} disabled={!dataUrl || busy !== null} startIcon={<Icon icon="mdi:share-variant" width={16} />} data-testid="tip-thankyou-card-share" sx={{ textTransform: 'none', borderRadius: '999px', fontWeight: 700, bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}>
          {t('creator.card.share', { defaultValue: 'Share card' })}
        </Button>
      </Box>
    </Box>
  )
}

export default TipThankYouCard
