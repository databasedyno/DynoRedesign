import axiosBaseApi from '@/axiosConfig'

import paymentAuth from '@/Components/Page/Common/HOC/paymentAuth'
import { createEncryption } from '@/helpers'
import { paymentTypes } from '@/utils/enums'
import {
  CommonApiRes,
  CommonDetails,
  currencyData
} from '@/utils/types/paymentTypes'
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Snackbar,
  Alert,
  AlertTitle
} from '@mui/material'
import React, { useEffect, useState, useCallback } from 'react'
import 'react-credit-cards-2/dist/es/styles-compiled.css'
import { useDispatch } from 'react-redux'
import { walletState } from '../../utils/types/paymentTypes'

import { useRouter } from 'next/router'
import { TOAST_SHOW } from '@/Redux/Actions/ToastAction'
import jwt from 'jsonwebtoken'
import ProgressBar from '@/Components/UI/ProgressBar'

import TransferExpectedCard from '@/Components/UI/TransferExpectedCard/Index'
import CopyIcon from '@/assets/Icons/CopyIcon'
import { Icon } from '@iconify/react'
import BitCoinGreenIcon from '@/assets/Icons/BitCoinGreenIcon'
import Logo from '@/assets/Icons/Logo'
import CryptoTransfer from '@/Components/Page/Pay3Components/cryptoTransfer'
import BankTransferCompo from '@/Components/Page/Pay3Components/bankTransferCompo'
import DonationCampaign, { DonationCampaignData } from '@/Components/Page/Pay3Components/donationCampaign'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import Image from 'next/image'
// Flag icon imports - International
import USDIcon from '../../assets/Icons/flag/USD.png'
import EURIcon from '../../assets/Icons/flag/EUR.png'
import GBPIcon from '../../assets/Icons/flag/GBP.png'
import AUDIcon from '../../assets/Icons/flag/AUD.png'
import CADIcon from '../../assets/Icons/flag/CAD.png'
import CHFIcon from '../../assets/Icons/flag/CHF.png'
import CNYIcon from '../../assets/Icons/flag/CNY.png'
import JPYIcon from '../../assets/Icons/flag/JPY.png'
import HKDIcon from '../../assets/Icons/flag/HKD.png'
import NZDIcon from '../../assets/Icons/flag/NZD.png'
import SGDIcon from '../../assets/Icons/flag/SGD.png'
// Flag icon imports - Latin America
import BRLIcon from '../../assets/Icons/flag/BRL.png'
import ARSIcon from '../../assets/Icons/flag/ARS.png'
import COPIcon from '../../assets/Icons/flag/COP.png'
import CLPIcon from '../../assets/Icons/flag/CLP.png'
import PENIcon from '../../assets/Icons/flag/PEN.png'
import MXNIcon from '../../assets/Icons/flag/MXN.png'
import VESIcon from '../../assets/Icons/flag/VES.png'
import UYUIcon from '../../assets/Icons/flag/UYU.png'
// Flag icon imports - Africa
import NGNIcon from '../../assets/Icons/flag/NGN.png'
import ZARIcon from '../../assets/Icons/flag/ZAR.png'
import KESIcon from '../../assets/Icons/flag/KES.png'
import GHSIcon from '../../assets/Icons/flag/GHS.png'
import TZSIcon from '../../assets/Icons/flag/TZS.png'
import XAFIcon from '../../assets/Icons/flag/XAF.png'
import XOFIcon from '../../assets/Icons/flag/XOF.png'
import EGPIcon from '../../assets/Icons/flag/EGP.png'
import MADIcon from '../../assets/Icons/flag/MAD.png'
import UGXIcon from '../../assets/Icons/flag/UGX.png'
import RWFIcon from '../../assets/Icons/flag/RWF.png'
import ETBIcon from '../../assets/Icons/flag/ETB.png'
import ZMWIcon from '../../assets/Icons/flag/ZMW.png'
import BWPIcon from '../../assets/Icons/flag/BWP.png'
import MURIcon from '../../assets/Icons/flag/MUR.png'
import AOAIcon from '../../assets/Icons/flag/AOA.png'
import MZNIcon from '../../assets/Icons/flag/MZN.png'
import CDFIcon from '../../assets/Icons/flag/CDF.png'
import { useTranslation } from 'react-i18next'
import { formatWithSeparators } from '@/utils/currencyFormat'

// Types for enhanced checkout data
interface FeeInfo {
  processing_fee: number
  fee_payer: 'customer' | 'merchant'
  estimated_processing_fee?: number
  fees_pending_crypto_selection?: boolean
  subtotal?: number
  tax_amount?: number
  total_amount?: number
}

interface TaxInfo {
  rate: number
  amount: number
  country: string
  type: string
}

interface ExpiryInfo {
  countdown: string
  expires_at: string
}

interface MerchantInfo {
  name: string
  company_logo: string | null
}

export const currencyOptions = [
  // International
  { code: 'USD', labelKey: 'currency.USD', icon: <Image src={USDIcon} alt='USD' width={20} height={20} />, currency: 'USD', symbol: '$', decimals: 2 },
  { code: 'EUR', labelKey: 'currency.EUR', icon: <Image src={EURIcon} alt='EUR' width={20} height={20} />, currency: 'EUR', symbol: '€', decimals: 2 },
  { code: 'GBP', labelKey: 'currency.GBP', icon: <Image src={GBPIcon} alt='GBP' width={20} height={20} />, currency: 'GBP', symbol: '£', decimals: 2 },
  { code: 'AUD', labelKey: 'currency.AUD', icon: <Image src={AUDIcon} alt='AUD' width={20} height={20} />, currency: 'AUD', symbol: 'A$', decimals: 2 },
  { code: 'CAD', labelKey: 'currency.CAD', icon: <Image src={CADIcon} alt='CAD' width={20} height={20} />, currency: 'CAD', symbol: 'C$', decimals: 2 },
  { code: 'CHF', labelKey: 'currency.CHF', icon: <Image src={CHFIcon} alt='CHF' width={20} height={20} />, currency: 'CHF', symbol: 'Fr', decimals: 2 },
  { code: 'CNY', labelKey: 'currency.CNY', icon: <Image src={CNYIcon} alt='CNY' width={20} height={20} />, currency: 'CNY', symbol: '¥', decimals: 2 },
  { code: 'JPY', labelKey: 'currency.JPY', icon: <Image src={JPYIcon} alt='JPY' width={20} height={20} />, currency: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'HKD', labelKey: 'currency.HKD', icon: <Image src={HKDIcon} alt='HKD' width={20} height={20} />, currency: 'HKD', symbol: 'HK$', decimals: 2 },
  { code: 'NZD', labelKey: 'currency.NZD', icon: <Image src={NZDIcon} alt='NZD' width={20} height={20} />, currency: 'NZD', symbol: 'NZ$', decimals: 2 },
  { code: 'SGD', labelKey: 'currency.SGD', icon: <Image src={SGDIcon} alt='SGD' width={20} height={20} />, currency: 'SGD', symbol: 'S$', decimals: 2 },
  // Latin America
  { code: 'BRL', labelKey: 'currency.BRL', icon: <Image src={BRLIcon} alt='BRL' width={20} height={20} />, currency: 'BRL', symbol: 'R$', decimals: 2 },
  { code: 'ARS', labelKey: 'currency.ARS', icon: <Image src={ARSIcon} alt='ARS' width={20} height={20} />, currency: 'ARS', symbol: '$', decimals: 2 },
  { code: 'COP', labelKey: 'currency.COP', icon: <Image src={COPIcon} alt='COP' width={20} height={20} />, currency: 'COP', symbol: '$', decimals: 0 },
  { code: 'CLP', labelKey: 'currency.CLP', icon: <Image src={CLPIcon} alt='CLP' width={20} height={20} />, currency: 'CLP', symbol: '$', decimals: 0 },
  { code: 'PEN', labelKey: 'currency.PEN', icon: <Image src={PENIcon} alt='PEN' width={20} height={20} />, currency: 'PEN', symbol: 'S/', decimals: 2 },
  { code: 'MXN', labelKey: 'currency.MXN', icon: <Image src={MXNIcon} alt='MXN' width={20} height={20} />, currency: 'MXN', symbol: '$', decimals: 2 },
  { code: 'VES', labelKey: 'currency.VES', icon: <Image src={VESIcon} alt='VES' width={20} height={20} />, currency: 'VES', symbol: 'Bs', decimals: 2 },
  { code: 'UYU', labelKey: 'currency.UYU', icon: <Image src={UYUIcon} alt='UYU' width={20} height={20} />, currency: 'UYU', symbol: '$U', decimals: 2 },
  // Africa
  { code: 'NGN', labelKey: 'currency.NGN', icon: <Image src={NGNIcon} alt='NGN' width={20} height={20} />, currency: 'NGN', symbol: '₦', decimals: 2 },
  { code: 'ZAR', labelKey: 'currency.ZAR', icon: <Image src={ZARIcon} alt='ZAR' width={20} height={20} />, currency: 'ZAR', symbol: 'R', decimals: 2 },
  { code: 'KES', labelKey: 'currency.KES', icon: <Image src={KESIcon} alt='KES' width={20} height={20} />, currency: 'KES', symbol: 'KSh', decimals: 2 },
  { code: 'GHS', labelKey: 'currency.GHS', icon: <Image src={GHSIcon} alt='GHS' width={20} height={20} />, currency: 'GHS', symbol: '₵', decimals: 2 },
  { code: 'TZS', labelKey: 'currency.TZS', icon: <Image src={TZSIcon} alt='TZS' width={20} height={20} />, currency: 'TZS', symbol: 'TSh', decimals: 0 },
  { code: 'XAF', labelKey: 'currency.XAF', icon: <Image src={XAFIcon} alt='XAF' width={20} height={20} />, currency: 'XAF', symbol: 'FCFA', decimals: 0 },
  { code: 'XOF', labelKey: 'currency.XOF', icon: <Image src={XOFIcon} alt='XOF' width={20} height={20} />, currency: 'XOF', symbol: 'CFA', decimals: 0 },
  { code: 'EGP', labelKey: 'currency.EGP', icon: <Image src={EGPIcon} alt='EGP' width={20} height={20} />, currency: 'EGP', symbol: 'E£', decimals: 2 },
  { code: 'MAD', labelKey: 'currency.MAD', icon: <Image src={MADIcon} alt='MAD' width={20} height={20} />, currency: 'MAD', symbol: 'DH', decimals: 2 },
  { code: 'UGX', labelKey: 'currency.UGX', icon: <Image src={UGXIcon} alt='UGX' width={20} height={20} />, currency: 'UGX', symbol: 'USh', decimals: 0 },
  { code: 'RWF', labelKey: 'currency.RWF', icon: <Image src={RWFIcon} alt='RWF' width={20} height={20} />, currency: 'RWF', symbol: 'FRw', decimals: 0 },
  { code: 'ETB', labelKey: 'currency.ETB', icon: <Image src={ETBIcon} alt='ETB' width={20} height={20} />, currency: 'ETB', symbol: 'Br', decimals: 2 },
  { code: 'ZMW', labelKey: 'currency.ZMW', icon: <Image src={ZMWIcon} alt='ZMW' width={20} height={20} />, currency: 'ZMW', symbol: 'ZK', decimals: 2 },
  { code: 'BWP', labelKey: 'currency.BWP', icon: <Image src={BWPIcon} alt='BWP' width={20} height={20} />, currency: 'BWP', symbol: 'P', decimals: 2 },
  { code: 'MUR', labelKey: 'currency.MUR', icon: <Image src={MURIcon} alt='MUR' width={20} height={20} />, currency: 'MUR', symbol: '₨', decimals: 2 },
  { code: 'AOA', labelKey: 'currency.AOA', icon: <Image src={AOAIcon} alt='AOA' width={20} height={20} />, currency: 'AOA', symbol: 'Kz', decimals: 2 },
  { code: 'MZN', labelKey: 'currency.MZN', icon: <Image src={MZNIcon} alt='MZN' width={20} height={20} />, currency: 'MZN', symbol: 'MT', decimals: 2 },
  { code: 'CDF', labelKey: 'currency.CDF', icon: <Image src={CDFIcon} alt='CDF' width={20} height={20} />, currency: 'CDF', symbol: 'FC', decimals: 2 },
]

const Payment = () => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const router = useRouter()
  const dispatch = useDispatch()
  const { t, i18n } = useTranslation('common')
  
  const [paymentType, setPaymentType] = useState(paymentTypes.CARD)
  const [payLoading, setPayloading] = useState(false)
  const [paymentMode, setPaymentMode] = useState('payment')
  const [allowedModes, setAllowedModes] = useState<any[]>([])
  const [accountDetails, setAccountDetails] = useState<CommonDetails>()
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [currencyRates, setCurrencyRates] = useState<currencyData>()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [activeStep, setActiveStep] = useState<number>(() => {
    // Restore activeStep from sessionStorage on mount (for language change persistence).
    // HARDENED (session 14d): JSON.parse is guarded — a legacy/corrupt value here
    // (e.g. a plain string written by an older build) used to THROW inside the
    // useState initializer and crash the whole checkout with "Something went
    // wrong" on EVERY load (sessionStorage survives refreshes in the same tab).
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('payment_active_step');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Only restore if saved within the last 30 minutes
          if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.timestamp === 'number' &&
            Date.now() - parsed.timestamp < 30 * 60 * 1000 &&
            Number.isInteger(parsed.step) &&
            parsed.step >= 0 &&
            parsed.step <= 2
          ) {
            return parsed.step;
          }
        }
      } catch (_e) {
        try { sessionStorage.removeItem('payment_active_step'); } catch (_e2) { /* noop */ }
      }
    }
    return 0;
  })
  const [tokenData, setTokenData] = useState({ email: '' })
  const [walletState, setWalletState] = useState<walletState>({
    amount: 0,
    currency: 'USD'
  })
  const [transferMethod, setTransferMethod] = useState(() => {
    // Restore transferMethod from sessionStorage on mount.
    // HARDENED (session 14d): guarded JSON.parse — an older build stored this key
    // as a PLAIN STRING (e.g. "crypto"), which made JSON.parse throw and crash
    // the checkout persistently for returning visitors (user-reported bug).
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('payment_transfer_method');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.timestamp === 'number' &&
            Date.now() - parsed.timestamp < 30 * 60 * 1000 &&
            typeof parsed.method === 'string'
          ) {
            return parsed.method;
          }
        }
      } catch (_e) {
        try { sessionStorage.removeItem('payment_transfer_method'); } catch (_e2) { /* noop */ }
      }
    }
    return '';
  })
  const [loading, setLoading] = useState(true)
  // Gates the very first render until pay/getData resolves — prevents the
  // checkout form (or a sessionStorage-restored stepper) from flashing with
  // a zero/dust amount before an already-paid link flips to the success card.
  const [initialLoading, setInitialLoading] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isBank, setIsBank] = useState()
  const [feePayer, setFeePayer] = useState<string>('')
  const [linkId, setLinkId] = useState<string>('')
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)

  // ─── Already-completed payment view ──────────────────────────────
  // When the customer revisits a link that has already been paid, the
  // backend returns { payment_completed: true, base_amount, base_currency,
  // paid_amount, paid_currency }. We store those here and render a dedicated
  // success card BEFORE the stepper — otherwise the stepper still shows the
  // fresh checkout form and the payer sees a misleading "small remainder".
  const [alreadyPaid, setAlreadyPaid] = useState<{
    base_amount: number;
    base_currency: string;
    paid_amount: number;
    paid_currency: string;
    paid_at: string | null;
  } | null>(null)

  // ─── Donation campaign view ──────────────────────────────────────
  // When getData returns { is_donation: true, donation: {...} } the link is a
  // multi-use crowdfunding campaign. We render DonationCampaign instead of the
  // stepper; "Donate" calls pay/startDonation which spawns a per-donor payment
  // session, then we push /pay?d=<child-ref> and the normal flow takes over.
  const [donationData, setDonationData] = useState<DonationCampaignData | null>(null)
  const [donationRef, setDonationRef] = useState<string>('')
  const [donateSubmitting, setDonateSubmitting] = useState(false)

  // Save activeStep to sessionStorage when it changes (for language change persistence)
  useEffect(() => {
    if (typeof window !== 'undefined' && activeStep > 0) {
      sessionStorage.setItem('payment_active_step', JSON.stringify({
        step: activeStep,
        timestamp: Date.now()
      }));
    }
  }, [activeStep]);

  // Save transferMethod to sessionStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && transferMethod) {
      sessionStorage.setItem('payment_transfer_method', JSON.stringify({
        method: transferMethod,
        timestamp: Date.now()
      }));
    }
  }, [transferMethod]);

  // Enhanced checkout state variables
  const [description, setDescription] = useState<string>('')
  const [orderReference, setOrderReference] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [feeInfo, setFeeInfo] = useState<FeeInfo | null>(null)
  const [taxInfo, setTaxInfo] = useState<TaxInfo | null>(null)
  const [expiryInfo, setExpiryInfo] = useState<ExpiryInfo | null>(null)
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null)
  const [countdown, setCountdown] = useState<string>('')
  const [copySnackbar, setCopySnackbar] = useState(false)

  // Incomplete payment state
  const [incompletePayment, setIncompletePayment] = useState<{
    exists: boolean;
    currency: string;
    address: string;
    pending_amount: string;
    remaining_minutes: number;
    qr_code?: string;
    memo?: string;
    destination_tag?: string;
  } | null>(null)
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
    'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
    'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD', 'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'
  ])

  // Countdown timer effect
  useEffect(() => {
    if (!expiryInfo?.expires_at) return

    const updateCountdown = () => {
      const now = new Date().getTime()
      const expiry = new Date(expiryInfo.expires_at).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setCountdown('Expired')
        // Dispatch a toast to notify user
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t('checkout.paymentLinkExpired', { defaultValue: 'This payment link has expired. Please contact the merchant for a new link.' }),
            severity: 'warning'
          }
        })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      const parts = []
      if (days > 0) parts.push(`${days}${t('checkout.days')}`)
      if (hours > 0 || days > 0) parts.push(`${hours}${t('checkout.hours')}`)
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}${t('checkout.minutes')}`)
      parts.push(`${seconds}${t('checkout.seconds')}`)

      setCountdown(parts.join(':'))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [expiryInfo, t])

  // Auto-refresh remaining time countdown for incomplete payment
  useEffect(() => {
    if (!incompletePayment) return
    
    const interval = setInterval(() => {
      setIncompletePayment(prev => {
        if (!prev) return null
        const newRemaining = prev.remaining_minutes - 1
        
        if (newRemaining <= 0) {
          // Grace period expired - refresh to unlock currencies
          window.location.reload()
          return null
        }
        
        return { ...prev, remaining_minutes: newRemaining }
      })
    }, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [incompletePayment])

  useEffect(() => {
    if (
      paymentType === paymentTypes.GOOGLE_PAY ||
      paymentType === paymentTypes.APPLE_PAY
    ) {
      initiateGoogleApplyPayTransfer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType])

  useEffect(() => {
    // Wait for Next.js to parse the query string — router.query is {} on the
    // first hydration render even when a ?d= param is present in the URL.
    if (!router.isReady) return
    if (router.query?.d) {
      getQueryData()
    } else {
      setLoading(false)
      setInitialLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query])

  const getQueryData = async () => {
    try {
      const query_data = router.query.d
      
      // Clear any stale token from previous payment sessions
      // This prevents configured-currencies and other calls from using a wrong JWT
      localStorage.removeItem('token')

      // Get customer's timezone for tax calculation
      const customerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      
      const {
        data: { data }
      }: { data: any } = await axiosBaseApi.post('pay/getData', {
        data: query_data,
        timezone: customerTimezone,
        language: i18n.language
      })

      // Check if payment is already completed (Direct Pay edge case
      // AND revisit-after-paid case — the customer opened the link a second
      // time after the payment settled).
      if (data?.payment_completed) {
        // Preserve the ORIGINAL base fiat amount for the success card —
        // do NOT set walletState.amount to the crypto amount, otherwise the
        // stepper (if ever rendered) shows "Total 0.01" (dust) instead of
        // "$10 USD paid". The rendered success card uses `alreadyPaid` directly.
        const baseAmt = Number(data.base_amount ?? data.amount ?? 0);
        const baseCur = data.base_currency || '';
        setAlreadyPaid({
          base_amount: baseAmt,
          base_currency: baseCur,
          paid_amount: Number(data.paid_amount || 0),
          paid_currency: data.paid_currency || '',
          paid_at: data.paid_at || null,
        });
        setWalletState({ amount: baseAmt, currency: baseCur });
        setIsSuccess(true);
        // Clear stale stepper persistence so a revisit in the same tab never
        // restores the checkout stepper for a paid link (the alreadyPaid
        // render below hardcodes the "Done" stepper state itself).
        sessionStorage.removeItem('payment_active_step');
        sessionStorage.removeItem('payment_transfer_method');
        if (data.redirect_url) {
          setRedirectUrl(data.redirect_url);
        }
        setLoading(false);
        setInitialLoading(false);
        return;
      }

      // ─── Donation campaign link ───────────────────────────────────
      // Multi-use crowdfunding parent: render the campaign view. The donor
      // picks an amount there; pay/startDonation spawns their own payment
      // session and we re-enter this flow with the child reference.
      if (data?.is_donation && data?.donation) {
        setDonationData(data.donation as DonationCampaignData)
        setDonationRef(String(query_data))
        if (data.merchant) {
          setMerchantInfo({
            name: data.merchant.name || data.merchant.company_name || '',
            company_logo: data.merchant.company_logo || null
          })
        }
        // A fresh campaign visit invalidates any stale per-payment stepper state
        sessionStorage.removeItem('payment_active_step')
        sessionStorage.removeItem('payment_transfer_method')
        setLoading(false)
        setInitialLoading(false)
        return
      }
      // Leaving a campaign for a child payment (or any non-donation link):
      // make sure the campaign view unmounts.
      setDonationData(null)
      setDonateSubmitting(false)

      setWalletState({
        amount: Number(data.amount) || 0,
        currency: data.base_currency || 'USD'
      })
      setPaymentMode(data.payment_mode)
      if (data?.payment_mode === 'createLink') {
        setAllowedModes(data?.allowedModes?.split(','))
      }

      localStorage.setItem('token', data.token)
      const tempToken: any = jwt.decode(data.token)
      setTokenData(tempToken)
      setFeePayer(data.fee_payer || '')
      setLinkId(tempToken?.transaction_id || '')
      setRedirectUrl(data.redirect_url || null)

      // Check for incomplete payment
      if (data.incomplete_payment?.exists) {
        const ip = data.incomplete_payment
        setIncompletePayment({
          exists: ip.exists,
          currency: ip.currency,
          address: ip.address,
          pending_amount: ip.pending_amount,
          remaining_minutes: ip.remaining_minutes,
          qr_code: ip.qr_code,
          memo: ip.memo || ip.tag || ip.destination_tag || ip.dt || '',
          destination_tag: ip.destination_tag || ip.tag || ip.memo || ip.dt || '',
        })
        // Lock currency selector to only show the incomplete payment currency
        setAvailableCurrencies([ip.currency])
        console.log(`[Incomplete Payment] Locked to ${ip.currency}, ${ip.remaining_minutes} mins remaining${ip.memo || ip.destination_tag || ip.tag ? `, memo/tag: ${ip.memo || ip.destination_tag || ip.tag}` : ''}`)
      }

      // Capture enhanced checkout fields from backend
      setDescription(data.description || '')
      setOrderReference(data.order_reference || '')
      setCustomerName(data.customer_name || '')
      
      if (data.fee_info) {
        setFeeInfo({
          processing_fee: data.fee_info.processing_fee || 0,
          fee_payer: data.fee_info.fee_payer || data.fee_payer || 'merchant',
          estimated_processing_fee: data.fee_info.estimated_processing_fee,
          fees_pending_crypto_selection: data.fee_info.fees_pending_crypto_selection,
          subtotal: data.fee_info.subtotal,
          tax_amount: data.fee_info.tax_amount,
          total_amount: data.fee_info.total_amount
        })
      } else if (data.fee_payer) {
        setFeeInfo({
          processing_fee: 0,
          fee_payer: data.fee_payer
        })
      }
      
      if (data.tax_info) {
        setTaxInfo({
          rate: data.tax_info.tax_rate || data.tax_info.rate || 0,
          amount: data.tax_info.tax_amount || data.tax_info.amount || 0,
          country: data.tax_info.country_name || data.tax_info.country || '',
          type: data.tax_info.tax_acronym || data.tax_info.type || 'VAT'
        })
      }
      
      if (data.expiry) {
        setExpiryInfo({
          countdown: data.expiry.countdown || '',
          expires_at: data.expiry.expires_at || ''
        })
      }
      
      if (data.merchant) {
        setMerchantInfo({
          name: data.merchant.name || data.merchant.company_name || '',
          company_logo: data.merchant.company_logo || null
        })
      }
      
      const amount = Number(data.amount)
      if (amount && data.base_currency) {
        try {
          // For initial display, get base rates without fee calculation
          // Fees will be calculated accurately when user selects crypto type
          const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
            source: data.base_currency,
            amount: amount,
            currencyList: [data.base_currency],
            fixedDecimal: false,
            // Don't pass fee_payer here - let CryptoTransfer handle accurate fee calculation
            tax_amount: data.tax_info?.tax_amount || 0
          });
          console.log('Rates response:', ratesResponse?.data);
          if (ratesResponse?.data?.data && ratesResponse.data.data[0]) {
            setCurrencyRates(ratesResponse.data.data[0]);
            console.log('Set currencyRates to:', ratesResponse.data.data[0]);
          }
        } catch (rateError: any) {
          console.log('Failed to fetch initial rates:', rateError?.message);
        }
      }
      
      setLoading(false)
      setInitialLoading(false)
    } catch (e: any) {
      setLoading(false)
      setInitialLoading(false)
      const message = e?.response?.data?.message ?? e.message
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: 'error'
        }
      })
    }
  }

  const getCurrencyRate = async (selectedCurrency: string) => {
    try {
      setLoading(true)
      console.log('Fetching rate for currency:', selectedCurrency, 'from source:', walletState?.currency)
      
      const {
        data: { data }
      } = await axiosBaseApi.post('/pay/getCurrencyRates', {
        source: walletState?.currency,
        amount: walletState?.amount,
        currencyList: [selectedCurrency],
        fixedDecimal: false,
        fee_payer: feePayer,
        tax_amount: taxInfo?.amount || 0
      })
      
      console.log('Rate response:', data)
      
      if (data && data[0]) {
        setCurrencyRates(data[0])
        setSelectedCurrency(selectedCurrency)
      } else {
        console.error('No rate data returned for', selectedCurrency)
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: `Unable to get rate for ${selectedCurrency}`,
            severity: 'warning'
          }
        })
      }
      setLoading(false)
    } catch (e: any) {
      setLoading(false)
      console.error('Rate fetch error:', e)
      const message = e?.response?.data?.message ?? e?.message ?? 'Failed to fetch currency rate'
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: 'error'
        }
      })
    }
  }

  const initiateGoogleApplyPayTransfer = async () => {
    const finalPayload = {
      paymentType,
      currency: walletState.currency,
      amount: walletState.amount
    }
    setPayloading(true)
    const res = await createEncryption(JSON.stringify(finalPayload))

    const {
      data: { data }
    }: { data: CommonApiRes } = await axiosBaseApi.post('pay/addPayment', {
      data: res
    })
    setPayloading(false)
    setAccountDetails(data)
  }

  // ─── Donation: start a contribution ────────────────────────────────
  // Spawns a per-donor payment session on the backend, then navigates to the
  // returned child reference — from there the regular checkout flow runs.
  const handleStartDonation = async (payload: {
    amount: number
    donor_name?: string
    donor_message?: string
    is_anonymous?: boolean
  }) => {
    if (donateSubmitting || !donationRef) return
    setDonateSubmitting(true)
    try {
      const { data: res }: { data: any } = await axiosBaseApi.post('pay/startDonation', {
        data: donationRef,
        ...payload
      })
      const childRef = res?.data?.d
      if (!childRef) throw new Error('No payment reference returned')
      // Fresh payment session — clear any persisted stepper state
      sessionStorage.removeItem('payment_active_step')
      sessionStorage.removeItem('payment_transfer_method')
      setInitialLoading(true)
      setDonationData(null)
      // push (not replace) so the browser Back button returns to the campaign
      router.push(`/pay?d=${childRef}`)
      // getQueryData re-runs via the router.query effect and renders checkout
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        t('donation.startError', { defaultValue: 'Unable to start your donation. Please try again.' })
      dispatch({ type: TOAST_SHOW, payload: { message, severity: 'error' } })
      setDonateSubmitting(false)
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    // Don't allow opening currency selector when incomplete payment exists
    if (incompletePayment) return
    
    if (anchorEl) {
      setAnchorEl(null)
    } else {
      setAnchorEl(event.currentTarget)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSelect = (event: React.MouseEvent, code: string) => {
    getCurrencyRate(code)
    handleClose()
  }

  const handleCopyInvoice = useCallback(async () => {
    if (orderReference) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(orderReference)
        } else {
          const textArea = document.createElement('textarea')
          textArea.value = orderReference
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        setCopySnackbar(true)
      } catch (_e) {
        const textArea = document.createElement('textarea')
        textArea.value = orderReference
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
  }, [orderReference])

  const handleCopyTransactionId = useCallback(async () => {
    if (linkId) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(linkId)
        } else {
          const textArea = document.createElement('textarea')
          textArea.value = linkId
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        setCopySnackbar(true)
      } catch (_e) {
        const textArea = document.createElement('textarea')
        textArea.value = linkId
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
  }, [linkId])

  // Calculate display values - convert all values using transfer rate when currency changed
  const transferRate = Number(currencyRates?.transferRate ?? 1)
  const displayCurrency = currencyRates?.currency ?? walletState?.currency
  
  // Convert fee breakdown values using transfer rate when a different currency is selected
  const baseSubtotal = Number(feeInfo?.subtotal ?? walletState?.amount ?? 0)
  const baseProcessingFee = Number(feeInfo?.processing_fee ?? 0)
  const baseTaxAmount = Number(taxInfo?.amount ?? 0)
  
  // Apply transfer rate to convert values to selected currency
  const subtotalAmount = baseSubtotal * transferRate
  const processingFee = baseProcessingFee * transferRate
  const taxAmount = baseTaxAmount * transferRate
  
  // Total amount should be the sum of converted values (subtotal + tax + fee if customer pays)
  const totalAmount = subtotalAmount + taxAmount + (feeInfo?.fee_payer === 'customer' ? processingFee : 0)

  // Get context-aware title
  const getTitle = () => {
    if (description) return t('checkout.title')
    if (merchantInfo?.name) return t('checkout.titleComplete')
    return t('checkout.titleCheckout')
  }

  // Get subtitle with merchant name and customer personalization
  const getSubtitle = () => {
    const greeting = customerName ? `Hi ${customerName}, ` : ''
    if (merchantInfo?.name) {
      return greeting + t('checkout.subtitle', { merchant: merchantInfo.name }).replace(/^Complete/, 'complete')
    }
    return greeting + (customerName ? t('checkout.subtitleDefault').replace(/^Complete/, 'complete') : t('checkout.subtitleDefault'))
  }

  const isOpen = Boolean(anchorEl)

  // ─── Embedded (iframe) checkout bridge ────────────────────────────
  // When rendered inside the Dynopay Embedded Checkout iframe (via embed.js),
  // notify the parent window when the payment completes so it can react /
  // redirect. The webhook remains the source of truth for fulfillment.
  const isEmbed =
    router?.query?.embed === '1' ||
    (typeof router?.asPath === 'string' && /[?&]embed=1(?:&|$)/.test(router.asPath));

  useEffect(() => {
    if (!isEmbed) return;
    if (typeof window === 'undefined' || window.parent === window.self) return;
    if (!(isSuccess || alreadyPaid)) return;
    try {
      window.parent.postMessage(
        { source: 'dynopay', v: 1, type: 'dynopay:success', paymentId: linkId || null },
        '*'
      );
      if (redirectUrl) {
        window.parent.postMessage(
          { source: 'dynopay', v: 1, type: 'dynopay:redirect', url: redirectUrl },
          '*'
        );
      }
    } catch {
      /* ignore */
    }
  }, [isEmbed, isSuccess, alreadyPaid, redirectUrl, linkId]);

  // ─── Initial fetch gate ───────────────────────────────────────────
  // Show a neutral loader until pay/getData resolves. Rendering the checkout
  // form here caused paid links to flash the old checkout (with a dust/zero
  // amount) for a few seconds before the success card appeared.
  if (initialLoading) {
    return (
      <Pay3Layout embed={isEmbed}>
        <Box
          display='flex'
          flexDirection='column'
          alignItems='center'
          justifyContent='center'
          minHeight='55vh'
          gap={2}
          data-testid="checkout-loading"
        >
          <CircularProgress size={36} sx={{ color: theme.palette.primary.main }} />
          <Typography fontSize={13.5} color={theme.palette.text.secondary}>
            {t('checkout.loading')}
          </Typography>
        </Box>
      </Pay3Layout>
    );
  }

  // ─── Already-paid revisit view ────────────────────────────────────
  // When the customer visits a link that has already been paid, render a
  // dedicated "Payment Completed" success card and short-circuit the stepper
  // so we NEVER show the checkout form again. Uses TransferExpectedCard's
  // built-in "isTrue" success layout with base + crypto amounts.
  if (alreadyPaid) {
    const cryptoStr =
      alreadyPaid.paid_amount > 0 && alreadyPaid.paid_currency
        ? `${alreadyPaid.paid_amount} ${alreadyPaid.paid_currency}`
        : '';
    const fiatStr = alreadyPaid.base_currency
      ? `${formatWithSeparators(Number(alreadyPaid.base_amount || 0), alreadyPaid.base_currency)} ${alreadyPaid.base_currency}`
      : '';
    const amountDisplay = cryptoStr && fiatStr
      ? `${cryptoStr} (≈ ${fiatStr})`
      : cryptoStr || fiatStr || '';

    return (
      <Pay3Layout embed={isEmbed}>
        <Box>
          <Box>
            <ProgressBar activeStep={2} />
            <TransferExpectedCard
              isTrue={true}
              dataUrl=""
              type="crypto"
              redirectUrl={redirectUrl}
              transactionId={linkId}
              merchantName={merchantInfo?.name}
              amount={amountDisplay}
              email={tokenData?.email}
              customerName={customerName}
              paidAt={alreadyPaid.paid_at}
            />
          </Box>
        </Box>
      </Pay3Layout>
    );
  }

  // ─── Donation campaign view ───────────────────────────────────────
  // Multi-use crowdfunding link: render the campaign card (no stepper —
  // the payment stepper starts once the donor picks an amount and their
  // own payment session begins).
  if (donationData) {
    return (
      <Pay3Layout embed={isEmbed}>
        <DonationCampaign
          donation={donationData}
          merchant={merchantInfo || null}
          submitting={donateSubmitting}
          onDonate={handleStartDonation}
        />
      </Pay3Layout>
    );
  }

  return (
    <Pay3Layout embed={isEmbed}>
      <Box>
        <Box>
          <ProgressBar activeStep={activeStep} />

          {activeStep === 0 ? (
            <Box
              display='flex'
              alignItems='flex-start'
              justifyContent='center'
              px={{ xs: 1.5, sm: 2 }}
              py={{ xs: 1, sm: 2 }}
            >
              <Paper
                elevation={0}
                data-testid="checkout-card"
                sx={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  width: '100%',
                  maxWidth: 440,
                  textAlign: 'center',
                  border: `1px solid ${theme.palette.border.main}`,
                  boxShadow: isDark 
                    ? '0 12px 40px rgba(0,0,0,0.35)' 
                    : '0 8px 32px rgba(10,10,10,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                  backgroundColor: theme.palette.background.paper,
                  transition: 'box-shadow 0.3s ease, transform 0.3s ease',
                  '&:hover': {
                    boxShadow: isDark
                      ? '0 16px 48px rgba(0,0,0,0.4)'
                      : '0 12px 40px rgba(10,10,10,0.08), 0 4px 12px rgba(0,0,0,0.06)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {/* Gradient accent bar */}
                <Box sx={{ height: '3px', background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 40%, ${theme.palette.primary.light || theme.palette.primary.main} 100%)` }} />
                <Box px={{ xs: 2, sm: 2.5 }} py={{ xs: 2, sm: 2.5 }}>
                {/* Logo Section - Merchant logo or Dynopay */}
                <Box display='flex' justifyContent='center' mb={1}>
                  {merchantInfo?.company_logo ? (
                    <Box
                      component="img"
                      src={merchantInfo.company_logo}
                      alt={merchantInfo.name || 'Merchant'}
                      sx={{
                        maxHeight: 36,
                        maxWidth: 120,
                        objectFit: 'contain'
                      }}
                      onError={(e: any) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <Logo width={36} height={42} />
                  )}
                </Box>

                {/* Incomplete Payment Warning Banner */}
                {incompletePayment && (
                  <Alert 
                    severity="warning" 
                    sx={{ 
                      mb: 2, 
                      textAlign: 'left',
                      '& .MuiAlert-message': { width: '100%' }
                    }}
                    data-testid="incomplete-payment-alert"
                  >
                    <AlertTitle sx={{ fontWeight: 600 }}>
                      {t('checkout.incompletePayment', { defaultValue: 'Incomplete Payment' })}
                    </AlertTitle>
                    <Typography variant="body2" >
                      {t('checkout.incompletePaymentDesc', { 
                        defaultValue: `You have a pending payment of ${incompletePayment.pending_amount} ${incompletePayment.currency}. Please complete it within ${incompletePayment.remaining_minutes} minutes or wait for it to expire.`,
                        amount: incompletePayment.pending_amount,
                        currency: incompletePayment.currency,
                        minutes: incompletePayment.remaining_minutes
                      })}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ mt: 1, display: 'block', wordBreak: 'break-all' }}
                      
                    >
                      {t('checkout.address', { defaultValue: 'Address' })}: {incompletePayment.address}
                    </Typography>
                    {(incompletePayment.memo || incompletePayment.destination_tag) && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          mt: 0.5, 
                          display: 'block', 
                          wordBreak: 'break-all',
                          color: '#E67E22',
                          fontWeight: 600,
                        }}
                        
                        data-testid="incomplete-payment-memo"
                      >
                        {t('checkout.memoTag', { defaultValue: 'Memo / Tag' })}: {incompletePayment.memo || incompletePayment.destination_tag}
                      </Typography>
                    )}
                  </Alert>
                )}

                {/* Context-Aware Title */}
                <Typography
                  fontWeight={700}
                  fontSize={{ xs: 17, sm: 19 }}
                  lineHeight={1.2}
                  letterSpacing='-0.3px'
                  
                  color={theme.palette.text.primary}
                  data-testid="checkout-title"
                >
                  {getTitle()}
                </Typography>

                {/* Dynamic Subtitle with Merchant Name */}
                <Typography
                  color={theme.palette.text.secondary}
                  fontWeight={400}
                  fontSize={12.5}
                  lineHeight={1.5}
                  mb={2}
                  mt={0.5}
                  
                  data-testid="checkout-subtitle"
                >
                  {getSubtitle()}
                </Typography>

                {/* Order Details Section */}
                {(description || orderReference || customerName) && (
                  <Box
                    sx={{
                      border: `1px solid ${theme.palette.border.main}`,
                      borderRadius: '12px',
                      p: 1.5,
                      mb: 1.5,
                      textAlign: 'left',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : theme.palette.action.hover,
                      transition: 'background-color 0.3s ease',
                    }}
                    data-testid="order-details-section"
                  >
                    <Typography
                      fontWeight={600}
                      fontSize={11}
                      color={theme.palette.text.secondary}
                      
                      letterSpacing={0.5}
                      mb={1}
                    >
                      {t('checkout.orderDetails')}
                    </Typography>
                    
                    {description && (
                      <Typography
                        fontWeight={500}
                        fontSize={13}
                        color={theme.palette.text.primary}
                        
                        mb={(orderReference || tokenData?.email || customerName) ? 1.5 : 0}
                      >
                        {description}
                      </Typography>
                    )}
                    
                    {customerName && (
                      <Box display='flex' alignItems='center' gap={1} mb={(orderReference || tokenData?.email) ? 1.5 : 0}>
                        <Icon icon="mdi:account-outline" width={16} color={theme.palette.text.secondary} />
                        <Typography
                          fontWeight={500}
                          fontSize={13}
                          color={theme.palette.text.primary}
                          
                          data-testid="customer-name"
                        >
                          {customerName}
                        </Typography>
                      </Box>
                    )}
                    
                    {tokenData?.email && (
                      <Box display='flex' alignItems='center' gap={1} mb={orderReference ? 1.5 : 0}>
                        <Icon icon="mdi:email-outline" width={16} color={theme.palette.text.secondary} />
                        <Typography
                          fontWeight={500}
                          fontSize={13}
                          color={theme.palette.text.primary}
                          
                          data-testid="customer-email"
                        >
                          {tokenData.email}
                        </Typography>
                      </Box>
                    )}
                    
                    {orderReference && (
                      <Box display='flex' alignItems='center' justifyContent='space-between'>
                        <Box>
                          <Typography
                            fontWeight={600}
                            fontSize={10}
                            color={isDark ? theme.palette.text.secondary : '#888'}
                            
                            letterSpacing={0.5}
                          >
                            {t('checkout.invoice')}
                          </Typography>
                          <Typography
                            fontWeight={500}
                            fontSize={13}
                            color={theme.palette.text.primary}
                            
                            data-testid="invoice-number"
                          >
                            {orderReference}
                          </Typography>
                        </Box>
                        <Tooltip title={t('checkout.copyInvoice')}>
                          <IconButton
                            size='small'
                            onClick={handleCopyInvoice}
                            data-testid="copy-invoice-btn"
                            sx={{
                              bgcolor: isDark ? 'rgba(204,255,0,0.16)' : theme.palette.action.hover,
                              p: 0.75,
                              borderRadius: '6px',
                              '&:hover': { bgcolor: isDark ? 'rgba(204,255,0,0.24)' : theme.palette.action.selected }
                            }}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Fee Breakdown Section */}
                <Box
                  alignItems='center'
                  border={`1px solid ${theme.palette.border.main}`}
                  borderRadius='12px'
                  px={1.5}
                  py={1.5}
                  sx={{ transition: 'border-color 0.3s ease' }}
                  data-testid="fee-breakdown-section"
                >
                  {/* Subtotal Row */}
                  {(feeInfo || taxInfo) && (
                    <>
                      <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                        <Typography
                          fontSize={13}
                          
                          color={theme.palette.text.secondary}
                        >
                          {t('checkout.subtotal')}
                        </Typography>
                        <Typography
                          fontSize={13}
                          
                          fontWeight={500}
                          color={theme.palette.text.primary}
                        >
                          {loading ? (
                            <Skeleton width={60} height={20} />
                          ) : (
                            `${formatWithSeparators(subtotalAmount, displayCurrency)} ${displayCurrency}`
                          )}
                        </Typography>
                      </Box>

                      {/* Processing Fee Row - Always show if fee exists */}
                      {feeInfo && feeInfo.processing_fee > 0 && (
                        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                          <Box display='flex' alignItems='center' gap={0.5}>
                            <Typography
                              fontSize={13}
                              
                              color={theme.palette.text.secondary}
                            >
                              {t('checkout.processingFee')}
                            </Typography>
                            {feeInfo.fee_payer === 'merchant' && (
                              <Icon icon="mdi:check-circle" color={theme.palette.success.main || "#12B76A"} width={14} />
                            )}
                          </Box>
                          <Box display='flex' alignItems='center' gap={0.5}>
                            <Typography
                              fontSize={13}
                              
                              fontWeight={500}
                              color={theme.palette.text.primary}
                            >
                              {formatWithSeparators(processingFee, displayCurrency)} {displayCurrency}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Fee Payer Indicator */}
                      {feeInfo && feeInfo.processing_fee > 0 && (
                        <Box display='flex' alignItems='center' mb={1} gap={0.5}>
                          <Typography
                            fontSize={12}
                            
                            color={feeInfo.fee_payer === 'merchant' ? '#12B76A' : theme.palette.text.secondary}
                          >
                            {feeInfo.fee_payer === 'merchant' 
                              ? t('checkout.processingFeesIncluded')
                              : t('checkout.customerPaysFee', { defaultValue: 'Customer pays processing fee' })
                            }
                          </Typography>
                        </Box>
                      )}

                      {/* Tax Row */}
                      {taxInfo && taxInfo.amount > 0 && (
                        <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
                          <Typography
                            fontSize={13}
                            
                            color={theme.palette.text.secondary}
                          >
                            {taxInfo.country 
                              ? t('checkout.vatRate', { rate: taxInfo.rate, country: taxInfo.country })
                              : t('checkout.tax')
                            }
                          </Typography>
                          <Typography
                            fontSize={13}
                            
                            fontWeight={500}
                            color={theme.palette.text.primary}
                          >
                            {formatWithSeparators(taxAmount, displayCurrency)} {displayCurrency}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 1.5, borderColor: isDark ? theme.palette.surface?.border : undefined }} />
                    </>
                  )}

                  {/* Total Row */}
                  <Box
                    display='flex'
                    justifyContent='space-between'
                    alignItems='center'
                    mb={1.5}
                    sx={{
                      backgroundColor: isDark ? 'rgba(204,255,0,0.08)' : 'rgba(10,10,10,0.04)',
                      borderRadius: '8px',
                      mx: -0.75,
                      px: 0.75,
                      py: 0.75,
                      transition: 'background-color 0.3s ease',
                    }}
                  >
                    <Typography
                      variant='subtitle2'
                      
                      fontWeight={700}
                      fontSize={{ xs: 13, sm: 14 }}
                      color={theme.palette.text.primary}
                      letterSpacing='-0.2px'
                    >
                      {t('checkout.total')}
                    </Typography>

                    <Box
                      display='flex'
                      alignItems='center'
                      border={1}
                      borderRadius='6px'
                      padding={1}
                      gap={1}
                      sx={{
                        cursor: 'pointer',
                        borderColor: isOpen ? theme.palette.primary.main : 'transparent',
                        '&:hover': {
                          border: `1px solid ${theme.palette.border.main}`
                        },
                        '&:active': {
                          border: `1px solid ${theme.palette.primary.main}`
                        }
                      }}
                      onClick={handleClick}
                      data-testid="currency-selector"
                    >
                      {!loading ? (
                        <>
                          {currencyOptions?.find(
                            c => c.code === currencyRates?.currency
                          )?.icon ||
                            currencyOptions.find(
                              c => c.code === walletState?.currency
                            )?.icon}

                          <Typography
                            fontWeight={800}
                            
                            fontSize={{ xs: 14, sm: 16 }}
                            color={theme.palette.text.primary}
                            letterSpacing='-0.3px'
                            data-testid="total-amount"
                          >
                            {(() => {
                              // If customer pays fees and crypto not selected yet, show subtotal + tax only (converted)
                              if (feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection) {
                                return formatWithSeparators(subtotalAmount + taxAmount, displayCurrency)
                              }
                              // Otherwise show the full calculated total amount
                              return formatWithSeparators(Number(totalAmount), displayCurrency)
                            })()}{' '}
                            {displayCurrency}
                          </Typography>
                          {/* Processing fee hint when customer pays fees but crypto not selected */}
                          {feePayer === 'customer' && feeInfo?.fees_pending_crypto_selection && feeInfo?.estimated_processing_fee && (
                            <Typography
                              variant="caption"
                              color={theme.palette.text.secondary}
                              
                              fontSize={11}
                              sx={{ 
                                display: 'block',
                                mt: 0.5,
                                opacity: 0.8
                              }}
                            >
                              + ~{Math.ceil(feeInfo.estimated_processing_fee * transferRate)} {displayCurrency} fee
                            </Typography>
                          )}
                          <Icon
                            icon={
                              isOpen
                                ? 'solar:alt-arrow-up-linear'
                                : 'solar:alt-arrow-down-linear'
                            }
                            width='17'
                            height='17'
                            color={theme.palette.text.primary}
                          />
                        </>
                      ) : (
                        <Skeleton
                          variant='rectangular'
                          width={154}
                          height={24}
                          animation='wave'
                          sx={{ 
                            borderRadius: '6px', 
                            background: theme.palette.action.hover
                          }}
                        />
                      )}

                      <Menu
                        anchorEl={anchorEl}
                        open={isOpen}
                        onClose={handleClose}
                        PaperProps={{
                          sx: {
                            border: `1px solid ${theme.palette.border.main}`,
                            borderRadius: '10px',
                            marginTop: '10px',
                            py: '4px',
                            px: '10px',
                            backgroundColor: theme.palette.background.paper,
                            maxHeight: '400px',
                            overflowY: 'auto',
                          }
                        }}
                      >
                        {incompletePayment ? (
                          // When incomplete payment exists, show only the locked currency
                          <MenuItem
                            key={incompletePayment.currency}
                            disabled
                            sx={{
                              px: { xs: 1.5, sm: 2, md: 2.5 },
                              py: { xs: 1, sm: 1.2, md: 1.5 },
                              borderRadius: '6px',
                              opacity: 0.8
                            }}
                          >
                            <Box display='flex' alignItems='center' gap={1}>
                              {currencyOptions.find(c => c.code === incompletePayment.currency)?.icon}
                              <Typography
                                color={theme.palette.text.primary}
                                sx={{ fontSize: { xs: '14px', sm: '18px', md: '14px' }, fontWeight: '500' }}
                              >
                                {incompletePayment.currency} ({t('checkout.pendingPayment', { defaultValue: 'Pending payment' })})
                              </Typography>
                            </Box>
                          </MenuItem>
                        ) : (
                          // Normal currency options
                          currencyOptions
                            .filter(currency => availableCurrencies.includes(currency.code))
                            .map(currency => (
                              <MenuItem
                                key={currency.code}
                                onClick={e => handleSelect(e, currency.code)}
                                sx={{
                                  px: { xs: 1.5, sm: 2, md: 2.5 },
                                  py: { xs: 1, sm: 1.2, md: 1.5 },
                                  borderRadius: '6px',
                                  '&:hover': {
                                    backgroundColor: theme.palette.action.hover
                                  }
                                }}
                              >
                                <Box display='flex' alignItems='center' gap={1}>
                                  {currency.icon}
                                  <Typography
                                    color={theme.palette.text.primary}
                                    sx={{
                                      fontSize: { xs: '14px', sm: '18px', md: '14px' },
                                      fontWeight: '500'
                                    }}
                                  >
                                    {t(currency.labelKey)}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))
                        )}
                      </Menu>
                    </Box>
                  </Box>

                  <Divider sx={{ 
                    mb: 1.5, 
                    borderColor: isDark ? theme.palette.surface?.border : undefined 
                  }} />

                  <Box display='flex' gap={2}>
                    <Button
                      fullWidth
                      variant='contained'
                      startIcon={<BitCoinGreenIcon width={7} />}
                      onClick={() => {
                        setActiveStep(1)
                        setTransferMethod('crypto')
                      }}
                      data-testid="crypto-payment-btn"
                      sx={{
                        background: 'linear-gradient(135deg, #12B76A 0%, #0E9F5C 100%)',
                        color: '#fff',
                        textTransform: 'none',
                        borderRadius: '12px',
                        fontWeight: 700,
                        py: 1.25,
                        fontSize: '14px',
                        minHeight: 46,
                        letterSpacing: '0.2px',
                        boxShadow: '0 4px 14px rgba(18, 183, 106, 0.3)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #0E9F5C 0%, #0C8A50 100%)',
                          boxShadow: '0 6px 20px rgba(18, 183, 106, 0.4)',
                          transform: 'translateY(-1px)',
                        },
                        '&:active': {
                          transform: 'translateY(0)',
                          boxShadow: '0 2px 8px rgba(18, 183, 106, 0.3)',
                        },
                      }}
                    >
                      {t('checkout.cryptocurrency')}
                    </Button>
                  </Box>
                </Box>

                {/* Expiry + Security row */}
                <Box
                  display='flex'
                  alignItems='center'
                  justifyContent='space-between'
                  mt={1.5}
                  px={0.5}
                >
                  {countdown && countdown !== 'Expired' && (
                    <Box display='flex' alignItems='center' gap={0.5} data-testid="expiry-countdown">
                      <Icon icon="mdi:clock-outline" width={13} color={theme.palette.text.secondary} />
                      <Typography fontSize={11} color={theme.palette.text.secondary}>
                        {t('checkout.expiresIn')} <strong>{countdown}</strong>
                      </Typography>
                    </Box>
                  )}
                  <Box display='flex' alignItems='center' gap={0.5} data-testid="security-badge">
                    <Icon icon="mdi:shield-check" width={13} color={theme.palette.primary.main} />
                    <Typography fontSize={10.5} color={theme.palette.primary.main} fontWeight={700} letterSpacing='0.2px'>
                      {t('checkout.securePayment')}
                    </Typography>
                  </Box>
                </Box>
                </Box>
              </Paper>
            </Box>
          ) : activeStep === 1 ? (
            transferMethod === 'bank' ? (
              <BankTransferCompo
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                walletState={walletState}
                setIsSuccess={setIsSuccess}
                setIsBank={setIsBank}
                redirectUrl={redirectUrl}
              />
            ) : (
              <CryptoTransfer
                activeStep={activeStep}
                setActiveStep={setActiveStep}
                walletState={walletState}
                feePayer={feePayer}
                redirectUrl={redirectUrl}
                taxInfo={taxInfo}
                feeInfo={feeInfo}
                merchantInfo={merchantInfo}
                displayCurrency={displayCurrency}
                transferRate={transferRate}
                email={tokenData?.email}
                transactionId={linkId}
                customerName={customerName}
              />
            )
          ) : activeStep === 2 ? (
            <TransferExpectedCard
              isTrue={isSuccess}
              dataUrl={isBank || ''}
              type={'bank'}
              redirectUrl={redirectUrl}
              transactionId={linkId}
              merchantName={merchantInfo?.name}
              amount={`${formatWithSeparators(Number(totalAmount), displayCurrency)} ${displayCurrency}`}
              email={tokenData?.email}
              customerName={customerName}
            />
          ) : null}
        </Box>

        {/* Copy Success Snackbar */}
        <Snackbar
          open={copySnackbar}
          autoHideDuration={2000}
          onClose={() => setCopySnackbar(false)}
          message={t('checkout.copied')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Pay3Layout>
  )
}

export default paymentAuth(Payment)
