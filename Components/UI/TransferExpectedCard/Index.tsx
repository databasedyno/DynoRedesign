import copyToClipboard from "@/helpers/copyToClipboard";
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  useTheme, 
  CircularProgress,
  IconButton,
  Tooltip,
  Snackbar
} from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import DoneIcon from '@mui/icons-material/Done'
import { Icon } from '@iconify/react'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { useTranslation } from 'react-i18next'

interface TransferExpectedCardProps {
  isTrue?: boolean
  type: string
  dataUrl: string
  redirectUrl?: string | null
  transactionId?: string
  merchantName?: string
  amount?: string
  email?: string
  customerName?: string
  /** ISO timestamp (`dbLink.updatedAt`) — when the payment settled. When set,
   *  the success card shows a small "Paid X days ago (Mon DD, YYYY)" line
   *  under the amount. Helps merchants disambiguate revisits of the same link. */
  paidAt?: string | null
  /** Link type — 'standard' | 'donation' | 'contribution'. When 'contribution',
   *  the success card renders donation-flavored copy ("Thank you for your
   *  donation!" / "You donated $X to {campaign}") and reveals the donor
   *  message + campaign progress + share/back-to-campaign CTAs. */
  linkType?: string
  /** Contribution context — parent campaign info + donor message. Only used
   *  when linkType==='contribution'. */
  contributionInfo?: {
    parent_link_id?: number | string | null
    campaign_title?: string | null
    campaign_description?: string | null
    campaign_image?: string | null
    campaign_currency?: string | null
    campaign_pay_url?: string | null
    goal_amount?: number | null
    raised_amount?: number | null
    supporters_count?: number | null
    progress_percent?: number | null
    show_progress?: boolean
    show_supporters?: boolean
    donor_name?: string | null
    donor_message?: string | null
    is_anonymous?: boolean
  } | null
}

export default function TransferExpectedCard({
  isTrue,
  type,
  dataUrl,
  redirectUrl,
  transactionId,
  merchantName,
  amount,
  email,
  customerName,
  paidAt,
  linkType,
  contributionInfo,
}: TransferExpectedCardProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t, i18n } = useTranslation('common')
  
  const [countdown, setCountdown] = useState(5)
  const [isAutoRedirecting, setIsAutoRedirecting] = useState(false)
  const [showDoneState, setShowDoneState] = useState(false)
  const [copySnackbar, setCopySnackbar] = useState(false)

  // Auto-redirect after 5 seconds if redirectUrl is provided and payment is successful
  const handleRedirect = useCallback(() => {
    if (!redirectUrl || !transactionId) return
    
    try {
      const url = new URL(redirectUrl)
      url.searchParams.set('transaction_id', transactionId)
      url.searchParams.set('status', 'success')
      window.location.href = url.toString()
    } catch (e) {
      const separator = redirectUrl.includes('?') ? '&' : '?'
      window.location.href = `${redirectUrl}${separator}transaction_id=${transactionId}&status=success`
    }
  }, [redirectUrl, transactionId])

  useEffect(() => {
    if (isTrue && redirectUrl && transactionId) {
      setIsAutoRedirecting(true)
      
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleRedirect()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isTrue, redirectUrl, transactionId, handleRedirect])

  const handleCopyTransactionId = useCallback(async () => {
    if (transactionId) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          await copyToClipboard(transactionId)
        } else {
          const textArea = document.createElement('textarea')
          textArea.value = transactionId
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        setCopySnackbar(true)
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = transactionId
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopySnackbar(true)
      }
    }
  }, [transactionId])

  const handleDone = () => {
    setShowDoneState(true)
  }

  // ─── Paid-at formatter ───────────────────────────────────────────────
  // Returns `{ relative, absolute }` for the given ISO timestamp — used on the
  // "already paid" success card so merchants revisiting the link can see when
  // the customer actually settled. Inline (no date-fns dep) since we only need
  // one relative format on one screen. Uses i18n's current language for both
  // the relative-time strings AND the absolute date so switching language via
  // the header dropdown reformats everything in one place.
  const currentLang = i18n.language
  const paidAtFormatted = useMemo(() => {
    if (!paidAt) return null
    const ts = new Date(paidAt)
    if (Number.isNaN(ts.getTime())) return null
    const nowMs = Date.now()
    const diffSec = Math.max(0, Math.round((nowMs - ts.getTime()) / 1000))
    let relative: string
    if (diffSec < 60) {
      relative = t('success.paidJustNow', { defaultValue: 'just now' })
    } else if (diffSec < 3600) {
      const n = Math.floor(diffSec / 60)
      relative = t('success.paidMinutesAgo', { count: n, defaultValue: `${n} minute${n === 1 ? '' : 's'} ago` })
    } else if (diffSec < 86400) {
      const n = Math.floor(diffSec / 3600)
      relative = t('success.paidHoursAgo', { count: n, defaultValue: `${n} hour${n === 1 ? '' : 's'} ago` })
    } else if (diffSec < 86400 * 30) {
      const n = Math.floor(diffSec / 86400)
      relative = t('success.paidDaysAgo', { count: n, defaultValue: `${n} day${n === 1 ? '' : 's'} ago` })
    } else {
      const n = Math.floor(diffSec / (86400 * 30))
      relative = t('success.paidMonthsAgo', { count: n, defaultValue: `${n} month${n === 1 ? '' : 's'} ago` })
    }
    let absolute = ''
    try {
      absolute = ts.toLocaleDateString(currentLang || undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      absolute = ts.toISOString().slice(0, 10)
    }
    return { relative, absolute }
  }, [paidAt, t, currentLang])

  // Done state - final thank you screen
  if (showDoneState) {
    return (
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
        px={2}
        minHeight={'calc(100vh - 340px)'}
      >
        <Card
          sx={{
            width: 400,
            borderRadius: '16px',
            boxShadow: isDark 
              ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
              : '0 45px 65px rgba(13, 3, 35, 0.06)',
            overflow: 'hidden',
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper
          }}
        >
          <Box
            sx={{
              py: 4,
              background: isDark 
                ? 'radial-gradient(circle at top center, rgba(18, 183, 106, 0.15), transparent 70%)'
                : 'radial-gradient(circle at top center, #e8f9f1, #ffffff 70%)'
            }}
          >
            <DoneIcon sx={{ fontSize: 56, color: '#12B76A' }} />
          </Box>
          <Box px={4} pb={4}>
            <Typography
              variant='h6'
              fontWeight={600}
              color={theme.palette.text.primary}
              mb={1}
              
            >
              {customerName ? t('success.thankYouName', { name: customerName, defaultValue: `Thank you, ${customerName}!` }) : t('success.thankYou')}
            </Typography>
            <Box 
              display='flex' 
              alignItems='center' 
              justifyContent='center' 
              gap={0.5}
              mt={2}
            >
              <Icon icon="mdi:lock" width={14} color={theme.palette.primary.main} />
              <Typography
                fontSize={12}
                
                color={theme.palette.primary.main}
                fontWeight={500}
              >
                {t('checkout.securePayment')}
              </Typography>
            </Box>
          </Box>
        </Card>
      </Box>
    )
  }

  // Success state with payment confirmed
  if (isTrue) {
    return (
      <Box
        display='flex'
        alignItems='center'
        justifyContent='center'
        bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
        px={2}
        minHeight={'calc(100vh - 340px)'}
      >
        <Card
          data-testid="success-card"
          sx={{
            width: 420,
            borderRadius: '16px',
            boxShadow: isDark 
              ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
              : '0 45px 65px rgba(13, 3, 35, 0.06)',
            overflow: 'hidden',
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper
          }}
        >
          {/* Success Icon with gradient background */}
          <Box
            sx={{
              py: 3,
              background: isDark 
                ? 'radial-gradient(circle at top center, rgba(18, 183, 106, 0.15), transparent 70%)'
                : 'radial-gradient(circle at top center, #e8f9f1, #ffffff 70%)'
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#12B76A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                animation: 'scaleIn 0.3s ease-out'
              }}
            >
              <DoneIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
          </Box>

          {/* Content */}
          <Box px={4} pb={4}>
            <Typography
              variant='h5'
              fontWeight={600}
              color={theme.palette.text.primary}
              mb={1}
              
              data-testid="success-title"
            >
              {linkType === 'contribution'
                ? (customerName
                    ? t('success.donationThanksName', { name: customerName, defaultValue: `Thank you for your donation, ${customerName}!` })
                    : t('success.donationThanks', { defaultValue: 'Thank you for your donation!' })
                  )
                : (customerName
                    ? t('success.paymentSuccessfulName', { name: customerName, defaultValue: `Payment Successful, ${customerName}!` })
                    : t('success.paymentSuccessful')
                  )
              }
            </Typography>

            {/* Amount paid info */}
            <Typography
              variant='body1'
              color={isDark ? theme.palette.text.secondary : '#515151'}
              mb={paidAtFormatted ? 1 : 3}
              
            >
              {linkType === 'contribution' && contributionInfo
                ? (amount && contributionInfo.campaign_title
                    ? t('success.donatedToCampaign', {
                        amount,
                        campaign: contributionInfo.campaign_title,
                        defaultValue: `You donated ${amount} to ${contributionInfo.campaign_title}.`,
                      })
                    : amount
                    ? t('success.donatedAmount', {
                        amount,
                        defaultValue: `You donated ${amount}. Every contribution helps.`,
                      })
                    : t('success.donationConfirmed', {
                        defaultValue: 'Your donation has been received.',
                      })
                  )
                : merchantName && amount
                ? t('success.paidTo', { amount, merchant: merchantName })
                : amount
                ? t('success.paidAmount', { amount })
                : t('success.paymentConfirmed')
              }
            </Typography>

            {/* Donation extras — donor message (if not anonymous), campaign
                progress (if merchant enabled show_progress), and share/back
                CTAs. Only rendered for contribution links. */}
            {linkType === 'contribution' && contributionInfo && (
              <Box
                data-testid="donation-success-extras"
                sx={{
                  mb: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                {/* Donor message — shown when the donor left one and did NOT
                    tick "donate anonymously" */}
                {!contributionInfo.is_anonymous && contributionInfo.donor_message ? (
                  <Box
                    data-testid="donation-donor-message"
                    sx={{
                      textAlign: 'left',
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? theme.palette.divider : '#E9ECF2'}`,
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF',
                    }}
                  >
                    <Typography
                      fontSize={11}
                      fontWeight={600}
                      color={isDark ? theme.palette.text.secondary : '#666'}
                      letterSpacing={0.4}
                      textTransform='uppercase'
                      mb={0.5}
                    >
                      {t('success.donorMessageLabel', { defaultValue: 'Your message' })}
                    </Typography>
                    <Typography
                      fontSize={13.5}
                      fontStyle='italic'
                      color={theme.palette.text.primary}
                      sx={{ lineHeight: 1.5 }}
                    >
                      &ldquo;{contributionInfo.donor_message}&rdquo;
                    </Typography>
                  </Box>
                ) : null}

                {/* Campaign progress — merchant-controlled via show_progress */}
                {contributionInfo.show_progress &&
                contributionInfo.progress_percent != null &&
                contributionInfo.goal_amount != null ? (
                  <Box
                    data-testid="donation-campaign-progress"
                    sx={{
                      textAlign: 'left',
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? 'rgba(204,255,0,0.25)' : 'rgba(10,10,10,0.08)'}`,
                      bgcolor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.10)',
                    }}
                  >
                    <Box display='flex' alignItems='center' justifyContent='space-between' mb={0.75}>
                      <Typography
                        fontSize={11.5}
                        fontWeight={700}
                        color={isDark ? '#CCFF00' : theme.palette.text.primary}
                        letterSpacing={0.3}
                        textTransform='uppercase'
                      >
                        {t('success.campaignProgress', { defaultValue: 'Campaign progress' })}
                      </Typography>
                      <Typography fontSize={12} fontWeight={700} color={theme.palette.text.primary}>
                        {contributionInfo.progress_percent}%
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        height: 6,
                        borderRadius: 999,
                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,10,0.08)',
                        overflow: 'hidden',
                        mb: 0.75,
                      }}
                    >
                      <Box
                        sx={{
                          width: `${contributionInfo.progress_percent}%`,
                          height: '100%',
                          borderRadius: 999,
                          bgcolor: '#CCFF00',
                          transition: 'width 400ms ease-out',
                        }}
                      />
                    </Box>
                    <Typography fontSize={11.5} color={theme.palette.text.secondary}>
                      {t('success.campaignRaised', {
                        raised: (contributionInfo.raised_amount ?? 0).toLocaleString(),
                        goal: (contributionInfo.goal_amount ?? 0).toLocaleString(),
                        currency: contributionInfo.campaign_currency || 'USD',
                        defaultValue: `${(contributionInfo.raised_amount ?? 0).toLocaleString()} of ${(contributionInfo.goal_amount ?? 0).toLocaleString()} ${contributionInfo.campaign_currency || 'USD'} raised`,
                      })}
                      {contributionInfo.show_supporters && contributionInfo.supporters_count
                        ? ` · ${t('success.campaignSupportersCount', {
                            count: contributionInfo.supporters_count,
                            defaultValue: `${contributionInfo.supporters_count} supporter${contributionInfo.supporters_count === 1 ? '' : 's'}`,
                          })}`
                        : ''}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            )}

            {/* Paid-at timestamp — appears only when `paidAt` prop is set.
                Used on the "already-paid revisit" success card so merchants
                can see when the customer actually settled. */}
            {paidAtFormatted ? (
              <Box
                data-testid="paid-timestamp"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  bgcolor: isDark ? 'rgba(18, 183, 106, 0.12)' : '#F0FDF4',
                  color: isDark ? '#4ADE80' : '#12B76A',
                  border: `1px solid ${isDark ? 'rgba(74, 222, 128, 0.25)' : '#BBF7D0'}`,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '999px',
                  fontSize: 12,
                  fontWeight: 500,
                  mb: 2.5,
                }}
              >
                <Icon icon="mdi:clock-check-outline" width={13} />
                <span>
                  {t('success.paidWhen', {
                    relative: paidAtFormatted.relative,
                    absolute: paidAtFormatted.absolute,
                    defaultValue: `Paid ${paidAtFormatted.relative} • ${paidAtFormatted.absolute}`,
                  })}
                </span>
              </Box>
            ) : null}

            {/* Transaction ID Box - prominent when no email */}
            {transactionId && (
              <Box
                sx={{
                  border: `1px solid ${isDark ? theme.palette.divider : '#E9ECF2'}`,
                  borderRadius: '10px',
                  p: 2,
                  mb: 2,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
                }}
                data-testid="transaction-box"
              >
                <Typography
                  fontSize={11}
                  fontWeight={600}
                  color={isDark ? theme.palette.text.secondary : '#666'}
                  
                  letterSpacing={0.5}
                  mb={0.5}
                >
                  {t('success.transactionId')}
                </Typography>
                <Box display='flex' alignItems='center' justifyContent='space-between'>
                  <Typography
                    fontWeight={600}
                    fontSize={15}
                    color={theme.palette.text.primary}
                    
                    data-testid="transaction-id"
                  >
                    #{transactionId}
                  </Typography>
                  <Tooltip title={t('common.copy')}>
                    <IconButton
                      size='small'
                      onClick={handleCopyTransactionId}
                      data-testid="copy-transaction-btn"
                      sx={{
                        bgcolor: isDark ? '#2a2a4a' : '#E9ECF2',
                        p: 0.75,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
                      }}
                    >
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                {!email && (
                  <Typography
                    fontSize={11}
                    color={isDark ? theme.palette.text.secondary : '#888'}
                    
                    mt={1}
                  >
                    {t('success.saveForRecords')}
                  </Typography>
                )}
              </Box>
            )}

            {/* Email confirmation notice */}
            {email && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={0.5} 
                mb={2}
              >
                <Icon icon="mdi:email-check" width={16} color="#12B76A" />
                <Typography
                  fontSize={13}
                  
                  color={isDark ? theme.palette.text.secondary : '#666'}
                >
                  {t('success.confirmationSent', { email })}
                </Typography>
              </Box>
            )}

            {/* Redirect countdown */}
            {isAutoRedirecting && redirectUrl && (
              <Box 
                display='flex' 
                alignItems='center' 
                justifyContent='center' 
                gap={1} 
                mb={2}
                data-testid="redirect-countdown"
              >
                <CircularProgress size={16} sx={{ color: theme.palette.primary.main }} />
                <Typography
                  fontSize={13}
                  
                  color={isDark ? theme.palette.text.secondary : '#515151'}
                >
                  {merchantName 
                    ? t('success.redirectingTo', { merchant: merchantName })
                    : t('success.redirectingIn', { seconds: countdown })
                  }
                </Typography>
              </Box>
            )}

            {/* CTA Buttons */}
            {redirectUrl ? (
              // With redirect: Show "Return to Merchant" button
              <Box>
                <Button
                  fullWidth
                  variant='contained'
                  onClick={handleRedirect}
                  data-testid="return-btn"
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    textTransform: 'none',
                    borderRadius: 30,
                    py: 1.75,
                    fontSize: '15px',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: (theme.palette.primary as any).hover || theme.palette.primary.dark
                    }
                  }}
                  endIcon={<Icon icon="mdi:arrow-right" width={18} />}
                >
                  {merchantName 
                    ? t('success.returnTo', { merchant: merchantName })
                    : t('success.returnTo', { merchant: 'Merchant' })
                  }
                </Button>
                <Typography
                  fontSize={12}
                  color={isDark ? theme.palette.text.secondary : '#888'}
                  
                  mt={1.5}
                  sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={handleRedirect}
                >
                  {t('success.clickIfNotRedirected')}
                </Typography>
              </Box>
            ) : linkType === 'contribution' && contributionInfo ? (
              // Donation success — offer Share campaign + Back to campaign
              // as first-class actions. Skip the generic "Done" button — a
              // completed donation is a moment to encourage advocacy, not
              // a modal to dismiss.
              <Box display='flex' flexDirection='column' gap={1.25}>
                <Button
                  fullWidth
                  variant='contained'
                  data-testid="donation-share-btn"
                  onClick={async () => {
                    const url = contributionInfo?.campaign_pay_url || (typeof window !== 'undefined' ? window.location.href : '');
                    const campaign = contributionInfo?.campaign_title || 'this campaign';
                    const shareText = t('success.donationShareText', {
                      campaign,
                      defaultValue: `I just donated to ${campaign} on Dynopay — join me!`,
                    });
                    try {
                      if (typeof navigator !== 'undefined' && (navigator as any).share) {
                        await (navigator as any).share({ title: campaign, text: shareText, url });
                        return;
                      }
                    } catch { /* user cancelled */ }
                    // Fallback → clipboard
                    try {
                      await copyToClipboard(`${shareText} ${url}`.trim());
                      setCopySnackbar(true);
                    } catch { /* ignore */ }
                  }}
                  startIcon={<Icon icon="mdi:share-variant" width={18} />}
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.primary.contrastText,
                    textTransform: 'none',
                    borderRadius: 30,
                    py: 1.75,
                    fontSize: '15px',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: (theme.palette.primary as any).hover || theme.palette.primary.dark
                    }
                  }}
                >
                  {t('success.shareCampaign', { defaultValue: 'Share this campaign' })}
                </Button>
                {contributionInfo?.campaign_pay_url ? (
                  <Button
                    fullWidth
                    variant='outlined'
                    data-testid="donation-back-btn"
                    onClick={() => {
                      const url = contributionInfo?.campaign_pay_url;
                      if (url) window.location.href = url;
                    }}
                    startIcon={<Icon icon="mdi:arrow-left" width={18} />}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 30,
                      py: 1.5,
                      fontSize: '14px',
                      fontWeight: 600,
                      borderColor: isDark ? 'rgba(255,255,255,0.24)' : 'rgba(10,10,10,0.16)',
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: isDark ? 'rgba(204,255,0,0.06)' : 'rgba(204,255,0,0.10)',
                      },
                    }}
                  >
                    {t('success.backToCampaign', { defaultValue: 'Back to campaign' })}
                  </Button>
                ) : null}
              </Box>
            ) : (
              // Without redirect: Show "Done" button
              <Button
                fullWidth
                variant='contained'
                onClick={handleDone}
                data-testid="done-btn"
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  textTransform: 'none',
                  borderRadius: 30,
                  py: 1.75,
                  fontSize: '15px',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: (theme.palette.primary as any).hover || theme.palette.primary.dark
                  }
                }}
              >
                {t('success.done')}
              </Button>
            )}

            {/* Security badge */}
            <Box 
              display='flex' 
              alignItems='center' 
              justifyContent='center' 
              gap={0.5}
              mt={2}
            >
              <Icon icon="mdi:lock" width={14} color={theme.palette.primary.main} />
              <Typography
                fontSize={12}
                
                color={theme.palette.primary.main}
                fontWeight={500}
              >
                {t('checkout.securePayment')}
              </Typography>
            </Box>
          </Box>
        </Card>

        <Snackbar
          open={copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(false)}
          message={t('checkout.copied')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    )
  }

  // For crypto type, if not confirmed yet, don't show pending state
  // Crypto either succeeds or the user is still on the payment screen
  if (type === 'crypto' && !isTrue) {
    // Return null or a minimal waiting state for crypto
    // In practice, crypto flow handles its own waiting state in CryptoTransfer component
    return null
  }

  // Pending/Waiting state - transfer expected (BANK TRANSFERS ONLY)
  return (
    <Box
      display='flex'
      alignItems='center'
      justifyContent='center'
      bgcolor={isDark ? theme.palette.background.default : '#f6f8fc'}
      px={2}
      minHeight={'calc(100vh - 340px)'}
    >
      <Card
        data-testid="pending-card"
        sx={{
          width: 400,
          borderRadius: '16px',
          boxShadow: isDark 
            ? '0 45px 65px rgba(0, 0, 0, 0.3)' 
            : '0 45px 65px rgba(13, 3, 35, 0.06)',
          overflow: 'hidden',
          textAlign: 'center',
          backgroundColor: theme.palette.background.paper
        }}
      >
        {/* Pending Icon */}
        <Box
          sx={{
            py: 3,
            position: 'relative'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              bottom: '0',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '400px',
              height: '530px',
              background:
                'radial-gradient(circle, rgba(251, 188, 5, 0.27) 0%, rgba(251, 188, 5, 0.0) 70%)',
              zIndex: 1
            }}
          />
          <AccessTimeOutlinedIcon
            sx={{
              fontSize: 50,
              color: '#FBBC05',
              position: 'relative',
              zIndex: 2
            }}
          />
        </Box>

        {/* Content */}
        <Box px={4} pb={4}>
          <Typography
            variant='h6'
            fontWeight={600}
            color={theme.palette.text.primary}
            mb={1}
            
          >
            {t('success.transferExpected')}
          </Typography>

          <Typography
            variant='body2'
            color={isDark ? theme.palette.text.secondary : '#515151'}
            mb={3}
            
          >
            {t('success.transferPending')}
          </Typography>

          {/* Transaction ID for pending state */}
          {transactionId && (
            <Box
              sx={{
                border: `1px solid ${isDark ? theme.palette.divider : '#E9ECF2'}`,
                borderRadius: '10px',
                p: 2,
                mb: 3,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFF'
              }}
            >
              <Box display='flex' alignItems='center' justifyContent='space-between'>
                <Box textAlign='left'>
                  <Typography
                    fontSize={10}
                    fontWeight={600}
                    color={isDark ? theme.palette.text.secondary : '#666'}
                    
                    letterSpacing={0.5}
                  >
                    {t('success.transactionId')}
                  </Typography>
                  <Typography
                    fontWeight={500}
                    fontSize={13}
                    color={theme.palette.text.primary}
                    
                  >
                    #{transactionId}
                  </Typography>
                </Box>
                <Tooltip title={t('common.copy')}>
                  <IconButton
                    size='small'
                    onClick={handleCopyTransactionId}
                    sx={{
                      bgcolor: isDark ? '#2a2a4a' : '#E9ECF2',
                      p: 0.75,
                      borderRadius: '6px',
                      '&:hover': { bgcolor: isDark ? '#3a3a5a' : '#E0E7FF' }
                    }}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}

          {/* Done button for pending state */}
          <Button
            fullWidth
            variant='outlined'
            onClick={handleDone}
            sx={{
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              textTransform: 'none',
              borderRadius: 30,
              py: 1.5,
              fontWeight: 500,
              '&:hover': {
                backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : '#EEF2FF',
                borderColor: theme.palette.primary.main
              }
            }}
          >
            {t('success.done')}
          </Button>
        </Box>
      </Card>

      <Snackbar
        open={copySnackbar}
        autoHideDuration={2000}
        onClose={() => setCopySnackbar(false)}
        message={t('checkout.copied')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
