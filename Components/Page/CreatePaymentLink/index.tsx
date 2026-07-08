import PanelCard from "@/Components/UI/PanelCard";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
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
  PaymentLinkHeader,
  PaymentSettingsBasic,
  PostPaymentSettings,
  TabNavigation,
  TaxSection,
} from "@/Components/UI/pay-link";
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
}: CreatePaymentLinkPageProps) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t } = useTranslation("createPaymentLinkScreen");
  const paymentLinkState = useSelector((state: any) => state.paymentLinkReducer);
  const feePreview = paymentLinkState?.feePreview;
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
    (key: string): string => {
      const result = t(key, { ns: "createPaymentLinkScreen" });
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
  const [showAllCoins, setShowAllCoins] = useState(false);
  const MIN_WIDTH = 390;
  const MAX_WIDTH = 900;
  const BASE_COUNT = 15;
  const STEP = 10;

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [count, setCount] = useState(BASE_COUNT);

  const [currencyOpen, setCurrencyOpen] = useState(false);

  const currencies = ["USD", "EUR", "GBP", "INR", "PKR", "AED"];

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

  // Fetch fee preview when amount or currency changes
  useEffect(() => {
    const amount = parseFloat(paymentSettings.value);
    if (amount > 0 && paymentSettings.currency) {
      const timer = setTimeout(() => {
        dispatch(
          PaymentLinkAction(PAYLINK_FEE_PREVIEW, {
            amount,
            currency: paymentSettings.currency,
          })
        );
      }, 500); // debounce
      return () => clearTimeout(timer);
    }
  }, [paymentSettings.value, paymentSettings.currency, dispatch]);

  const handleCreatePaymentLink = () => {
    // Prevent multiple rapid clicks — use createLoading (not generic loading which can be stuck from fee preview)
    if (isCreating || paymentLinkState?.createLoading) return;

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
    const apiPayload: any = {
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
      company_id: selectedCompanyId,
    };

    if (customerEmail.trim()) {
      apiPayload.customer_email = customerEmail.trim();
    }

    // Dispatch to Redux saga which calls the API
    if (hasPaymentLinkData) {
      dispatch(
        PaymentLinkAction(PAYLINK_UPDATE, {
          id: (paymentLinkData as PaymentLink).link_id,
          ...apiPayload,
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
      setPaymentLink("");
      setDirectPayAddress(null);
      setDirectPayQrCode(null);
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
      <PaymentLinkSuccessModal
        open={successModalOpen}
        onClose={handleCloseSuccessModal}
        paymentLink={paymentLink}
        paymentSettings={paymentSettings}
        onCopyLink={handleCopyLink}
        walletList={walletList}
        directPayAddress={directPayAddress}
        directPayQrCode={directPayQrCode}
      />
      <SaveChangeModel
        open={saveChangeModalOpen}
        onClose={() => setSaveChangeModalOpen(false)}
        onSave={handleCreatePaymentLink}
      />

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
          borderRadius: { xs: "8px", md: "14px" },
        }}
      >
        {!hasActiveApiKey && !apiState?.loading && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: "12px 16px",
              mb: 2,
              borderRadius: "10px",
              bgcolor: theme.palette.mode === "dark" ? "rgba(255, 152, 0, 0.12)" : "rgba(255, 152, 0, 0.08)",
              border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255, 152, 0, 0.3)" : "rgba(255, 152, 0, 0.4)"}`,
            }}
          >
            <Typography sx={{ fontSize: "18px" }}>⚠️</Typography>
            <Typography
              sx={{
                fontSize: "13px",
                fontFamily: "UrbanistMedium",
                color: theme.palette.mode === "dark" ? "#FFB74D" : "#E65100",
                lineHeight: 1.4,
              }}
            >
              {tPaymentLink("noApiKeyWarning") || "No active API key found. Please create an API key in Developer Settings before creating payment links. An API key is automatically created when you complete onboarding."}
            </Typography>
          </Box>
        )}
        <TabNavigation
          activeTab={activeTab}
          onChange={handleTabChange}
          tPaymentLink={tPaymentLink}
          hasPaymentLinkData={hasPaymentLinkData}
        />

        {activeTab === 0 && (
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
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: { xs: "12px", md: 3 },
                }}
              >
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

              {/* Optional Customer Email for referral code delivery */}
              <Box sx={{ py: 2 }}>
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontFamily: "UrbanistSemiBold",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 1,
                  }}
                >
                  {tPaymentLink("customerEmail") || "Customer Email"}{" "}
                  <Typography component="span" sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "UrbanistRegular" }}>
                    ({tPaymentLink("optional") || "Optional"})
                  </Typography>
                </Typography>
                <Typography
                  sx={{
                    fontSize: "12px",
                    fontFamily: "UrbanistRegular",
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
                    fontFamily: "UrbanistRegular",
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
                      fontFamily: "UrbanistMedium",
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
                currentLng={currentLng}
              />

              {hasPaymentLinkData && (
                <Box
                  sx={{
                    height: "1px",
                    backgroundColor: theme.palette.border.main,
                  }}
                />
              )}

              {hasPaymentLinkData && (
                <PostPaymentSettings
                  hasPaymentLinkData={hasPaymentLinkData}
                  isMobile={isMobile}
                  tPaymentLink={tPaymentLink}
                  postPaymentSettings={postPaymentSettings}
                  handleChange={handlePostPaymentSettingsChange}
                />
              )}
            </TabContentContainer>

            {feePreview && (
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
                  <Typography sx={{ fontSize: 13, fontFamily: "UrbanistMedium", color: theme.palette.text.secondary }}>
                    Estimated Fee ({feePreview.fee_info?.final_fee_percent ?? feePreview.fee_info?.base_fee_percent ?? "—"}%)
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontFamily: "UrbanistSemiBold", color: theme.palette.text.primary }}>
                    {feePreview.fee != null ? `${feePreview.fee} ${feePreview.currency || paymentSettings.currency}` : "—"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 12, fontFamily: "UrbanistMedium", color: theme.palette.text.secondary }}>
                    {t("youReceive")}
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontFamily: "UrbanistSemiBold", color: theme.palette.success?.main || "#22c55e" }}>
                    {feePreview.you_receive != null ? `${feePreview.you_receive} ${feePreview.currency || paymentSettings.currency}` : "—"}
                  </Typography>
                </Box>
                {paymentSettings.blockchainFees && (
                  <Typography sx={{ fontSize: 11, fontFamily: "UrbanistRegular", color: theme.palette.text.secondary, opacity: 0.7 }}>
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
              />
            </Box>
          </TabContentContainer>
        )}

        {activeTab === 1 && (
          <TabContentContainer
            sx={{ padding: isMobile ? "14px 0px 0px 0px" : "16px 0px 0px 0px" }}
          >
            <PostPaymentSettings
              hasPaymentLinkData={hasPaymentLinkData}
              isMobile={isMobile}
              tPaymentLink={tPaymentLink}
              postPaymentSettings={postPaymentSettings}
              handleChange={handlePostPaymentSettingsChange}
              showHelpers={true}
              showCreateButton={true}
              onCreate={handleCreatePaymentLink}
              createDisabled={
                isCreating ||
                !paymentSettings.value ||
                paymentSettings.value.trim() === "" ||
                !paymentSettings.currency ||
                !paymentSettings.acceptedCryptoCurrency ||
                paymentSettings.acceptedCryptoCurrency.length === 0
              }
            />
          </TabContentContainer>
        )}
      </PanelCard>
    </div>
  );
};

export default CreatePaymentLinkPage;
