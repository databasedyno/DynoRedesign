/**
 * DonationCampaign — public checkout view for donation / crowdfunding links.
 *
 * Rendered by pages/pay/index.tsx when getData returns is_donation:true.
 * The donor picks (or types) an amount, optionally adds a name/message,
 * and "Donate" calls POST /pay/startDonation via the onDonate callback —
 * the page then continues with the regular crypto checkout flow using the
 * returned child payment reference.
 */
import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Paper,
  Typography,
  useTheme,
} from '@mui/material'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import Logo from '@/assets/Icons/Logo'
import {
  formatWithSeparators,
  getCurrencySymbolFromFormat,
} from '@/utils/currencyFormat'

export interface DonationCampaignData {
  title: string | null
  purpose: string | null
  campaign_image: string | null
  currency: string
  goal_amount: number | null
  raised_amount: number
  supporters_count: number
  progress_percent: number | null
  min_amount: number
  preset_amounts: number[]
  allow_custom_amount: boolean
  show_progress: boolean
  show_supporters: boolean
  campaign_closed: boolean
  closed_reason: 'goal_reached' | 'expired' | null
  recent_supporters: Array<{
    name: string | null
    message: string | null
    amount: number
    currency: string
    at: string
  }>
}

interface DonationCampaignProps {
  donation: DonationCampaignData
  merchant: { name: string; company_logo: string | null } | null
  submitting: boolean
  onDonate: (p: {
    amount: number
    donor_name?: string
    donor_message?: string
    is_anonymous?: boolean
  }) => void
}

const MESSAGE_MAX = 280

const DonationCampaign = ({ donation, merchant, submitting, onDonate }: DonationCampaignProps) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useTranslation('common')

  const currency = donation.currency || 'USD'
  const symbol = getCurrencySymbolFromFormat(currency)
  const minAmount = donation.min_amount > 0 ? donation.min_amount : 1
  const presets = donation.preset_amounts || []
  const allowCustom = donation.allow_custom_amount !== false

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [donorName, setDonorName] = useState<string>('')
  const [donorMessage, setDonorMessage] = useState<string>('')
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false)
  const [amountError, setAmountError] = useState<string>('')

  const fmt = (n: number) => `${symbol}${formatWithSeparators(n, currency)}`

  const effectiveAmount = useMemo(() => {
    if (selectedPreset != null) return selectedPreset
    const n = parseFloat(customAmount)
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }, [selectedPreset, customAmount])

  const canDonate = effectiveAmount != null && effectiveAmount >= minAmount && !submitting

  const green = '#10B981'
  const progressPct = donation.progress_percent
  const goalReached = donation.closed_reason === 'goal_reached' ||
    (donation.goal_amount != null && donation.goal_amount > 0 && donation.raised_amount >= donation.goal_amount)

  const handlePreset = (v: number) => {
    setSelectedPreset(v)
    setCustomAmount('')
    setAmountError('')
  }

  const handleCustomChange = (raw: string) => {
    // digits + one decimal separator, max 2 decimals
    const cleaned = raw.replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned
    const limited = parts[1]?.length > 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : safe
    setCustomAmount(limited)
    setSelectedPreset(null)
    setAmountError('')
  }

  const handleDonate = () => {
    if (submitting) return
    if (effectiveAmount == null || effectiveAmount <= 0) {
      setAmountError(t('donation.enterAmount', { defaultValue: 'Please choose or enter a donation amount.' }))
      return
    }
    if (effectiveAmount < minAmount) {
      setAmountError(
        t('donation.minAmountError', {
          defaultValue: `Minimum donation is ${fmt(minAmount)}.`,
          amount: fmt(minAmount),
        })
      )
      return
    }
    onDonate({
      amount: effectiveAmount,
      donor_name: donorName.trim() || undefined,
      donor_message: donorMessage.trim() || undefined,
      is_anonymous: isAnonymous,
    })
  }

  const inputSx = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '10px',
    border: `1px solid ${theme.palette.border.main}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    '&:focus': { borderColor: green },
    '&::placeholder': { color: theme.palette.text.disabled },
  }

  const sectionLabelSx = {
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary,
    mb: 1,
    textAlign: 'left' as const,
  }

  return (
    <Box
      display='flex'
      alignItems='flex-start'
      justifyContent='center'
      px={{ xs: 1.5, sm: 2 }}
      py={{ xs: 1, sm: 2 }}
    >
      <Paper
        elevation={0}
        data-testid='donation-campaign-card'
        sx={{
          borderRadius: '16px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: 500,
          border: `1px solid ${theme.palette.border.main}`,
          boxShadow: isDark
            ? '0 12px 40px rgba(0,0,0,0.35)'
            : '0 8px 32px rgba(10,10,10,0.06), 0 2px 8px rgba(0,0,0,0.04)',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {/* Accent bar */}
        <Box sx={{ height: '3px', background: `linear-gradient(90deg, ${green} 0%, ${theme.palette.primary.main} 100%)` }} />

        {/* Cover image */}
        {donation.campaign_image && (
          <Box
            component='img'
            src={donation.campaign_image}
            alt={donation.title || 'Campaign'}
            data-testid='donation-cover-image'
            sx={{ width: '100%', height: { xs: 140, sm: 170 }, objectFit: 'cover', display: 'block' }}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}

        <Box px={{ xs: 2, sm: 3 }} py={{ xs: 2, sm: 2.5 }}>
          {/* Merchant row */}
          <Box display='flex' alignItems='center' justifyContent='center' gap={1} mb={1.25}>
            {merchant?.company_logo ? (
              <Box
                component='img'
                src={merchant.company_logo}
                alt={merchant?.name || 'Merchant'}
                sx={{ maxHeight: 28, maxWidth: 96, objectFit: 'contain' }}
                onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <Logo width={26} height={30} />
            )}
            {merchant?.name && (
              <Typography fontSize={12.5} fontWeight={600} color={theme.palette.text.secondary}>
                {merchant.name}
              </Typography>
            )}
          </Box>

          {/* Title + purpose */}
          <Typography
            fontWeight={700}
            fontSize={{ xs: 19, sm: 21 }}
            lineHeight={1.25}
            letterSpacing='-0.3px'
            color={theme.palette.text.primary}
            textAlign='center'
            data-testid='donation-title'
          >
            {donation.title || t('donation.defaultTitle', { defaultValue: 'Support this campaign' })}
          </Typography>
          {donation.purpose && (
            <Typography
              color={theme.palette.text.secondary}
              fontSize={13.5}
              lineHeight={1.55}
              mt={0.75}
              textAlign='center'
              data-testid='donation-purpose'
              sx={{ whiteSpace: 'pre-line' }}
            >
              {donation.purpose}
            </Typography>
          )}

          {/* Progress */}
          {donation.show_progress && (
            <Box mt={2} data-testid='donation-progress'>
              <Box display='flex' alignItems='baseline' justifyContent='space-between' gap={1} flexWrap='wrap'>
                <Typography fontSize={17} fontWeight={700} color={theme.palette.text.primary} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(donation.raised_amount)}{' '}
                  <Typography component='span' fontSize={13} fontWeight={500} color={theme.palette.text.secondary}>
                    {donation.goal_amount != null && donation.goal_amount > 0
                      ? t('donation.raisedOfGoal', {
                          defaultValue: `raised of ${fmt(donation.goal_amount)} goal`,
                          goal: fmt(donation.goal_amount),
                        })
                      : t('donation.raised', { defaultValue: 'raised' })}
                  </Typography>
                </Typography>
                {progressPct != null && (
                  <Typography fontSize={12.5} fontWeight={600} color={green} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t('donation.percentFunded', { defaultValue: `${progressPct}% funded`, percent: progressPct })}
                  </Typography>
                )}
              </Box>
              {donation.goal_amount != null && donation.goal_amount > 0 && (
                <LinearProgress
                  variant='determinate'
                  value={Math.min(100, progressPct ?? 0)}
                  sx={{
                    mt: 1,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    '& .MuiLinearProgress-bar': { backgroundColor: green, borderRadius: 999 },
                  }}
                />
              )}
              <Typography fontSize={12} color={theme.palette.text.secondary} mt={0.75} textAlign='left'>
                <Icon icon='mdi:account-heart-outline' width={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                {t('donation.supportersCount', {
                  defaultValue: `${donation.supporters_count} supporters`,
                  count: donation.supporters_count,
                })}
              </Typography>
            </Box>
          )}

          {/* Closed state OR donate form */}
          {donation.campaign_closed ? (
            <Box
              mt={2.5}
              p={2}
              borderRadius='12px'
              data-testid='donation-closed-banner'
              sx={{
                backgroundColor: goalReached
                  ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)')
                  : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                border: `1px solid ${goalReached ? 'rgba(16,185,129,0.35)' : theme.palette.border.main}`,
                textAlign: 'center',
              }}
            >
              <Typography fontSize={15} fontWeight={700} color={goalReached ? green : theme.palette.text.primary}>
                {goalReached
                  ? t('donation.closedGoalReached', { defaultValue: 'Goal reached — thank you!' })
                  : t('donation.closedExpired', { defaultValue: 'This campaign has ended' })}
              </Typography>
              <Typography fontSize={12.5} color={theme.palette.text.secondary} mt={0.5}>
                {t('donation.closedSubtitle', { defaultValue: 'This campaign is no longer accepting donations.' })}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Amount selection */}
              <Box mt={2.5}>
                <Typography sx={sectionLabelSx}>
                  {t('donation.chooseAmount', { defaultValue: 'Choose an amount' })}
                </Typography>
                {presets.length > 0 && (
                  <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={1} mb={allowCustom ? 1.25 : 0}>
                    {presets.map((p) => {
                      const active = selectedPreset === p
                      return (
                        <Box
                          key={p}
                          role='button'
                          tabIndex={0}
                          data-testid={`donation-preset-${p}`}
                          onClick={() => handlePreset(p)}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handlePreset(p)
                            }
                          }}
                          sx={{
                            cursor: 'pointer',
                            userSelect: 'none',
                            textAlign: 'center',
                            padding: '11px 6px',
                            borderRadius: '10px',
                            fontFamily: 'var(--font-sans)',
                            fontSize: 14.5,
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            border: `1.5px solid ${active ? green : theme.palette.border.main}`,
                            color: active ? green : theme.palette.text.primary,
                            backgroundColor: active
                              ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.07)')
                              : 'transparent',
                            transition: 'all 120ms ease',
                            '&:hover': { borderColor: green },
                          }}
                        >
                          {fmt(p)}
                        </Box>
                      )
                    })}
                  </Box>
                )}
                {allowCustom && (
                  <Box position='relative'>
                    <Typography
                      component='span'
                      sx={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: theme.palette.text.secondary,
                        pointerEvents: 'none',
                      }}
                    >
                      {symbol}
                    </Typography>
                    <Box
                      component='input'
                      inputMode='decimal'
                      data-testid='donation-custom-amount'
                      value={customAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomChange(e.target.value)}
                      placeholder={t('donation.customAmountPlaceholder', { defaultValue: 'Other amount' })}
                      sx={{ ...inputSx, paddingLeft: `${14 + symbol.length * 10 + 6}px`, fontVariantNumeric: 'tabular-nums' }}
                    />
                  </Box>
                )}
                <Box display='flex' justifyContent='space-between' alignItems='center' mt={0.5}>
                  <Typography fontSize={11.5} color={amountError ? theme.palette.error.main : theme.palette.text.secondary} data-testid='donation-amount-hint'>
                    {amountError ||
                      t('donation.minAmountHint', {
                        defaultValue: `Minimum ${fmt(minAmount)}`,
                        amount: fmt(minAmount),
                      })}
                  </Typography>
                  <Typography fontSize={11.5} color={theme.palette.text.secondary}>
                    {currency}
                  </Typography>
                </Box>
              </Box>

              {/* Donor details */}
              <Box mt={2}>
                <Typography sx={sectionLabelSx}>
                  {t('donation.donorDetails', { defaultValue: 'Your details' })}{' '}
                  <Typography component='span' fontSize={11} fontWeight={400} textTransform='none' color={theme.palette.text.disabled}>
                    ({t('donation.optional', { defaultValue: 'optional' })})
                  </Typography>
                </Typography>
                <Box
                  component='input'
                  type='text'
                  maxLength={100}
                  data-testid='donation-donor-name'
                  value={donorName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDonorName(e.target.value)}
                  placeholder={t('donation.namePlaceholder', { defaultValue: 'Your name' })}
                  sx={{ ...inputSx, mb: 1 }}
                />
                <Box position='relative'>
                  <Box
                    component='textarea'
                    rows={2}
                    maxLength={MESSAGE_MAX}
                    data-testid='donation-donor-message'
                    value={donorMessage}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDonorMessage(e.target.value)}
                    placeholder={t('donation.messagePlaceholder', { defaultValue: 'Leave a message of support…' })}
                    sx={{ ...inputSx, resize: 'vertical', minHeight: 56, display: 'block' }}
                  />
                  {donorMessage.length > 0 && (
                    <Typography fontSize={10.5} color={theme.palette.text.disabled} textAlign='right' mt={0.25}>
                      {donorMessage.length}/{MESSAGE_MAX}
                    </Typography>
                  )}
                </Box>
                <FormControlLabel
                  sx={{ mt: 0.25, ml: '-9px', '& .MuiFormControlLabel-label': { fontSize: 12.5, color: theme.palette.text.secondary } }}
                  control={
                    <Checkbox
                      size='small'
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      data-testid='donation-anonymous-checkbox'
                      sx={{ '&.Mui-checked': { color: green } }}
                    />
                  }
                  label={t('donation.donateAnonymously', { defaultValue: 'Donate anonymously' })}
                />
              </Box>

              {/* Donate button */}
              <Button
                fullWidth
                disableElevation
                variant='contained'
                data-testid='donation-donate-btn'
                onClick={handleDonate}
                disabled={!canDonate}
                sx={{
                  mt: 1.5,
                  py: 1.4,
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  backgroundColor: green,
                  color: '#fff',
                  '&:hover': { backgroundColor: '#0EA372' },
                  '&.Mui-disabled': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                    color: theme.palette.text.disabled,
                  },
                }}
              >
                {submitting ? (
                  <CircularProgress size={20} sx={{ color: '#fff' }} />
                ) : effectiveAmount != null && effectiveAmount > 0 ? (
                  t('donation.donateAmount', { defaultValue: `Donate ${fmt(effectiveAmount)}`, amount: fmt(effectiveAmount) })
                ) : (
                  t('donation.donate', { defaultValue: 'Donate' })
                )}
              </Button>
              <Typography fontSize={11} color={theme.palette.text.disabled} textAlign='center' mt={1}>
                <Icon icon='mdi:lock-outline' width={12} style={{ verticalAlign: '-2px', marginRight: 3 }} />
                {t('donation.secureNote', { defaultValue: 'Secure crypto payment — you will pick a coin on the next step.' })}
              </Typography>
            </>
          )}

          {/* Supporter wall */}
          {donation.show_supporters && donation.recent_supporters?.length > 0 && (
            <Box mt={2.5} data-testid='donation-supporter-wall'>
              <Typography sx={sectionLabelSx}>
                {t('donation.recentSupporters', { defaultValue: 'Recent supporters' })}
              </Typography>
              <Box display='flex' flexDirection='column' gap={1}>
                {donation.recent_supporters.slice(0, 10).map((s, i) => {
                  const displayName = s.name || t('donation.anonymous', { defaultValue: 'Anonymous' })
                  return (
                    <Box
                      key={`${s.at}-${i}`}
                      display='flex'
                      alignItems='flex-start'
                      gap={1.25}
                      p={1.25}
                      borderRadius='10px'
                      sx={{
                        border: `1px solid ${theme.palette.border.main}`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                        textAlign: 'left',
                      }}
                    >
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.10)',
                          color: green,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {s.name ? s.name.charAt(0).toUpperCase() : <Icon icon='mdi:heart' width={14} />}
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Box display='flex' alignItems='baseline' justifyContent='space-between' gap={1}>
                          <Typography fontSize={13} fontWeight={600} color={theme.palette.text.primary} noWrap>
                            {displayName}
                          </Typography>
                          <Typography fontSize={12.5} fontWeight={700} color={green} sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {getCurrencySymbolFromFormat(s.currency || currency)}
                            {formatWithSeparators(s.amount, s.currency || currency)}
                          </Typography>
                        </Box>
                        {s.message && (
                          <Typography fontSize={12} color={theme.palette.text.secondary} mt={0.25} sx={{ wordBreak: 'break-word' }}>
                            {s.message}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}

export default DonationCampaign
