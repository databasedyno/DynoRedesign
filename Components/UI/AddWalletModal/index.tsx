import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import InfoIcon from "@/assets/Icons/info-icon.svg";
// WalletIcon was used as a tinted header icon; removed in the 2025-07
// Coinbase-clean pass — title + subtitle carry the header without decoration.
import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CryptocurrencySelector from "@/Components/UI/CryptocurrencySelector";
import OtpDialog from "@/Components/UI/OtpDialog";
import PopupModal from "@/Components/UI/PopupModal";
import WalletReuseSelector from "@/Components/UI/WalletReuseSelector";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { UserAction } from "@/Redux/Actions";
import { USER_LOGIN, USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { verifyOtp } from "@/utils/walletOtp";
import { detectAddressKind, addrKindLabel, EVM_CURRENCIES, TRON_CURRENCIES } from "@/utils/walletAddressType";
import { rootReducer } from "@/utils/types";
import { Address, AddWalletModalProps } from "@/utils/types/wallet";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { Icon } from "@/styles/uiKit";
import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import PanelCard from "../PanelCard";
import { API_ENDPOINTS } from "@/api/endpoints";
import {
  WarningContainer,
  WarningContent,
  WarningIconContainer,
} from "./styled";

const AddWalletModal: React.FC<AddWalletModalProps> = ({
  open,
  onClose,
  currentCryptocurrency = "",
  fiatData = [],
  cryptoData = [],
  onWalletAdded,
  headerExtra,
  companyId: propCompanyId,
  editMode = false,
  editWalletId,
  editWalletName: editWalletNameProp = "",
  editWalletAddress: editWalletAddressProp = "",
  editDestinationTag: editDestinationTagProp = "",
}) => {
  const dispatch = useDispatch();
  const muiTheme = useTheme();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const companyState = useCompanyStore();
  const companyId = propCompanyId || companyState.selectedCompanyId || companyState.companyList?.[0]?.company_id;
  const isMobile = useIsMobile("sm");
  const { t } = useTranslation("walletScreen");
  const tWallet = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      const result = t(key, { ns: "walletScreen", ...(options || {}) });
      return typeof result === "string" ? result : String(result);
    },
    [t],
  );
  const [walletName, setWalletName] = useState("");
  const [cryptocurrency, setCryptocurrency] = useState("");
  // Name is optional — an empty label falls back to "<COIN> wallet" so a pasted address is enough to continue.
  const effectiveWalletName = walletName.trim() || (cryptocurrency ? `${cryptocurrency} wallet` : "");
  const [walletAddress, setWalletAddress] = useState("");
  const [xrpTag, setXrpTag] = useState("");
  const [errors, setErrors] = useState<{
    walletName?: string;
    cryptocurrency?: string;
    walletAddress?: string;
    xrpTag?: string;
  }>({});
  const [popupLoading, setPopupLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [address, setAddress] = useState<Address | null>(null);
  const [otpError, setOtpError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeCryptoDropdown, setCloseCryptoDropdown] = useState(false);
  const [walletsAdded, setWalletsAdded] = useState(0); // Track how many wallets added in this session
  const [showSuccessChoice, setShowSuccessChoice] = useState(false); // Show add-more/done choice

  // Watch WALLET_ADDRESS_ERROR from the saga and surface it inline on the
  // right field. WalletSaga's catch also fires a toast, so this is purely
  // additive — the merchant now sees the message next to the offending
  // field (address / name / currency) instead of just a corner toast.
  const walletState = useWalletStore();
  const lastAddressErrorNonceRef = React.useRef<number>(walletState?.addressErrorNonce || 0);
  useEffect(() => {
    const nonce = walletState?.addressErrorNonce || 0;
    if (nonce === lastAddressErrorNonceRef.current) return;
    lastAddressErrorNonceRef.current = nonce;
    const field = walletState?.addressErrorField as string | null;
    const message = walletState?.addressError as string | null;
    if (!field || !message) return;
    // Any address-validate failure means we're no longer submitting
    setPopupLoading(false);
    setIsSubmitting(false);
    // The wallet field ids used by mapBackendErrorToField already match this
    // component's error keys, so we just spread.
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, [
    walletState?.addressErrorNonce,
    walletState?.addressErrorField,
    walletState?.addressError,
  ]);

  // Email-required gate — wallet security OTPs are delivered by email, so a verified email is required.
  const [needsEmail, setNeedsEmail] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateEmailError, setGateEmailError] = useState("");
  const [gateEmailLoading, setGateEmailLoading] = useState(false);
  const [gateOtpOpen, setGateOtpOpen] = useState(false);
  const [gateOtpError, setGateOtpError] = useState("");
  const [gateOtpLoading, setGateOtpLoading] = useState(false);
  const [gateOtpCountdown, setGateOtpCountdown] = useState(0);

  useEffect(() => {
    if (!open) return;
    // Determine the email gate from the freshest source (Redux state can be stale on a direct page load).
    let cancelled = false;
    (async () => {
      try {
        const res: any = await axiosBaseApi.get("user/profile");
        const d = res?.data?.data || {};
        if (!cancelled) setNeedsEmail(!(d.email && d.email_verified));
      } catch {
        if (!cancelled) setNeedsEmail(!(userState?.email && userState?.email_verified));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (gateOtpCountdown > 0) {
      const tmr = setTimeout(() => setGateOtpCountdown((c) => c - 1), 1000);
      return () => clearTimeout(tmr);
    }
  }, [gateOtpCountdown]);

  const handleSendGateEmailOtp = async () => {
    const email = gateEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGateEmailError(tWallet("emailInvalid"));
      return;
    }
    setGateEmailError("");
    setGateEmailLoading(true);
    try {
      await axiosBaseApi.post("user/addEmail", { email });
      setGateOtpOpen(true);
      setGateOtpCountdown(30);
      dispatch({ type: TOAST_SHOW, payload: { message: "Verification code sent to your email" } });
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Failed to send verification code";
      setGateEmailError(msg);
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setGateEmailLoading(false);
    }
  };

  const handleVerifyGateEmailOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setGateOtpError("Please enter a valid 6-digit code");
      return;
    }
    setGateOtpError("");
    setGateOtpLoading(true);
    try {
      const res: any = await axiosBaseApi.post("user/verifyAddEmail", {
        email: gateEmail.trim(),
        otp,
      });
      const { data } = res.data || {};
      if (data?.userData && data?.accessToken) {
        dispatch({ type: USER_LOGIN, payload: { ...data.userData, accessToken: data.accessToken } });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      setGateOtpOpen(false);
      setNeedsEmail(false);
      setGateEmail("");
      dispatch({ type: TOAST_SHOW, payload: { message: "Email verified! You can now add your wallet." } });
    } catch (e: any) {
      setGateOtpError(e?.response?.data?.message || "Verification failed");
    } finally {
      setGateOtpLoading(false);
    }
  };

  // Chains that use destination tags (XRP Ledger)
  const TAG_BASED_CHAINS = ["XRP", "RLUSD"];

  useEffect(() => {
    if (currentCryptocurrency) {
      setCryptocurrency(currentCryptocurrency);
    }
  }, [currentCryptocurrency]);

  // Populate form fields in edit mode
  useEffect(() => {
    if (editMode && open) {
      if (editWalletNameProp) setWalletName(editWalletNameProp);
      if (editWalletAddressProp) setWalletAddress(editWalletAddressProp);
      setXrpTag(editDestinationTagProp || "");
    }
  }, [editMode, open, editWalletNameProp, editWalletAddressProp, editDestinationTagProp]);

  const isEditAddressChanged = editMode && walletAddress.trim() !== editWalletAddressProp;
  const isEditTagChanged = editMode && xrpTag.trim() !== (editDestinationTagProp || "");
  // Address (or destination-tag) changes are security-sensitive -> email OTP.
  const editNeedsOtp = isEditAddressChanged || isEditTagChanged;

  const finishSuccess = (message: string) => {
    walletState.refetchWallets();
    dispatch({ type: TOAST_SHOW, payload: { message, severity: "success" } });
  };

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!cryptocurrency) {
      newErrors.cryptocurrency = tWallet("cryptocurrencyRequired");
    }

    if (!walletAddress.trim()) {
      newErrors.walletAddress = tWallet("walletAddressRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!otpModalOpen) {
      setOtpError("");
    }
  }, [otpModalOpen]);

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setPopupLoading(true);

      if (editMode && editWalletId) {
        if (editNeedsOtp) {
          // Address / tag change -> dedicated edit flow: OTP is issued against
          // THIS wallet_id (the add-flow validator would reject the currency as
          // "already exists" because the wallet being edited is that wallet).
          const response: any = await axiosBaseApi.post(
            API_ENDPOINTS.wallet.updateWalletSendOtp,
            { wallet_id: editWalletId, company_id: companyId },
          );
          if (response.status !== 200 || response.error) {
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: response?.data?.message ?? "Failed to send verification code",
                severity: "error",
              },
            });
            setPopupLoading(false);
            setIsSubmitting(false);
            return;
          }
          setAddress({
            wallet_address: walletAddress.trim(),
            currency: cryptocurrency,
            company_id: companyId,
            wallet_name: effectiveWalletName,
          });
          setPopupLoading(false);
          setIsSubmitting(false);
          setOtpModalOpen(true);
        } else {
          // Name-only change — call edit endpoint directly (no OTP required)
          const response: any = await axiosBaseApi.put(
            API_ENDPOINTS.wallet.updateWallet(editWalletId),
            { wallet_name: effectiveWalletName },
          );
          if (response.status === 200 && !response.error) {
            finishSuccess(tWallet("walletUpdated", { defaultValue: "Wallet updated successfully" }));
            handleClose();
          } else {
            dispatch({
              type: TOAST_SHOW,
              payload: {
                message: response?.data?.message ?? "Failed to update wallet",
                severity: "error",
              },
            });
          }
          setPopupLoading(false);
          setIsSubmitting(false);
        }
        return;
      }

      // Add mode (original flow)
      const values: any = {
        wallet_address: walletAddress.trim(),
        currency: cryptocurrency,
        company_id: companyId,
        wallet_name: effectiveWalletName,
      };

      if (TAG_BASED_CHAINS.includes(cryptocurrency) && xrpTag.trim()) {
        values.destination_tag = xrpTag.trim();
      }

      const response: any = await axiosBaseApi.post(
        API_ENDPOINTS.wallet.validateWalletAddress,
        values,
      );

      if (response.status !== 200 || response.error) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.data?.message ?? "Failed to add wallet address",
            severity: "error",
          },
        });
        setPopupLoading(false);
        setIsSubmitting(false);
        return;
      }

      setAddress({ ...values, wallet_name: effectiveWalletName });
      setPopupLoading(false);
      setIsSubmitting(false);

      // Don't call onClose() here — it would unmount the component
      // (OnboardingFlow sets phase="done" on close, removing the OTP dialog).
      // Instead, just open the OTP dialog on top of the wallet modal.
      setOtpModalOpen(true);
    } catch (error: any) {
      console.error("Error adding wallet address:", error);
      if (error?.response?.data?.code === "EMAIL_VERIFICATION_REQUIRED") {
        setNeedsEmail(true);
        setPopupLoading(false);
        setIsSubmitting(false);
        return;
      }
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message:
            error?.response?.data?.message ??
            error.message ??
            "Something went wrong",
          severity: "error",
        },
      });
      setPopupLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleEditOtpVerify = async (otp: string) => {
    setOtpLoading(true);
    setOtpError("");
    try {
      const payload: Record<string, unknown> = {
        wallet_id: editWalletId,
        company_id: companyId,
        otp,
        wallet_name: effectiveWalletName,
      };
      if (isEditAddressChanged) payload.wallet_address = walletAddress.trim();
      if (TAG_BASED_CHAINS.includes(cryptocurrency)) payload.destination_tag = xrpTag.trim() || null;
      const response: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.updateWalletWithOtp, payload);
      if (response.status === 200 && !response.error) {
        setOtpModalOpen(false);
        finishSuccess(response?.data?.message || tWallet("walletUpdated", { defaultValue: "Wallet updated successfully" }));
        handleClose();
      } else {
        setOtpError(response?.data?.message || "Invalid OTP. Please try again.");
      }
    } catch (error: any) {
      setOtpError(error?.response?.data?.message || "OTP verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpVerify = async (otp: string) => {
    if (editMode) return handleEditOtpVerify(otp);
    setOtpLoading(true);
    setOtpError("");

    let currencyType: "FIAT" | "CRYPTO" | null = null;

    if (fiatData.some((item) => item.wallet_type === address?.currency)) {
      currencyType = "FIAT";
    } else if (
      cryptoData.some((item) => item.wallet_type === address?.currency)
    ) {
      currencyType = "CRYPTO";
    }

    try {
      const response = await verifyOtp({
        otp: otp,
        wallet_address: address?.wallet_address,
        currency: address?.currency,
        currency_type: currencyType,
        company_id: companyId,
        wallet_name: effectiveWalletName || address?.wallet_name,
      });

      if (response.status) {
        setOtpModalOpen(false);
        setAddress(null);
        // Reset form state without calling onClose() (which unmounts the component in OnboardingFlow)
        setWalletName("");
        setCryptocurrency("");
        setWalletAddress("");
        setXrpTag("");
        setErrors({});
        setPopupLoading(false);
        setIsSubmitting(false);
        setWalletsAdded((prev) => prev + 1);
        finishSuccess(response?.message);
        // Success choice: Add another / Done (Wallets page + onboarding alike)
        setShowSuccessChoice(true);
      } else {
        setOtpError(response?.message || "Invalid OTP. Please try again.");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.message || "OTP verification failed",
            severity: "error",
          },
        });
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "OTP verification failed";
      setOtpError(errorMessage);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: errorMessage,
          severity: "error",
        },
      });
      console.error("OTP verification failed:", error);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!address) return;

    try {
      setOtpError("");
      const response: any = editMode
        ? await axiosBaseApi.post(API_ENDPOINTS.wallet.updateWalletSendOtp, {
            wallet_id: editWalletId,
            company_id: companyId,
          })
        : await axiosBaseApi.post(API_ENDPOINTS.wallet.validateWalletAddress, address);

      if (response.status === 200 && !response.error) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: "OTP has been resent to your email",
            severity: "success",
          },
        });
      } else {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: response?.data?.message ?? "Failed to resend OTP",
            severity: "error",
          },
        });
      }
    } catch (error: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: error?.response?.data?.message ?? "Failed to resend OTP",
          severity: "error",
        },
      });
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;

    setCloseCryptoDropdown(true);
    setWalletName("");
    setCryptocurrency("");
    setWalletAddress("");
    setXrpTag("");
    setErrors({});
    setPopupLoading(false);
    setOtpModalOpen(false);
    setAddress(null);
    setIsSubmitting(false);
    setShowSuccessChoice(false);
    setWalletsAdded(0);
    onClose();
  };

  return (
    <>
    <PopupModal
      open={open && !otpModalOpen && !gateOtpOpen}
      handleClose={handleClose}
      showHeader={false}
      hasFooter={false}
      transparent={true}
      disableEscapeKeyDown={isSubmitting}
      onClose={(event, reason) => {
        if (isSubmitting) {
          return;
        }
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          handleClose();
        }
      }}
      sx={{
        // Move 2 (usability restructuring): add-wallet is a right-side PANEL
        // that slides over the wallet list (full-screen sheet <768px) instead
        // of a centered pop-up hiding the list behind it.
        "& .MuiDialog-container": { justifyContent: "flex-end", alignItems: "stretch" },
        "& .MuiDialog-paper": {
          width: "100%",
          maxWidth: { xs: "100%", md: "481px" },
          height: "100%",
          maxHeight: "100%",
          m: 0,
          p: 2,
          borderRadius: 0,
          overflowY: "auto",
          border: (t) =>
            `1px solid ${
              t.palette.mode === "dark"
                ? "rgba(255,255,255,0.08)"
                : "rgba(15,15,20,0.08)"
            }`,
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "-24px 0 60px -20px rgba(0,0,0,0.7)"
              : "-24px 0 60px -30px rgba(15,15,20,0.25)",
        },
      }}
    >
      {headerExtra && (
        <Box sx={{ px: isMobile ? 2 : 3.75, pt: isMobile ? 2 : 2.5 }}>
          {headerExtra}
        </Box>
      )}

      {/* Success choice: Add Another or Done */}
      {showSuccessChoice ? (
        <Box sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          px: isMobile ? 2 : 3.75,
          py: isMobile ? 3 : 4,
          textAlign: "center",
        }}>
          <Box sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: muiTheme.palette.success?.light || "#e8f5e9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 1,
          }}>
            <Typography sx={{ fontSize: 28 }}>✓</Typography>
          </Box>
          <Typography sx={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
          }}>
            {walletsAdded === 1 ? tWallet("walletAddedSuccess") : t("walletsAddedCount", { count: walletsAdded })}
          </Typography>
          <Typography sx={{
            fontSize: isMobile ? 13 : 14,
            color: muiTheme.palette.text.secondary,
            fontFamily: "var(--font-sans)",
          }}>
            {tWallet("addAnotherWalletPrompt")}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mt: 1, width: "100%" }}>
            <CustomButton
              label={tWallet("done")}
              variant="outlined"
              data-testid="wallet-success-done-btn"
              onClick={() => {
                setShowSuccessChoice(false);
                setWalletsAdded(0);
                if (onWalletAdded) onWalletAdded();
                else handleClose();
              }}
              sx={{ flex: 1 }}
            />
            <CustomButton
              label={tWallet("addAnother")}
              variant="primary"
              data-testid="wallet-success-add-another-btn"
              onClick={() => {
                setShowSuccessChoice(false);
                // Form is already reset, just show it again
              }}
              sx={{ flex: 1 }}
            />
          </Box>
        </Box>
      ) : (
      <Box data-testid={editMode ? "edit-wallet-dialog" : "add-wallet-dialog"}>
      <PanelCard
        title={editMode ? tWallet("editWalletTitle") : tWallet("addWalletTitle")}
        subTitle={
          editMode
            ? tWallet("editWalletSubtitle", { defaultValue: "Update your payout wallet details." })
            : tWallet("addWalletSubtitle", { defaultValue: "Pick a coin and paste your wallet address — we'll verify before saving." })
        }
        showHeaderBorder={false}
        bodyPadding={
          isMobile
            ? muiTheme.spacing(1.5, 2, 2, 2)
            : muiTheme.spacing(1.5, 3.75, 3.75, 3.75)
        }
        headerPadding={
          isMobile
            ? muiTheme.spacing(2, 2, 0, 2)
            : muiTheme.spacing(3.25, 3.75, 0, 3.75)
        }
        headerActionLayout="inline"
      >
        {needsEmail ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }} data-testid="wallet-email-gate">
            <Typography
              sx={{
                fontSize: isMobile ? "14px" : "16px",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
              }}
            >
              {tWallet("emailRequiredTitle")}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "13px" : "14px",
                color: muiTheme.palette.text.secondary,
                fontFamily: "var(--font-sans)",
                lineHeight: 1.4,
              }}
            >
              {tWallet("emailRequiredDesc")}
            </Typography>
            <InputField
              data-testid="wallet-gate-email-input"
              label={tWallet("emailAddressLabel")}
              placeholder={tWallet("emailAddressPlaceholder")}
              value={gateEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setGateEmail(e.target.value);
                if (gateEmailError) setGateEmailError("");
              }}
              error={!!gateEmailError}
              helperText={gateEmailError}
            />
            <Box sx={{ display: "flex", gap: "20px", mt: isMobile ? "8px" : "12px" }}>
              <CustomButton
                label={tWallet("cancel")}
                variant="outlined"
                onClick={handleClose}
                sx={{ flex: 1 }}
              />
              <CustomButton
                data-testid="wallet-gate-send-otp-btn"
                label={tWallet("sendCode")}
                variant="primary"
                onClick={handleSendGateEmailOtp}
                disabled={gateEmailLoading || !gateEmail.trim()}
                startIcon={gateEmailLoading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : undefined}
                sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        ) : (
        <>
        {!editMode && (
          <WalletReuseSelector
            targetCompanyId={companyId}
            onCopied={(n) => {
              if (n > 0) {
                setWalletsAdded((p) => p + n);
                onWalletAdded?.();
              }
            }}
          />
        )}
        {!editMode && (
          <Typography
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              lineHeight: isMobile ? "16px" : "18px",
              mb: isMobile ? "14px" : "16px",
            }}
          >
            {tWallet("addWalletDescription")}
          </Typography>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <InputField
            label={tWallet("walletName")}
            placeholder={tWallet("walletNamePlaceholder")}
            value={walletName}
            onChange={(e) => {
              setWalletName(e.target.value);
            }}
            error={!!errors.walletName}
            helperText={errors.walletName || tWallet("walletNameHelper")}
          />
          <CryptocurrencySelector
            label={tWallet("cryptocurrency") + " *"}
            value={cryptocurrency}
            onChange={(value) => {
              setCryptocurrency(value);
            }}
            locked={editMode}
            showAllWithDisabled={!editMode}
            error={!!errors.cryptocurrency}
            helperText={errors.cryptocurrency}
            sxIconChip={{
              [muiTheme.breakpoints.down("sm")]: {
                height: "26px",
                padding: "4px 6px",
                "& img": {
                  width: "14px",
                  height: "14px",
                },
              },
            }}
            closeDropdownTrigger={closeCryptoDropdown}
          />
          <InputField
            label={tWallet("walletAddress") + " *"}
            placeholder={tWallet("walletAddressPlaceholder")}
            value={walletAddress}
            onChange={(e) => {
              setWalletAddress(e.target.value);
              if (errors.walletAddress) {
                setErrors({ ...errors, walletAddress: undefined });
              }
            }}
            error={!!errors.walletAddress}
            helperText={
              errors.walletAddress ||
              (editNeedsOtp
                ? tWallet("editOtpNotice", { defaultValue: "Changing the address requires a one-time code sent to your email." })
                : tWallet("walletAddressHelper"))
            }
            data-testid="wallet-address-input"
          />

          {(() => {
            const kind = detectAddressKind(walletAddress);
            if (kind === "unknown" || !cryptocurrency) return null;
            const expectsEvm = (EVM_CURRENCIES as readonly string[]).includes(cryptocurrency);
            const expectsTron = (TRON_CURRENCIES as readonly string[]).includes(cryptocurrency);
            const matches = (kind === "evm" && expectsEvm) || (kind === "tron" && expectsTron);
            if (matches) return null;
            return (
              <Typography
                data-testid="wallet-address-network-mismatch"
                sx={{
                  mt: 0.75,
                  fontSize: 12.5,
                  fontFamily: "var(--font-sans)",
                  color: muiTheme.palette.mode === "dark" ? "#FB7185" : "#BE123C",
                  lineHeight: 1.45,
                }}
              >
                {tWallet("networkMismatchWarn", {
                  kind: addrKindLabel(kind),
                  coin: cryptocurrency,
                  defaultValue: "This looks like a {{kind}} address, but you selected {{coin}}. Double-check you're on the right network before saving.",
                })}
              </Typography>
            );
          })()}

          <WarningContainer>
            <WarningIconContainer>
              <Image
                src={InfoIcon}
                alt="info icon"
                width={16}
                height={16}
                draggable={false}
                style={{ filter: "brightness(0)" }}
              />
            </WarningIconContainer>
            <WarningContent>
              <p>{tWallet("warningMessage")}</p>
            </WarningContent>
          </WarningContainer>

          {TAG_BASED_CHAINS.includes(cryptocurrency) && (
            <>
              <InputField
                label={tWallet("XRPTag")}
                placeholder={tWallet("XRPTagPlaceholder")}
                value={xrpTag}
                onChange={(e) => {
                  setXrpTag(e.target.value);
                  if (errors.xrpTag) {
                    setErrors({ ...errors, xrpTag: undefined });
                  }
                }}
                error={!!errors.xrpTag}
                helperText={errors.xrpTag}
              />

              <WarningContainer>
                <WarningIconContainer>
                  <Image
                    src={InfoIcon}
                    alt="info icon"
                    width={16}
                    height={16}
                    draggable={false}
                    style={{ filter: "brightness(0)" }}
                  />
                </WarningIconContainer>
                <WarningContent>
                  <p>{tWallet("XRPTagWarning")}</p>
                </WarningContent>
              </WarningContainer>
            </>
          )}
        </Box>
        {/* Plan 3.3 — OTP-marked sensitive change: tell the merchant up front
            that saving a NEW wallet address is confirmed by an emailed code
            (edit mode already says so in the address helper + button). */}
        {!editMode && (
          <Typography
            data-testid="wallet-otp-notice"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              mt: isMobile ? "12px" : "16px",
              fontSize: 12.5,
              fontFamily: "var(--font-sans)",
              color: muiTheme.palette.text.secondary,
              lineHeight: 1.45,
            }}
          >
            <Icon name="lock" size={14} />
            {tWallet("addOtpNotice", { defaultValue: "We'll email you a 6-digit code to confirm this wallet before it's saved." })}
          </Typography>
        )}
        <Box
          sx={{ display: "flex", gap: "20px", mt: isMobile ? "14px" : "20px" }}
        >
          <CustomButton
            label={tWallet("cancel")}
            variant="outlined"
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{
              flex: 1,
              [muiTheme.breakpoints.down("sm")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
          <CustomButton
            label={
              editMode
                ? editNeedsOtp
                  ? tWallet("verifyAndSave", { defaultValue: "Verify & save" })
                  : tWallet("saveChanges")
                : tWallet("continue")
            }
            variant="primary"
            data-testid="wallet-submit-btn"
            onClick={handleSubmit}
            disabled={popupLoading || isSubmitting || !cryptocurrency || !walletAddress.trim()}
            startIcon={popupLoading || isSubmitting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : undefined}
            sx={{
              flex: 1,
              [muiTheme.breakpoints.down("sm")]: {
                height: "32px",
                fontSize: "13px",
              },
            }}
          />
        </Box>
        </>
        )}
      </PanelCard>
      </Box>
      )}
    </PopupModal>

    <OtpDialog
      open={otpModalOpen}
      onClose={() => {
        setOtpModalOpen(false);
        setOtpError("");
      }}
      title={tWallet("emailVerification")}
      subtitle={tWallet("emailVerificationSubtitle")}
      contactInfo={userState.email}
      contactType="email"
      otpLength={6}
      onVerify={handleOtpVerify}
      onResendCode={handleResendCode}
      loading={otpLoading}
      error={otpError}
      onClearError={() => setOtpError("")}
      countdown={0}
      preventClose={otpLoading}
      loadingTitle={editMode ? tWallet("updatingWallet", { defaultValue: "Updating your wallet…" }) : "Setting up your wallet…"}
      loadingSteps={editMode ? [
        "Verifying your code…",
        "Validating the new address on-chain…",
        "Saving your changes…",
      ] : [
        "Verifying your OTP…",
        "Registering your wallet address…",
        "Creating your on-chain deposit address…",
        "Configuring webhook notifications…",
        "Generating your API key…",
        "Almost there — final touches…",
      ]}
      loadingStepIntervalMs={2000}
    />

    <OtpDialog
      open={gateOtpOpen}
      onClose={() => {
        setGateOtpOpen(false);
        setGateOtpError("");
      }}
      title={tWallet("emailVerification")}
      subtitle={tWallet("emailVerificationSubtitle")}
      contactInfo={gateEmail}
      contactType="email"
      otpLength={6}
      onVerify={handleVerifyGateEmailOtp}
      onResendCode={handleSendGateEmailOtp}
      loading={gateOtpLoading}
      error={gateOtpError}
      onClearError={() => setGateOtpError("")}
      countdown={gateOtpCountdown}
    />
    </>
  );
};

export default AddWalletModal;
