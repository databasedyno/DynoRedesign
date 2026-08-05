import PanelCard from "@/Components/UI/PanelCard";
import { prettyCreatorUrl } from "@/helpers/creatorUrl";
import Head from "next/head";
import { Box, Typography, useMediaQuery, useTheme, Drawer, IconButton } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { PaymentLinkAction } from "@/Redux/Actions";
import { ApiAction } from "@/Redux/Actions";
import { API_FETCH } from "@/Redux/Actions/ApiAction";
import { PAYLINK_CREATE, PAYLINK_UPDATE, PAYLINK_FEE_PREVIEW } from "@/Redux/Actions/PaymentLinkAction";
import PaymentLinkSuccessModal from "./PaymentLinkSuccessModal";
import { TabContentContainer } from "./styled";

import BitcoinIcon from "@/assets/cryptocurrency/Bitcoin-icon.svg";
import BitcoinCashIcon from "@/assets/cryptocurrency/BitcoinCash-icon.svg";
import DogecoinIcon from "@/assets/cryptocurrency/Dogecoin-icon.svg";
import EthereumIcon from "@/assets/cryptocurrency/Ethereum-icon.svg";
import LitecoinIcon from "@/assets/cryptocurrency/Litecoin-icon.svg";
import PolygonIcon from "@/assets/cryptocurrency/Polygon-icon.svg";
import RLUSDIcon from "@/assets/cryptocurrency/RLUSD-icon.svg";
import SolanaIcon from "@/assets/cryptocurrency/Solana-icon.svg";
import TronIcon from "@/assets/cryptocurrency/Tron-icon.svg";
import USDTIcon from "@/assets/cryptocurrency/USDT-icon.svg";
import USDT2Icon from "@/assets/cryptocurrency/USDT2-icon.svg";
import XRPIcon from "@/assets/cryptocurrency/XRP-icon.svg";

import useIsMobile from "@/hooks/useIsMobile";
import i18n from "@/i18n";
import { PaymentLink } from "@/utils/types/paymentLink";

import {
  ActionButtons,
  CryptoSelection,
  DescriptionSection,
  DonationSettingsSection,
  LinkTypeSelector,
  LivePreviewPanel,
  PaymentLinkHeader,
  PaymentSettingsBasic,
  PostPaymentSettings,
  ProductQuickSell,
  TaxSection,
} from "@/Components/UI/pay-link";
import type { LinkKind } from "@/Components/UI/pay-link/LinkTypeSelector";
import type { PickedProduct } from "@/Components/UI/pay-link";
import type {
  DonationSettingsState,
  DonationErrors,
} from "@/Components/UI/pay-link/DonationSettingsSection";
import CampaignManager from "@/Components/UI/pay-link/CampaignManager";
import axiosBaseApi from "@/axiosConfig";
import { PRICING_CURRENCIES, clampPricingCurrency } from "@/utils/pricingCurrencies";
import { fetchGeoDefaults } from "@/utils/geoDefaults";
import SaveChangeModel from "@/Components/UI/pay-link/SaveChangeModel";
import {
  CreatePaymentLinkPageProps,
  ICryptoItem,
} from "@/utils/types/create-pay-link";

function truncateByWords(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  const trimmed = text.slice(0, maxLength);
  const words = `${trimmed}...`;
  return words;
}

const CreatePaymentLinkPage = ({
  paymentLinkData,
  disabled,
  setPageName,
}: CreatePaymentLinkPageProps) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("createPaymentLinkScreen");
  const paymentLinkState = useSelector((state: any) => state.paymentLinkReducer);
  const feePreview = paymentLinkState?.feePreview;
  // Mobile / tablet (< lg): live preview shown on demand via a bottom-sheet drawer.
  const [previewOpen, setPreviewOpen] = useState(false);
  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId
  );
  const apiState = useSelector((state: any) => state?.apiReducer);
  const hasActiveApiKey = useMemo(() => {
    const apiList = apiState?.apiList || [];
    return apiList.some((api: any) => api.status === 'active');
  }, [apiState?.apiList]);

  // Fetch API keys on mount
  useEffect(() => {
    dispatch(ApiAction(API_FETCH));
  }, [dispatch, selectedCompanyId]);
  const tPaymentLink = useCallback(
    (key: string, options?: any): string => {
      // Session 75 bug fix: this wrapper previously accepted only `key` and
      // silently DROPPED the second argument, so `defaultValue` fallbacks and
      // interpolation values ({{url}}, {{amount}}, etc.) never reached i18next.
      // When a translation key was missing from the locale file (e.g. the
      // "donationCreatorHintTitle" family), i18next returned the KEY ITSELF —
      // that's what surfaced the raw "donationCreatorHintTitle" text next to
      // the coffee icon on the crowdfunding view. Pass options through so
      // both defaultValue and interpolation values work as intended.
      const result = t(key, { ns: "createPaymentLinkScreen", ...(options || {}) });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const currentLng = i18n.language;
  const hasPaymentLinkData = Object.keys(paymentLinkData).length > 0;
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [cryptoItems, setCryptoItems] = useState<ICryptoItem[]>([]);
  const [filteredCryptoItems, setFilteredCryptoItems] = useState<ICryptoItem[]>(
    [],
  );
  const [showFilteredCryptoItems, setShowFilteredCryptoItems] =
    useState<boolean>(false);
  const [activeTab, setActiveTab] = useState(0);
  const [blockchainFees, setBlockchainFees] = useState("company");
  const expireAnchorEl = useRef<HTMLElement | null>(null);
  const expireTriggerRef = useRef<HTMLDivElement>(null);
  const [expireOpen, setExpireOpen] = useState<boolean>(false);
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);
  const [saveChangeModalOpen, setSaveChangeModalOpen] =
    useState<boolean>(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [directPayAddress, setDirectPayAddress] = useState<string | null>(null);
  const [directPayQrCode, setDirectPayQrCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const prevPaymentLinksLengthRef = useRef(paymentLinkState?.paymentLinks?.length || 0);

  // Watch for newly created payment link from backend response
  // Only open the success modal AFTER data arrives (fixes URL delay + wallet flash)
  useEffect(() => {
    const currentLinks = paymentLinkState?.paymentLinks || [];
    const currentLength = currentLinks.length;
    if (currentLength > prevPaymentLinksLengthRef.current && isCreating) {
      const newestLink = currentLinks[0];
      if (newestLink?.payment_link) {
        setPaymentLink(newestLink.payment_link);
      }
      // Extract Direct Pay pool address from backend response
      if (newestLink?.direct_pay_address) {
        setDirectPayAddress(newestLink.direct_pay_address);
      }
      if (newestLink?.direct_pay_qr_code) {
        setDirectPayQrCode(newestLink.direct_pay_qr_code);
      }
      // Update linkId in paymentSettings so the success modal shows it
      const newLinkId = newestLink?.link_id || newestLink?.linkId || newestLink?._id || "";
      if (newLinkId) {
        setPaymentSettings((prev) => ({ ...prev, linkId: newLinkId }));
      }
      // All data is ready — NOW open the modal
      setIsCreating(false);
      setSuccessModalOpen(true);
    }
    prevPaymentLinksLengthRef.current = currentLength;
  }, [paymentLinkState?.paymentLinks, isCreating]);

  // Reset creating state on error — only after createLoading transitions from true → false
  // This guards against the premature reset that was happening before
  const prevCreateLoadingRef = useRef(paymentLinkState?.createLoading);
  useEffect(() => {
    const wasLoading = prevCreateLoadingRef.current;
    const nowLoading = paymentLinkState?.createLoading;
    prevCreateLoadingRef.current = nowLoading;

    // Only react when createLoading transitions from true to false
    if (wasLoading === true && nowLoading === false && isCreating && !successModalOpen) {
      const links = paymentLinkState?.paymentLinks || [];
      if (links.length <= prevPaymentLinksLengthRef.current) {
        // API returned an error (no new link was added)
        setIsCreating(false);
      }
    }
  }, [paymentLinkState?.createLoading, isCreating, successModalOpen]);

  // Surface backend create errors INLINE next to the offending field (in addition
  // to the toast the saga fires). Watches `createErrorNonce` so identical repeated
  // errors still trigger the effect. Fixes the merchant-onboarding "silent 400"
  // where the first createPaymentLink attempt shows only a toast and no field-level
  // hint about what was wrong.
  const lastNonceRef = useRef<number>(paymentLinkState?.createErrorNonce || 0);
  useEffect(() => {
    const nonce = paymentLinkState?.createErrorNonce || 0;
    if (nonce === lastNonceRef.current) return;
    lastNonceRef.current = nonce;

    const field = paymentLinkState?.createErrorField as string | null;
    const message = paymentLinkState?.createError as string | null;
    if (!field || !message) return;

    // Also make sure we're not stuck in "creating" state
    setIsCreating(false);

    switch (field) {
      case "value":
        setPaymentSettingsErrors((prev) => ({ ...prev, value: message }));
        setPaymentSettingsTouched((prev) => ({ ...prev, value: true }));
        if (activeTab !== 0) setActiveTab(0);
        break;
      case "currency":
        setPaymentSettingsErrors((prev) => ({ ...prev, currency: message }));
        if (activeTab !== 0) setActiveTab(0);
        break;
      case "description":
        setPaymentSettingsErrors((prev) => ({ ...prev, description: message }));
        if (activeTab !== 0) setActiveTab(0);
        break;
      case "customer_email":
        setCustomerEmailError(message);
        if (activeTab !== 0) setActiveTab(0);
        break;
      case "expire":
      case "accepted_currencies":
        // These live on Tab 0 payment settings but don't have dedicated inline
        // error slots — switch the tab so the toast (already dispatched by the
        // saga) is next to the offending control.
        if (activeTab !== 0) setActiveTab(0);
        break;
      case "webhook_url":
      case "redirect_url":
      case "callback_url":
        // These live on Tab 1 (Post-payment settings). Switch to that tab so the
        // toast is at least next to the offending field.
        if (activeTab !== 1) setActiveTab(1);
        break;
      case "kyc":
      case "company_id":
      case "generic":
      default:
        // Nothing to surface inline — the toast already carries the message.
        break;
    }
  }, [paymentLinkState?.createErrorNonce, paymentLinkState?.createErrorField, paymentLinkState?.createError, activeTab]);
  const currencyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const currencyAnchorEl = useRef<HTMLButtonElement | null>(null);
  const [includeTax, setIncludeTax] = useState<boolean>(
    disabled ? true : false,
  );
  const [taxInclusive, setTaxInclusive] = useState<boolean>(
    hasPaymentLinkData ? !!(paymentLinkData as any).tax_inclusive : false,
  );
  const [showAllCoins, setShowAllCoins] = useState(false);
  const MIN_WIDTH = 390;
  const MAX_WIDTH = 900;
  const BASE_COUNT = 15;
  const STEP = 10;

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [count, setCount] = useState(BASE_COUNT);

  const [currencyOpen, setCurrencyOpen] = useState(false);

  const currencies = PRICING_CURRENCIES;

  const handleCurrencyOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    currencyAnchorEl.current = e.currentTarget;
    setCurrencyOpen(true);
  };

  const handleCurrencyClose = () => {
    setCurrencyOpen(false);
  };

  const handleCurrencySelect = (currency: string) => {
    setPaymentSettings((prev) => ({ ...prev, currency }));
    setPaymentSettingsTouched((p) => ({ ...p, currency: true }));
    setPaymentSettingsErrors((p) => ({ ...p, currency: "" }));
    setCurrencyOpen(false);
  };

  // Payment Settings (Tab 0) form data
  const [paymentSettings, setPaymentSettings] = useState({
    value: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).amount.toString()
      : "",
    cryptoValue: "",
    currency: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).currency
      : "USD",
    clientName: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).clientName
      : "",
    expire: hasPaymentLinkData ? (paymentLinkData as PaymentLink).expire : "no",
    description: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).description
      : "",
    blockchainFees: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).blockchainFees
      : "company",
    linkId: hasPaymentLinkData ? (paymentLinkData as PaymentLink).link_id : "",
    acceptedCryptoCurrency: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).acceptedCryptoCurrency
      : [],
  });

  // Validation errors for Payment Settings tab
  const [paymentSettingsErrors, setPaymentSettingsErrors] = useState({
    value: "",
    currency: "",
    description: "",
  });

  // Optional customer email for referral code delivery
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerEmailError, setCustomerEmailError] = useState("");

  // Touched fields for Payment Settings tab
  const [paymentSettingsTouched, setPaymentSettingsTouched] = useState({
    value: false,
    currency: false,
    description: false,
  });

  // Post-Payment Settings (Tab 1) form data
  const [postPaymentSettings, setPostPaymentSettings] = useState({
    callbackUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).payment_url
      : "",
    redirectUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).redirect_url
      : "",
    webhookUrl: hasPaymentLinkData
      ? (paymentLinkData as PaymentLink).webhook_url
      : "",
  });

  // ── Donation / crowdfunding state ─────────────────────────────────
  // Initial link kind is derived from three sources, in priority order:
  //   1. edit mode: an existing payment link's `link_type`
  //   2. URL query `?type=donation` — used by the vertical-specific new-signup
  //      onboarding router (fundraiser purpose_vertical → this page opens on
  //      the Crowdfunding tab automatically)
  //   3. default: "standard"
  const [linkKind, setLinkKind] = useState<LinkKind>(() => {
    if (hasPaymentLinkData && (paymentLinkData as PaymentLink).link_type === "donation") {
      return "donation";
    }
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const typeParam = params.get("type");
        if (typeParam === "donation" || typeParam === "crowdfunding") return "donation";
      } catch { /* ignore malformed query */ }
    }
    return "standard";
  });

  // ── Quick-sell product picker (session 49 round 3 — option "b") ─────
  // Optional shortcut: merchant picks one of their live store products →
  // amount, currency, description auto-fill on the standard link form.
  // NOT stored server-side; the link is created as a plain 'standard' link.
  // Hidden in edit mode and for donation link_type.
  const [pickedProduct, setPickedProduct] = useState<PickedProduct | null>(null);
  const handlePickProduct = useCallback((p: PickedProduct) => {
    setPickedProduct(p);
    // Auto-fill fields — merchant can still edit any of these afterwards.
    setPaymentSettings((prev) => ({
      ...prev,
      value: p.amount,
      currency: p.currency,
      description: p.description,
    }));
    setPaymentSettingsTouched((prev) => ({
      ...prev,
      value: true,
      currency: true,
      description: true,
    }));
    setPaymentSettingsErrors((prev) => ({
      ...prev,
      value: "",
      currency: "",
      description: "",
    }));
  }, []);
  const handleClearProduct = useCallback(() => {
    setPickedProduct(null);
    // Leave the form fields as they are — merchant likely wants to keep the
    // last-typed values (Option "3a": fully editable after picking).
  }, []);
  // Called when the merchant changes the variant sub-dropdown after picking.
  // ProductQuickSell computes the new amount (variant.price_cents × qty) and
  // we mirror it into paymentSettings + update selected_variant_id on the
  // picked-product state so the dropdown shows the new choice.
  const handleVariantChange = useCallback(
    (variantId: number | string, amount: string) => {
      setPickedProduct((prev) => (prev ? { ...prev, selected_variant_id: variantId, amount } : prev));
      setPaymentSettings((prev) => ({ ...prev, value: amount }));
      setPaymentSettingsTouched((prev) => ({ ...prev, value: true }));
      setPaymentSettingsErrors((prev) => ({ ...prev, value: "" }));
    },
    []
  );

  // Keep the page/tab title aligned with the selected link kind while CREATING
  // (in edit mode the parent route owns its own header). Only runs when the
  // create route passes down setPageName.
  useEffect(() => {
    if (setPageName && !hasPaymentLinkData) {
      setPageName(
        tPaymentLink(
          linkKind === "donation"
            ? "createDonationTitle"
            : "createPaymentLinkTitle",
        ),
      );
    }
  }, [setPageName, hasPaymentLinkData, linkKind, tPaymentLink]);

  // Geo-default the pricing currency for NEW links so a merchant sees their
  // local currency pre-selected (e.g. Nigeria → NGN, Kenya → KES). Never runs
  // in edit mode (keeps the saved currency) and never overrides a currency the
  // merchant has already changed away from the USD default.
  useEffect(() => {
    if (hasPaymentLinkData) return;
    let cancelled = false;
    (async () => {
      try {
        const { currency } = await fetchGeoDefaults();
        const supported = clampPricingCurrency(currency, "");
        if (cancelled || !supported || supported === "USD") return;
        setPaymentSettings((prev) =>
          prev.currency === "USD" ? { ...prev, currency: supported } : prev,
        );
      } catch {
        /* non-fatal — keep the USD default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasPaymentLinkData]);

  const [donationSettings, setDonationSettings] = useState<DonationSettingsState>(() => {
    const don = hasPaymentLinkData ? (paymentLinkData as PaymentLink).donation : null;
    return {
      title: don?.title || "",
      goalAmount: don?.goal_amount != null ? String(don.goal_amount) : "",
      minAmount: don?.min_amount != null ? String(don.min_amount) : "1",
      presets: don?.preset_amounts || [],
      allowCustom: don?.allow_custom_amount !== false,
      showProgress: don?.show_progress !== false,
      showSupporters: don?.show_supporters !== false,
      autoCloseAtGoal: Boolean(don?.auto_close_at_goal),
      campaignImage: don?.campaign_image || null,
      // Crowdfunding v2 (Phase 3)
      storyMd: (don as any)?.story_md || "",
      endsAt: (don as any)?.ends_at ? String((don as any).ends_at).slice(0, 10) : "",
      category: (don as any)?.category || "",
      organizerThanks: (don as any)?.organizer_thanks || "",
      gallery: Array.isArray((don as any)?.gallery) ? (don as any).gallery : [],
      // Session 53: expose beneficiary as editable field (data was already round-tripped
      // through the API and rendered on the public page, but had no merchant UI).
      beneficiary:
        (don as any)?.beneficiary && typeof (don as any).beneficiary === "object"
          ? {
              name: (don as any).beneficiary.name || "",
              description: (don as any).beneficiary.description || undefined,
            }
          : null,
    };
  });
  const [donationErrors, setDonationErrors] = useState<DonationErrors>({});
  const [imageUploading, setImageUploading] = useState(false);

  const handleDonationChange = (patch: Partial<DonationSettingsState>) => {
    setDonationSettings((prev) => ({ ...prev, ...patch }));
  };
  const clearDonationError = (field: keyof DonationErrors) => {
    setDonationErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleUploadCampaignImage = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      dispatch({
        type: "TOAST_SHOW",
        payload: {
          message: t("donationImageTooLarge", { defaultValue: "Image is too large (max 10MB)." }),
          severity: "error",
        },
      });
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await axiosBaseApi.post("/pay/uploadCampaignImage", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res?.data?.data?.url;
      if (url) {
        setDonationSettings((prev) => ({ ...prev, campaignImage: url }));
      } else {
        throw new Error("No URL returned");
      }
    } catch (e: any) {
      dispatch({
        type: "TOAST_SHOW",
        payload: {
          message:
            e?.response?.data?.message ||
            t("donationImageUploadFailed", { defaultValue: "Image upload failed. Please try again." }),
          severity: "error",
        },
      });
    } finally {
      setImageUploading(false);
    }
  };

  const validateDonationSettings = (): boolean => {
    const errs: DonationErrors = {};
    if (!donationSettings.title.trim()) {
      errs.title = t("donationTitleRequired", { defaultValue: "Campaign title is required" });
    }
    if (donationSettings.goalAmount) {
      const goal = parseFloat(donationSettings.goalAmount);
      if (!Number.isFinite(goal) || goal <= 0) {
        errs.goalAmount = t("donationGoalInvalid", { defaultValue: "Enter a valid goal amount" });
      } else if (goal > 999999999) {
        errs.goalAmount = t("donationGoalTooLarge", { defaultValue: "Goal amount is too large" });
      }
    }
    if (donationSettings.minAmount) {
      const min = parseFloat(donationSettings.minAmount);
      if (!Number.isFinite(min) || min <= 0) {
        errs.minAmount = t("donationMinInvalid", { defaultValue: "Enter a valid minimum amount" });
      }
    }
    if (!donationSettings.allowCustom && donationSettings.presets.length === 0) {
      errs.presets = t("donationPresetsRequired", {
        defaultValue: "Add at least one suggested amount when custom amounts are disabled",
      });
    }
    setDonationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Sync form state when paymentLinkData changes (handles async data loading)
  useEffect(() => {
    if (Object.keys(paymentLinkData).length === 0) return;
    const data = paymentLinkData as PaymentLink;
    setPaymentSettings((prev) => ({
      ...prev,
      value: data.amount ? data.amount.toString() : prev.value,
      currency: data.currency || prev.currency,
      clientName: data.clientName || prev.clientName,
      expire: data.expire || prev.expire,
      description: data.description || prev.description,
      blockchainFees: data.blockchainFees || prev.blockchainFees,
      linkId: data.link_id || prev.linkId,
      acceptedCryptoCurrency: data.acceptedCryptoCurrency?.length
        ? data.acceptedCryptoCurrency
        : prev.acceptedCryptoCurrency,
    }));
    setBlockchainFees(data.blockchainFees || "company");
    setPostPaymentSettings({
      callbackUrl: data.payment_url || "",
      redirectUrl: data.redirect_url || "",
      webhookUrl: data.webhook_url || "",
    });
    if (data.acceptedCryptoCurrency?.length) {
      setShowAllCoins(true);
    }
    // Donation campaign: sync link kind + campaign settings (async load on edit)
    if (data.link_type === "donation") {
      setLinkKind("donation");
      const don = data.donation;
      if (don) {
        setDonationSettings({
          title: don.title || "",
          goalAmount: don.goal_amount != null ? String(don.goal_amount) : "",
          minAmount: don.min_amount != null ? String(don.min_amount) : "1",
          presets: don.preset_amounts || [],
          allowCustom: don.allow_custom_amount !== false,
          showProgress: don.show_progress !== false,
          showSupporters: don.show_supporters !== false,
          autoCloseAtGoal: Boolean(don.auto_close_at_goal),
          campaignImage: don.campaign_image || null,
          // Crowdfunding v2 (Phase 3)
          storyMd: (don as any).story_md || "",
          endsAt: (don as any).ends_at ? String((don as any).ends_at).slice(0, 10) : "",
          category: (don as any).category || "",
          organizerThanks: (don as any).organizer_thanks || "",
          gallery: Array.isArray((don as any).gallery) ? (don as any).gallery : [],
          // Session 53: beneficiary now editable in the UI
          beneficiary:
            (don as any).beneficiary && typeof (don as any).beneficiary === "object"
              ? {
                  name: (don as any).beneficiary.name || "",
                  description: (don as any).beneficiary.description || undefined,
                }
              : null,
        });
      }
    }
  }, [paymentLinkData]);

  const handleTabChange = (tab: number) => {
    setActiveTab(tab);
  };

  const handleBlockchainFeesChange = (value: string) => {
    setBlockchainFees(value);
    setPaymentSettings((prev) => ({ ...prev, blockchainFees: value }));
  };

  const validatePaymentSettings = () => {
    const errors: { value: string; description: string; currency: string } = {
      value: "",
      currency: "",
      description: "",
    };

    if (!paymentSettings.value || paymentSettings.value.trim() === "") {
      errors.value = tPaymentLink("valueRequired");
    } else {
      const numValue = parseFloat(paymentSettings.value);
      if (isNaN(numValue) || numValue <= 0) {
        errors.value = tPaymentLink("valueInvalid");
      } else if (numValue > 999999999) {
        errors.value = tPaymentLink("valueTooLarge");
      } else if (paymentSettings.value.split(".")[1]?.length > 2) {
        errors.value = tPaymentLink("valueDecimalPlaces");
      }
    }

    if (
      paymentSettings.description &&
      paymentSettings.description.length > 500
    ) {
      errors.description = tPaymentLink("descriptionMaxLength");
    }

    setPaymentSettingsErrors(errors);
    return !errors.value && !errors.currency && !errors.description;
  };

  const handlePaymentSettingsChange = (field: string, value: string) => {
    setPaymentSettings((prev) => ({ ...prev, [field]: value }));

    if (paymentSettingsErrors[field as keyof typeof paymentSettingsErrors]) {
      setPaymentSettingsErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handlePaymentSettingsBlur = (field: string) => {
    setPaymentSettingsTouched((prev) => ({ ...prev, [field]: true }));
    validatePaymentSettings();
  };

  const handlePostPaymentSettingsChange = (field: string, value: string) => {
    setPostPaymentSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpireOpen = (event: React.MouseEvent<HTMLElement>) => {
    expireAnchorEl.current = event.currentTarget;
    setExpireOpen(true);
  };

  const handleExpireClose = () => {
    setExpireOpen(false);
    expireAnchorEl.current = null;
  };

  const handleExpireSelect = (value: string) => {
    handlePaymentSettingsChange("expire", value);
    handleExpireClose();
  };

  const validateCurrency = useCallback(
    (value: string) => {
      if (!value) return tPaymentLink("currencyRequired");
      return "";
    },
    [tPaymentLink],
  );

  // Handle click outside for expire dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        expireTriggerRef.current &&
        !expireTriggerRef.current.contains(event.target as Node) &&
        expireAnchorEl.current &&
        !(expireAnchorEl.current as HTMLElement).contains(event.target as Node)
      ) {
        handleExpireClose();
      }
    };

    if (expireOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expireOpen]);

  const handleSaveChanges = () => {
    setSaveChangeModalOpen(true);
  };

  // Fetch fee preview when amount, currency, or fee payer changes
  useEffect(() => {
    const amount = parseFloat(paymentSettings.value);
    if (amount > 0 && paymentSettings.currency) {
      const timer = setTimeout(() => {
        dispatch(
          PaymentLinkAction(PAYLINK_FEE_PREVIEW, {
            amount,
            currency: paymentSettings.currency,
            feePayer: paymentSettings.blockchainFees,
          })
        );
      }, 500); // debounce
      return () => clearTimeout(timer);
    }
  }, [paymentSettings.value, paymentSettings.currency, paymentSettings.blockchainFees, dispatch]);

  const handleCreatePaymentLink = () => {
    // Prevent multiple rapid clicks — use createLoading (not generic loading which can be stuck from fee preview)
    if (isCreating || paymentLinkState?.createLoading) return;

    if (linkKind === "donation") {
      // Donation campaigns: validate campaign fields instead of a fixed amount
      if (!validateDonationSettings()) return;
      if (paymentSettings.description && paymentSettings.description.length > 500) {
        setPaymentSettingsErrors((prev) => ({
          ...prev,
          description: tPaymentLink("descriptionMaxLength"),
        }));
        return;
      }
    } else {
    // Always validate payment settings from Tab 0 regardless of active tab
    setPaymentSettingsTouched({
      value: true,
      currency: true,
      description: true,
    });

    if (!validatePaymentSettings()) {
      // If validation fails and we're on Tab 1, switch back to Tab 0 to show errors
      if (activeTab === 1) {
        setActiveTab(0);
      }
      return;
    }

    // Validate customer email format if provided
    if (customerEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        setCustomerEmailError("Please enter a valid email address");
        return;
      }
      setCustomerEmailError("");
    }
    }

    // Enforce at least 1 cryptocurrency selected
    if (!paymentSettings.acceptedCryptoCurrency || paymentSettings.acceptedCryptoCurrency.length === 0) {
      dispatch({
        type: "TOAST_SHOW",
        payload: { message: "Please select at least 1 cryptocurrency", severity: "error" },
      });
      if (activeTab === 1) {
        setActiveTab(0);
      }
      return;
    }

    // Build API payload with backend-compatible field names
    const apiPayload: any =
      linkKind === "donation"
        ? {
            link_type: "donation",
            title: donationSettings.title.trim(),
            // Session 53: dropped the old `purpose/description` blurb for donation
            // links — the rich `donation_story_md` supersedes it as the public
            // campaign body. Backend still accepts `description` for standard
            // links; keep it explicitly null for donations to avoid stale data.
            description: null,
            currency: paymentSettings.currency,
            goal_amount: donationSettings.goalAmount
              ? parseFloat(donationSettings.goalAmount)
              : null,
            min_amount: donationSettings.minAmount
              ? parseFloat(donationSettings.minAmount)
              : 1,
            preset_amounts: donationSettings.presets,
            allow_custom_amount: donationSettings.allowCustom,
            show_progress: donationSettings.showProgress,
            show_supporters: donationSettings.showSupporters,
            auto_close_at_goal: donationSettings.autoCloseAtGoal,
            campaign_image: donationSettings.campaignImage,
            // Crowdfunding v2 (Phase 3 — GoFundMe-lite)
            donation_story_md: donationSettings.storyMd?.trim() || null,
            donation_gallery: donationSettings.gallery || [],
            // endsAt input is a date (yyyy-mm-dd); send as ISO end-of-day UTC so
            // the countdown renders the whole day.
            donation_ends_at: donationSettings.endsAt
              ? new Date(`${donationSettings.endsAt}T23:59:59Z`).toISOString()
              : null,
            donation_category: donationSettings.category || null,
            donation_organizer_thanks: donationSettings.organizerThanks?.trim() || null,
            // Session 53: beneficiary — send only if the user filled at least the name.
            donation_beneficiary:
              donationSettings.beneficiary && donationSettings.beneficiary.name?.trim()
                ? {
                    name: donationSettings.beneficiary.name.trim(),
                    ...(donationSettings.beneficiary.description?.trim()
                      ? { description: donationSettings.beneficiary.description.trim() }
                      : {}),
                  }
                : null,
            // Session 53: dropped the "Campaign ends" dropdown (No/24h/7d/30d)
            // in favour of the specific `donation_ends_at` date picker. Donation
            // links now default `expire: "No"` — the campaign end date drives
            // countdown/lifecycle. Existing links keep whatever expire was set.
            expire: paymentSettings.expire === "no" ? "No" : (paymentSettings.expire || "No"),
            fee_payer: paymentSettings.blockchainFees,
            accepted_currencies: paymentSettings.acceptedCryptoCurrency,
            redirect_url: postPaymentSettings.redirectUrl,
            webhook_url: postPaymentSettings.webhookUrl,
            callback_url: postPaymentSettings.callbackUrl,
            company_id: selectedCompanyId,
          }
        : {
            amount: parseFloat(paymentSettings.value),
            currency: paymentSettings.currency,
            description: paymentSettings.description,
            name: paymentSettings.clientName,
            expire: paymentSettings.expire === "no" ? "No" : paymentSettings.expire,
            fee_payer: paymentSettings.blockchainFees,
            accepted_currencies: paymentSettings.acceptedCryptoCurrency,
            redirect_url: postPaymentSettings.redirectUrl,
            webhook_url: postPaymentSettings.webhookUrl,
            callback_url: postPaymentSettings.callbackUrl,
            apply_tax: includeTax,
            tax_inclusive: includeTax ? taxInclusive : false,
            company_id: selectedCompanyId,
          };

    if (linkKind !== "donation" && customerEmail.trim()) {
      apiPayload.customer_email = customerEmail.trim();
    }

    // Dispatch to Redux saga which calls the API
    if (hasPaymentLinkData) {
      dispatch(
        PaymentLinkAction(PAYLINK_UPDATE, {
          id: (paymentLinkData as PaymentLink).link_id,
          ...apiPayload,
          // Session 14d: return to the payment-links list after a successful save
          onSuccess: () => router.push("/pay-links"),
        })
      );
    } else {
      // Clear stale data and start creation
      setPaymentLink("");
      setDirectPayAddress(null);
      setDirectPayQrCode(null);
      setIsCreating(true);
      dispatch(PaymentLinkAction(PAYLINK_CREATE, apiPayload));
    }

    // Modal will open automatically when backend responds (via useEffect above)
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalOpen(false);
    setIsCreating(false);
    // Reset form for new creation
    if (!hasPaymentLinkData) {
      setPaymentSettings({
        value: "",
        cryptoValue: "",
        currency: "USD",
        clientName: "",
        expire: "no",
        description: "",
        blockchainFees: "company",
        linkId: "",
        acceptedCryptoCurrency: [],
      });
      setPaymentSettingsErrors({ value: "", currency: "", description: "" });
      setPaymentSettingsTouched({ value: false, currency: false, description: false });
      setPostPaymentSettings({ callbackUrl: "", redirectUrl: "", webhookUrl: "" });
      setCustomerEmail("");
      setIncludeTax(false);
      setTaxInclusive(false);
      setPaymentLink("");
      setDirectPayAddress(null);
      setDirectPayQrCode(null);
      // Reset donation campaign fields (link kind is kept so the merchant can
      // quickly create another campaign). Uses functional setter + spread so
      // TypeScript sees the full DonationSettingsState shape (the crowdfunding
      // Phase 3 fields are all covered by defaults on prev).
      setDonationSettings((prev) => ({
        ...prev,
        title: "",
        goalAmount: "",
        minAmount: "1",
        presets: [],
        allowCustom: true,
        showProgress: true,
        showSupporters: true,
        autoCloseAtGoal: false,
        campaignImage: null,
      }));
      setDonationErrors({});
    }
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      dispatch({
        type: "TOAST_SHOW",
        payload: { message: "Payment link copied!", severity: "success" },
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const trigger = currencyTriggerRef.current;
      const popover = currencyAnchorEl.current;

      if (
        trigger &&
        !trigger.contains(event.target as Node) &&
        popover &&
        !popover.contains(event.target as Node)
      ) {
        setCurrencyOpen(false);

        setPaymentSettingsTouched((p) => ({ ...p, currency: true }));

        const error = validateCurrency(paymentSettings.currency);
        setPaymentSettingsErrors((p) => ({ ...p, currency: error }));
      }
    };

    if (currencyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currencyOpen, paymentSettings.currency, validateCurrency]);

  const disable = {
    pointerEvents: disabled ? "none" : "auto",
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "inherit",
    filter: disabled ? "grayscale(1)" : "none",
  };

  const ALL_CRYPTO_ITEMS: ICryptoItem[] = React.useMemo(
    () => [
      {
        name: "Bitcoin",
        label: "BTC",
        icon: BitcoinIcon,
        fullOrder: 15,
        shortOrder: 1,
      },
      {
        name: "Ethereum",
        label: "ETH",
        icon: EthereumIcon,
        fullOrder: 5,
        shortOrder: 2,
      },
      {
        name: "Litecoin",
        label: "LTC",
        icon: LitecoinIcon,
        fullOrder: 3,
        shortOrder: 3,
      },
      {
        name: "USDT",
        label: "USDT-TRC20",
        icon: USDTIcon,
        fullOrder: 2,
        shortOrder: 4,
      },
      {
        name: "USDT",
        label: "USDT-ERC20",
        icon: USDTIcon,
        fullOrder: 6,
        shortOrder: 5,
      },
      {
        name: "Tron",
        label: "TRX",
        icon: TronIcon,
        fullOrder: 4,
        shortOrder: 6,
      },
      {
        name: "Dogecoin",
        label: "DOGE",
        icon: DogecoinIcon,
        fullOrder: 8,
        shortOrder: 7,
      },
      {
        name: "Bitcoin Cash",
        label: "BCH",
        icon: BitcoinCashIcon,
        fullOrder: 1,
        shortOrder: 8,
      },
      {
        name: "USDC",
        label: "USDC-ERC20",
        icon: USDT2Icon,
        fullOrder: 7,
        shortOrder: 9,
      },
      {
        name: "Solana",
        label: "SOL",
        icon: SolanaIcon,
        fullOrder: 9,
        shortOrder: 10,
      },
      {
        name: "XRP",
        label: "XRP",
        icon: XRPIcon,
        fullOrder: 10,
        shortOrder: 11,
      },
      {
        name: "POLYGON",
        label: "POLYGON",
        icon: PolygonIcon,
        fullOrder: 11,
        shortOrder: 12,
      },
      {
        name: "POLYGON USDT",
        label: "USDT-POLYGON",
        icon: PolygonIcon,
        fullOrder: 12,
        shortOrder: 13,
      },
      {
        name: "RLUSD",
        label: "RLUSD",
        icon: RLUSDIcon,
        fullOrder: 13,
        shortOrder: 14,
      },
      {
        name: "RLUSD",
        label: "RLUSD-ERC20",
        icon: RLUSDIcon,
        fullOrder: 14,
        shortOrder: 15,
      },
    ],
    [],
  );

  const handleSearch = () => {
    if (searchTerm.trim() !== "") {
      const filterdData = cryptoItems.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.label.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredCryptoItems(filterdData);
    } else {
      setFilteredCryptoItems([]);
    }
    setShowFilteredCryptoItems(true);
  };

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setShowFilteredCryptoItems(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const fullSorted = [...ALL_CRYPTO_ITEMS].sort(
      (a, b) => a.fullOrder - b.fullOrder,
    );

    // Show only first 5 cryptos by default (shortOrder <= 5), expand to all via "Show All"
    if (showAllCoins) {
      setCryptoItems(fullSorted);
    } else {
      setCryptoItems(
        fullSorted
          .filter((item) => item.shortOrder <= 5)
          .sort((a, b) => a.shortOrder - b.shortOrder),
      );
    }
  }, [ALL_CRYPTO_ITEMS, hasPaymentLinkData, showAllCoins]);

  const isLarge = useMediaQuery("(min-width:1000px)");
  const isSmall = useMediaQuery("(min-width:650px)");

  // Dynamically compute which wallets are not set up based on actual wallet data
  const walletList = useSelector((state: any) => state.walletReducer?.walletList ?? []);
  const companyListForBanner = useSelector((state: any) => state?.companyReducer?.companyList ?? []);
  // Creator profile — used to show where a donation link will surface publicly.
  const creatorProfile = useSelector((state: any) => state?.userReducer?.profile) as any;
  const creatorHandle: string = creatorProfile?.handle || "";
  const creatorPublicUrl = prettyCreatorUrl(creatorHandle);
  const walletNotSetUp = useMemo(() => {
    const configuredTypes = new Set(
      walletList
        .filter((w: any) => Boolean(w.wallet_address))
        .map((w: any) => w.wallet_type)
    );
    return ALL_CRYPTO_ITEMS
      .map((item) => item.label)
      .filter((label) => !configuredTypes.has(label));
  }, [walletList, ALL_CRYPTO_ITEMS]);

  // UX-2026-07-08: "Preview mode" banner — show whenever the user is missing
  // ANY of the prerequisites for accepting real money on this link:
  //   • no company,   OR
  //   • no configured payout wallet,   OR
  //   • no active API key.
  // Previously only the API-key check ran, which hid the banner from the exact
  // audience the "Preview mode" flow was built for (brand-new empty users).
  const hasCompanyForBanner = companyListForBanner.length > 0;
  const hasConfiguredWallet = useMemo(
    () => walletList.some((w: any) => Boolean(w?.wallet_address && String(w.wallet_address).trim().length > 0)),
    [walletList],
  );
  const showActivationBanner = (!hasCompanyForBanner || !hasConfiguredWallet || !hasActiveApiKey) && !apiState?.loading;

  // UX-2026-07-08: Pre-select the 3 most-popular cryptos (BTC / ETH / USDT-ERC20)
  // intersected with what the merchant actually has wallets configured for.
  // Only runs when creating a NEW pay-link (skip when editing) AND when no crypto
  // has been picked yet — otherwise we'd nuke the user's own choices on re-render.
  const hasSeededDefaultsRef = useRef(false);
  useEffect(() => {
    if (hasSeededDefaultsRef.current) return;
    if (hasPaymentLinkData) return; // never auto-modify while editing
    if (paymentSettings.acceptedCryptoCurrency && paymentSettings.acceptedCryptoCurrency.length > 0) return;
    if (!walletList || walletList.length === 0) return; // wait until wallets are known
    const PREFERRED = ["BTC", "ETH", "USDT-ERC20"];
    const configured = new Set(
      walletList.filter((w: any) => Boolean(w.wallet_address)).map((w: any) => w.wallet_type),
    );
    const preselect = PREFERRED.filter((label) => configured.has(label));
    if (preselect.length === 0) return;
    hasSeededDefaultsRef.current = true;
    setPaymentSettings((prev) => ({ ...prev, acceptedCryptoCurrency: preselect }));
  }, [walletList, hasPaymentLinkData, paymentSettings.acceptedCryptoCurrency]);

  // Deep-link support: /create-pay-link?product_id=X&qty=N (session 49 round 3
  // follow-up) — merchant clicks "Quick sell" on the Products list, we jump
  // to the pay-link create form with the product pre-picked and the amount
  // pre-multiplied by qty. Amount/currency/description stay fully editable
  // (option 3a). We only fetch once; hasAppliedProductRef guards against
  // re-runs after router.query mutation on Next router state changes.
  const router = useRouter();
  const hasAppliedProductRef = useRef(false);
  useEffect(() => {
    if (hasAppliedProductRef.current) return;
    if (hasPaymentLinkData) return;
    if (!router.isReady) return;
    const productIdRaw = router.query.product_id;
    if (!productIdRaw) return;
    const productId = Array.isArray(productIdRaw) ? productIdRaw[0] : productIdRaw;
    const qtyRaw = router.query.qty;
    const qty = Math.max(1, Math.floor(Number(Array.isArray(qtyRaw) ? qtyRaw[0] : qtyRaw) || 1));
    hasAppliedProductRef.current = true;

    (async () => {
      try {
        const res = await import("@/axiosConfig").then((m) => m.default.get(`/products/${productId}`));
        const product = res?.data?.data?.product;
        const variants = (res?.data?.data?.variants || []).filter(
          (v: { is_active?: boolean }) => v.is_active !== false
        );
        if (!product) return;

        // Choose default variant = cheapest active (matches ProductQuickSell behaviour).
        let selectedVariantId: number | string | null = null;
        let unitCents = Number(product.base_price_cents) || 0;
        if (product.has_variants && variants.length > 0) {
          const sorted = [...variants].sort(
            (a, b) => Number(a.price_cents) - Number(b.price_cents)
          );
          selectedVariantId = sorted[0].variant_id;
          unitCents = Number(sorted[0].price_cents) || 0;
        }
        const amountCents = unitCents * qty;
        const amountDec = (amountCents / 100).toFixed(2);
        const stripMd = (md: string | null | undefined): string => {
          if (!md) return "";
          return String(md)
            .replace(/```[\s\S]*?```/g, "")
            .replace(/`([^`]+)`/g, "$1")
            .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/^#{1,6}\s+/gm, "")
            .replace(/(\*\*|__)(.*?)\1/g, "$2")
            .replace(/(\*|_)(.*?)\1/g, "$2")
            .replace(/^>\s+/gm, "")
            .replace(/^[\-*+]\s+/gm, "• ")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        };
        const rawDesc = stripMd(product.description_md || product.subtitle || "").slice(0, 500);
        const qtyPrefix = qty > 1 ? `${qty}× ${product.title} — ` : "";
        const description = qtyPrefix + (rawDesc || product.title);

        setPickedProduct({
          product_id: product.product_id,
          title: product.title,
          amount: amountDec,
          currency: product.currency || "USD",
          description,
          cover_image_url: product.cover_image_url || null,
          product_type: product.product_type,
          variants: product.has_variants ? variants : undefined,
          selected_variant_id: selectedVariantId,
          qty,
        });
        setPaymentSettings((prev) => ({
          ...prev,
          value: amountDec,
          currency: product.currency || prev.currency,
          description,
        }));
        setPaymentSettingsTouched((prev) => ({
          ...prev,
          value: true,
          currency: true,
          description: true,
        }));
        setPaymentSettingsErrors((prev) => ({
          ...prev,
          value: "",
          currency: "",
          description: "",
        }));
      } catch (e) {
        // Silently skip on 404 / 403 — merchant just sees an empty picker.
        console.warn("[CreatePaymentLink] Failed to load product for deep-link:", e);
      }
    })();
  }, [router.isReady, router.query.product_id, router.query.qty, hasPaymentLinkData]);

  // UX-2026-07-08: apply query-string template presets when arriving via
  // empty-state chips (e.g. /create-pay-link?template=invoice&amount=500).
  const hasAppliedTemplateRef = useRef(false);
  useEffect(() => {
    if (hasAppliedTemplateRef.current) return;
    if (hasPaymentLinkData) return;
    if (!router.isReady) return;
    const template = String(router.query.template || "").toLowerCase();
    const amountQ = Number(router.query.amount);
    if (!template && !Number.isFinite(amountQ)) return;

    const templateTitles: Record<string, string> = {
      invoice: tPaymentLink("templateInvoice", { defaultValue: "Invoice" }),
      product: tPaymentLink("templateProduct", { defaultValue: "Product" }),
      donation: tPaymentLink("templateDonation", { defaultValue: "Donation" }),
      tips: tPaymentLink("templateTips", { defaultValue: "Tip" }),
    };
    const templateDescs: Record<string, string> = {
      invoice: tPaymentLink("templateInvoiceDesc", { defaultValue: "Invoice payment" }),
      product: tPaymentLink("templateProductDesc", { defaultValue: "Product purchase" }),
      donation: tPaymentLink("templateDonationDesc", { defaultValue: "Donation" }),
      tips: tPaymentLink("templateTipsDesc", { defaultValue: "Thanks for the tip!" }),
    };

    hasAppliedTemplateRef.current = true;
    setPaymentSettings((prev) => ({
      ...prev,
      // NB: state field is `value` (fiat amount as string), not `amount`.
      // No `title` field on paymentSettings — template titles live in the
      // description slot.
      value: Number.isFinite(amountQ) && amountQ > 0 ? String(amountQ) : prev.value,
      description:
        templateDescs[template] ||
        templateTitles[template] ||
        prev.description,
    }));
  }, [router.isReady, router.query.template, router.query.amount, hasPaymentLinkData, tPaymentLink]);

  // Deep-link support: /create-pay-link?type=donation (or ?kind=donation, or
  // ?template=donation) preselects the Donation / "Buy me a coffee" kind. Used
  // by the Creator-page CTAs so tips/donations feel like a Creator feature.
  const hasAppliedKindRef = useRef(false);
  useEffect(() => {
    if (hasAppliedKindRef.current) return;
    if (hasPaymentLinkData) return;
    if (!router.isReady) return;
    const qType = String(router.query.type || router.query.kind || "").toLowerCase();
    const qTemplate = String(router.query.template || "").toLowerCase();
    if (qType === "donation" || qTemplate === "donation") {
      hasAppliedKindRef.current = true;
      setLinkKind("donation");
    }
  }, [router.isReady, router.query.type, router.query.kind, router.query.template, hasPaymentLinkData]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const clampedWidth = Math.min(Math.max(windowWidth, MIN_WIDTH), MAX_WIDTH);

    const extra = Math.floor((clampedWidth - MIN_WIDTH) / STEP);
    setCount(BASE_COUNT + extra);
  }, [windowWidth]);

  return (
    <div>
      {/* Donation-aware browser tab title (only override in create mode; the
          standard link keeps its route SEO title). */}
      {!hasPaymentLinkData && linkKind === "donation" && (
        <Head>
          <title>{`${tPaymentLink("createDonationTitle")} | Dynopay`}</title>
        </Head>
      )}
      <PaymentLinkSuccessModal
        open={successModalOpen}
        onClose={handleCloseSuccessModal}
        paymentLink={paymentLink}
        paymentSettings={paymentSettings}
        onCopyLink={handleCopyLink}
        walletList={walletList}
        directPayAddress={directPayAddress}
        directPayQrCode={directPayQrCode}
        linkKind={linkKind}
      />
      <SaveChangeModel
        open={saveChangeModalOpen}
        onClose={() => setSaveChangeModalOpen(false)}
        onSave={handleCreatePaymentLink}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 3,
          width: "100%",
        }}
      >
      <PanelCard
        bodyPadding={
          isMobile
            ? 2
            : hasPaymentLinkData
              ? theme.spacing("30px", 2.4, "30px", 2.5)
              : theme.spacing("30px", 2.5, "30px", 2.5)
        }
        sx={{
          mb: hasPaymentLinkData ? 10 : 0,
          maxWidth: { xs: "100%", md: "959px" },
          width: "100%",
          minWidth: 0,
          flex: 1,
          borderRadius: { xs: "8px", md: "14px" },
        }}
      >
        {showActivationBanner && (
          <Box
            data-testid="pay-link-activation-banner"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              p: "14px 16px",
              mb: 2,
              borderRadius: "10px",
              bgcolor: theme.palette.mode === "dark" ? "rgba(255, 152, 0, 0.12)" : "rgba(255, 152, 0, 0.08)",
              border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255, 152, 0, 0.3)" : "rgba(255, 152, 0, 0.4)"}`,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Typography sx={{ fontSize: "18px" }} aria-hidden>⚠️</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  color: theme.palette.mode === "dark" ? "#FFB74D" : "#E65100",
                  lineHeight: 1.4,
                  mb: 0.5,
                }}
              >
                {tPaymentLink("activationRequiredTitle", { defaultValue: "Preview mode — activate to accept real payments" })}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  color: theme.palette.mode === "dark" ? "#FFB74D" : "#E65100",
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                {tPaymentLink("activationRequiredBody", { defaultValue: "You can design and preview your payment link now. To activate it (accept real crypto payments), complete two quick steps: add your business details and at least one payout wallet. It takes ~60 seconds." })}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push("/dashboard?onboarding=1")}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push("/dashboard?onboarding=1");
                    }
                  }}
                  sx={{
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    backgroundColor: theme.palette.mode === "dark" ? "#FFB74D" : "#E65100",
                    color: theme.palette.mode === "dark" ? "#000" : "#FFF",
                    "&:hover": { filter: "brightness(1.1)" },
                    userSelect: "none",
                  }}
                >
                  {tPaymentLink("activationCta", { defaultValue: "Complete setup" })}
                </Box>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push("/wallet")}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push("/wallet");
                    }
                  }}
                  sx={{
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    border: `1px solid ${theme.palette.mode === "dark" ? "#FFB74D" : "#E65100"}`,
                    color: theme.palette.mode === "dark" ? "#FFB74D" : "#E65100",
                    "&:hover": { backgroundColor: theme.palette.mode === "dark" ? "rgba(255,183,77,0.15)" : "rgba(230,81,0,0.10)" },
                    userSelect: "none",
                  }}
                >
                  {tPaymentLink("addWalletCta", { defaultValue: "Add payout wallet" })}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
        {/* Link type: Payment link vs Donation / Crowdfunding (locked in edit mode) */}
        <LinkTypeSelector
          value={linkKind}
          onChange={(k) => setLinkKind(k)}
          disabled={hasPaymentLinkData || disabled}
          isMobile={isMobile}
        />

        {/* Creator-page association hint — makes it clear a donation link is the
            "Buy me a coffee" tip box that surfaces on the merchant's creator page. */}
        {linkKind === "donation" && !hasPaymentLinkData && (
          <Box
            data-testid="donation-creator-hint"
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.25,
              p: "12px 14px",
              mb: 2,
              borderRadius: "10px",
              border: `1px solid ${theme.palette.mode === "dark" ? "rgba(204,255,0,0.32)" : "rgba(160,190,0,0.45)"}`,
              backgroundColor: theme.palette.mode === "dark" ? "rgba(204,255,0,0.08)" : "rgba(204,255,0,0.14)",
            }}
          >
            <Typography sx={{ fontSize: 16, lineHeight: 1.2 }} aria-hidden>&#9749;</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: theme.palette.text.primary, fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>
                {tPaymentLink("donationCreatorHintTitle", { defaultValue: "This becomes your \u201cBuy me a coffee\u201d tip box" })}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.5, mt: 0.25 }}>
                {creatorHandle
                  ? tPaymentLink("donationCreatorHintLive", { defaultValue: "It will be featured at the top of your creator page {{url}}.", url: creatorPublicUrl })
                  : tPaymentLink("donationCreatorHintNoHandle", { defaultValue: "Publish a creator page to feature it as your public tip jar." })}
              </Typography>
              {!creatorHandle && (
                <Box
                  role="button"
                  tabIndex={0}
                  data-testid="donation-creator-hint-cta"
                  onClick={() => router.push("/creator")}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/creator"); } }}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.75, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: theme.palette.primary.main, "&:hover": { textDecoration: "underline" }, userSelect: "none" }}
                >
                  {tPaymentLink("donationCreatorHintSetup", { defaultValue: "Set up your creator page \u2192" })}
                </Box>
              )}
            </Box>
          </Box>
        )}

        {(
          <TabContentContainer
            sx={{
              padding: isMobile
                ? "14px 0px 0px 0px"
                : hasPaymentLinkData
                  ? "0px"
                  : "16px 0px 0px 0px",
            }}
          >
            {hasPaymentLinkData && (
              <PaymentLinkHeader
                tPaymentLink={tPaymentLink}
                paymentLinkData={paymentLinkData as PaymentLink}
                disabled={disabled}
                isMobile={isMobile}
                count={count}
                truncateByWords={truncateByWords}
              />
            )}

            <TabContentContainer sx={{ ...disable }}>
              {linkKind === "donation" ? (
                <DonationSettingsSection
                  isMobile={isMobile}
                  settings={donationSettings}
                  onChange={handleDonationChange}
                  errors={donationErrors}
                  clearError={clearDonationError}
                  currency={paymentSettings.currency}
                  currencies={currencies}
                  onCurrencyChange={(c) => handleCurrencySelect(c)}
                  feePayer={blockchainFees}
                  onFeePayerChange={handleBlockchainFeesChange}
                  onUploadImage={handleUploadCampaignImage}
                  imageUploading={imageUploading}
                />
              ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: { xs: "12px", md: 3 },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Quick-sell product picker (session 49 round 3) —
                      only in CREATE mode + standard link_type. Hidden in
                      edit mode because we don't want to imply the link is
                      "linked" to a product (it's just a form shortcut). */}
                  {!hasPaymentLinkData && (
                    <ProductQuickSell
                      picked={pickedProduct}
                      onPick={handlePickProduct}
                      onClear={handleClearProduct}
                      onVariantChange={handleVariantChange}
                      isMobile={isMobile}
                    />
                  )}
                <PaymentSettingsBasic
                  isMobile={isMobile}
                  tPaymentLink={tPaymentLink}
                  paymentSettings={paymentSettings}
                  paymentSettingsTouched={paymentSettingsTouched}
                  paymentSettingsErrors={paymentSettingsErrors}
                  currencyOpen={currencyOpen}
                  currencies={currencies}
                  expireOpen={expireOpen}
                  blockchainFees={blockchainFees}
                  disable={disable}
                  handlePaymentSettingsChange={handlePaymentSettingsChange}
                  handlePaymentSettingsBlur={handlePaymentSettingsBlur}
                  handleCurrencyOpen={handleCurrencyOpen}
                  handleCurrencyClose={handleCurrencyClose}
                  handleCurrencySelect={handleCurrencySelect}
                  handleExpireOpen={handleExpireOpen}
                  handleExpireClose={handleExpireClose}
                  handleExpireSelect={handleExpireSelect}
                  handleBlockchainFeesChange={handleBlockchainFeesChange}
                  currencyAnchorEl={currencyAnchorEl}
                  currencyTriggerRef={currencyTriggerRef}
                  expireAnchorEl={expireAnchorEl}
                  expireTriggerRef={expireTriggerRef}
                />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <DescriptionSection
                    isMobile={isMobile}
                    tPaymentLink={tPaymentLink}
                    paymentSettings={paymentSettings}
                    paymentSettingsTouched={paymentSettingsTouched}
                    paymentSettingsErrors={paymentSettingsErrors}
                    handlePaymentSettingsChange={handlePaymentSettingsChange}
                    handlePaymentSettingsBlur={handlePaymentSettingsBlur}
                  />
                </Box>
              </Box>
              )}

              {/* CampaignManager — tiers + updates editor. Only shown when
                  editing an existing donation campaign (needs a saved link_id). */}
              {linkKind === "donation" && hasPaymentLinkData && paymentSettings.linkId && (
                <CampaignManager
                  linkId={paymentSettings.linkId}
                  currency={paymentSettings.currency}
                />
              )}

              <Box
                sx={{
                  height: "1px",
                  backgroundColor: theme.palette.border.main,
                }}
              />

              <CryptoSelection
                isMobile={isMobile}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleSearch={handleSearch}
                cryptoItems={cryptoItems}
                allCryptoItems={ALL_CRYPTO_ITEMS}
                filteredCryptoItems={filteredCryptoItems}
                showFilteredCryptoItems={showFilteredCryptoItems}
                showAllCoins={showAllCoins}
                setShowAllCoins={setShowAllCoins}
                hasPaymentLinkData={hasPaymentLinkData}
                isLarge={isLarge}
                isSmall={isSmall}
                walletNotSetUp={walletNotSetUp}
                paymentSettings={paymentSettings}
                setPaymentSettings={setPaymentSettings}
              />

              <Box
                sx={{
                  height: "1px",
                  backgroundColor: theme.palette.border.main,
                }}
              />

              {/* UX-2026-07-08: Progressive disclosure — collapse optional inputs
                  behind an "Advanced options" accordion so the form defaults to
                  5 essentials (Amount, Currency, Cryptos, Title, Expiry). */}
              <Box
                component="details"
                data-testid="pay-link-advanced-options"
                sx={{
                  border: `1px solid ${theme.palette.border.main}`,
                  borderRadius: "10px",
                  padding: 0,
                  overflow: "hidden",
                  "&[open] > summary::after": {
                    transform: "rotate(180deg)",
                  },
                  "& > summary::-webkit-details-marker": { display: "none" },
                }}
              >
                <Box
                  component="summary"
                  sx={{
                    px: isMobile ? 2 : 2.5,
                    py: isMobile ? 1.25 : 1.5,
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    userSelect: "none",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    "&::after": {
                      content: "'▾'",
                      display: "inline-block",
                      transition: "transform 180ms ease",
                      fontSize: 14,
                      color: theme.palette.text.secondary,
                    },
                    "&:hover": {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <span aria-hidden>⚙️</span>
                    {tPaymentLink("advancedOptions", { defaultValue: "Advanced options" })}
                    <Typography
                      component="span"
                      sx={{
                        fontFamily: "var(--font-sans)",
                        fontWeight: 400,
                        fontSize: 12,
                        color: theme.palette.text.secondary,
                        ml: 0.5,
                      }}
                    >
                      {linkKind === "donation"
                        ? t("advancedOptionsHintDonation", { defaultValue: "Webhooks, redirect URL" })
                        : !hasPaymentLinkData
                          ? t("advancedOptionsHintFull", { defaultValue: "Customer email, tax, webhooks" })
                          : tPaymentLink("advancedOptionsHint", { defaultValue: "Customer email, tax" })}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    borderTop: `1px solid ${theme.palette.border.main}`,
                    px: isMobile ? 2 : 2.5,
                    py: 1,
                  }}
                >
                  {linkKind !== "donation" && (
                  <>
                  {/* Optional Customer Email for referral code delivery */}
                  <Box sx={{ py: 2 }}>
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        mb: 1,
                      }}
                    >
                      {tPaymentLink("customerEmail") || "Customer Email"}{" "}
                      <Typography component="span" sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                        ({tPaymentLink("optional") || "Optional"})
                      </Typography>
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        color: theme.palette.text.secondary,
                        mb: 1.5,
                      }}
                    >
                      {tPaymentLink("customerEmailDescription") || "Send payment link and referral code to this email"}
                    </Typography>
                    <Box
                      component="input"
                      type="email"
                      value={customerEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCustomerEmail(e.target.value); setCustomerEmailError(""); }}
                      placeholder={tPaymentLink("customerEmailPlaceholder") || "customer@example.com"}
                      sx={{
                        width: "100%",
                        p: "10px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${customerEmailError ? theme.palette.error.main : theme.palette.border.main}`,
                        bgcolor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        fontFamily: "var(--font-sans)",
                        fontSize: "14px",
                        outline: "none",
                        "&:focus": {
                          borderColor: customerEmailError ? theme.palette.error.main : theme.palette.primary.main,
                        },
                        "&::placeholder": {
                          color: theme.palette.text.disabled,
                        },
                      }}
                    />
                    {customerEmailError && (
                      <Typography
                        sx={{
                          fontSize: "12px",
                          fontFamily: "var(--font-sans)",
                          color: theme.palette.error.main,
                          mt: "4px",
                        }}
                      >
                        {customerEmailError}
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      height: "1px",
                      backgroundColor: theme.palette.border.main,
                    }}
                  />

                  <TaxSection
                    isMobile={isMobile}
                    tPaymentLink={tPaymentLink}
                    includeTax={includeTax}
                    setIncludeTax={setIncludeTax}
                    taxInclusive={taxInclusive}
                    setTaxInclusive={setTaxInclusive}
                    currentLng={currentLng}
                  />
                  </>
                  )}

                  {/* Post-payment settings (webhook / redirect / callback URLs)
                      live INSIDE the Advanced accordion for BOTH create and edit
                      modes (session 53) — previously edit mode duplicated them
                      OUTSIDE the accordion, forcing users to scroll past 3 URL
                      fields every visit even when they never customise them. */}
                  <>
                    {linkKind !== "donation" && (
                      <Box
                        sx={{
                          height: "1px",
                          backgroundColor: theme.palette.border.main,
                        }}
                      />
                    )}
                    <Box sx={{ py: 1 }}>
                      <PostPaymentSettings
                        hasPaymentLinkData={hasPaymentLinkData}
                        isMobile={isMobile}
                        tPaymentLink={tPaymentLink}
                        postPaymentSettings={postPaymentSettings}
                        handleChange={handlePostPaymentSettingsChange}
                      />
                    </Box>
                  </>
                </Box>
              </Box>

              {/* Session 53: removed the duplicate outside-accordion PostPaymentSettings
                  for edit mode — everything is now inside the Advanced options
                  accordion above so the form is short by default. */}
            </TabContentContainer>

            {feePreview && linkKind === "standard" && (
              <Box
                data-testid="fee-preview-display"
                sx={{
                  p: isMobile ? "10px 14px" : "12px 16px",
                  backgroundColor: theme.palette.primary.light,
                  borderRadius: "8px",
                  border: `1px solid ${theme.palette.border.main}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  mb: 1,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                    Estimated Fee ({feePreview.fee_info?.final_fee_percent ?? feePreview.fee_info?.base_fee_percent ?? "—"}%
                    {feePreview.fee_info?.fixed_fee > 0 ? ` + ${feePreview.fee_info.fixed_fee} ${feePreview.currency || paymentSettings.currency} fixed` : ""})
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>
                    {feePreview.fee != null ? `${feePreview.fee} ${feePreview.currency || paymentSettings.currency}` : "—"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 12, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                    {t("youReceive")}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: theme.palette.success?.main || "#22c55e" }}>
                    {feePreview.you_receive != null ? `${feePreview.you_receive} ${feePreview.currency || paymentSettings.currency}` : "—"}
                  </Typography>
                </Box>
                {paymentSettings.blockchainFees === "customer" && feePreview.customer_pays != null && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: 12, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary }}>
                      Customer pays
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>
                      {`${feePreview.customer_pays} ${feePreview.currency || paymentSettings.currency}`}
                    </Typography>
                  </Box>
                )}
                {paymentSettings.blockchainFees && (
                  <Typography sx={{ fontSize: 11, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, opacity: 0.7 }}>
                    Fee paid by: {paymentSettings.blockchainFees === "customer" ? "Customer" : "Company"}
                  </Typography>
                )}
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? "14px" : "24px",
              }}
            >
              <ActionButtons
                isMobile={isMobile}
                hasPaymentLinkData={hasPaymentLinkData}
                disabled={disabled}
                tPaymentLink={tPaymentLink}
                handleCreatePaymentLink={
                  hasPaymentLinkData
                    ? handleSaveChanges
                    : handleCreatePaymentLink
                }
                paymentSettingsErrors={paymentSettingsErrors}
                paymentSettings={paymentSettings}
                isCreating={isCreating}
                requireAmount={linkKind !== "donation"}
                extraDisabled={linkKind === "donation" && !donationSettings.title.trim()}
                linkKind={linkKind}
              />
            </Box>
          </TabContentContainer>
        )}
      </PanelCard>

      {/* ── Live preview (desktop only) ─────────────────────────────── */}
      <Box
        sx={{
          width: 350,
          flexShrink: 0,
          position: "sticky",
          top: 24,
          display: { xs: "none", lg: "block" },
        }}
      >
        <LivePreviewPanel
          linkKind={linkKind}
          amount={paymentSettings.value}
          currency={paymentSettings.currency}
          clientName={paymentSettings.clientName}
          description={paymentSettings.description}
          donation={donationSettings}
          purpose={paymentSettings.description}
          acceptedCount={paymentSettings.acceptedCryptoCurrency?.length || 0}
          companyName={
            (companyListForBanner.find(
              (c: any) => c.company_id === selectedCompanyId
            ) || {})?.company_name || null
          }
        />
      </Box>
      </Box>

      {/* ── Live preview: mobile / tablet-portrait (< lg) — on-demand bottom sheet ── */}
      <Box
        onClick={() => setPreviewOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setPreviewOpen(true);
          }
        }}
        aria-label={t("livePreview", { defaultValue: "Live preview" })}
        data-testid="mobile-preview-fab"
        sx={{
          display: { xs: "flex", lg: "none" },
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 1250,
          alignItems: "center",
          gap: "8px",
          height: 48,
          px: "18px",
          borderRadius: "999px",
          cursor: "pointer",
          color: "#fff",
          background: `linear-gradient(90deg, #10B981 0%, ${theme.palette.primary.main} 100%)`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
          userSelect: "none",
          transition: "transform 120ms ease",
          "&:active": { transform: "scale(0.96)" },
        }}
      >
        <Icon icon="mdi:eye-outline" width={20} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-sans)" }}>
          {t("previewButton", { defaultValue: "Preview" })}
        </Typography>
      </Box>

      <Drawer
        anchor="bottom"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data-testid="mobile-preview-drawer"
        sx={{
          display: { lg: "none" },
          "& .MuiDrawer-paper": {
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: "88vh",
            backgroundColor: theme.palette.background.default,
            backgroundImage: "none",
            px: 2,
            pt: 1.5,
            pb: 3,
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 999,
            bgcolor: theme.palette.border.main,
            mx: "auto",
            mb: 1.5,
          }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 700,
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
            }}
          >
            {t("livePreview", { defaultValue: "Live preview" })}
          </Typography>
          <IconButton
            onClick={() => setPreviewOpen(false)}
            size="small"
            aria-label="close"
            data-testid="mobile-preview-close"
            sx={{ color: theme.palette.text.secondary }}
          >
            <Icon icon="mdi:close" width={22} />
          </IconButton>
        </Box>
        <Box sx={{ overflowY: "auto", maxWidth: 440, width: "100%", mx: "auto", pb: 1 }}>
          <LivePreviewPanel
            linkKind={linkKind}
            amount={paymentSettings.value}
            currency={paymentSettings.currency}
            clientName={paymentSettings.clientName}
            description={paymentSettings.description}
            donation={donationSettings}
            purpose={paymentSettings.description}
            acceptedCount={paymentSettings.acceptedCryptoCurrency?.length || 0}
            companyName={
              (companyListForBanner.find(
                (c: any) => c.company_id === selectedCompanyId
              ) || {})?.company_name || null
            }
          />
        </Box>
      </Drawer>

    </div>
  );
};

export default CreatePaymentLinkPage;
