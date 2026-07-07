import ArrowUpwardIcon from "@/assets/Icons/up-arrow-icon.png";
import FormManager from "@/Components/Page/Common/FormManager";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { Info } from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as yup from "yup";

/**
 * OtpInputPanel — the SHARED, headless OTP block used everywhere in the app.
 *
 * It renders:
 *   - (optional) "Code sent to <contactInfo>" info chip
 *   - "Verification Code *" label
 *   - <otpLength> single-digit input boxes with auto-focus, paste, backspace
 *   - error message
 *   - (optional) Resend / Verify action buttons
 *
 * Behavior:
 *   - AUTO-SUBMITS the moment all <otpLength> digits are filled (no need to
 *     click Verify). The Verify button still shows so paste-then-click works
 *     and screen readers can act, but is unnecessary in the happy path.
 *   - Backspace moves focus to the previous box and clears.
 *   - Paste fills all boxes from the cursor position forward.
 *   - Resend button shows a countdown (e.g. "Resend in 42s") when `countdown > 0`.
 *
 * Used standalone (inline pages, custom modals) AND inside `OtpDialog` (modal
 * version). Keeping logic here ensures every OTP screen in the app has the
 * SAME look, feel, and auto-submit behavior.
 */

export interface OtpInputPanelProps {
  /** Where the code was sent (email or masked phone). Shown in the info chip. */
  contactInfo?: string;
  /** Channel — purely cosmetic for the info chip / accessibility hints. */
  contactType?: "email" | "phone";
  /** Number of digits in the OTP. Default 6. */
  otpLength?: number;
  /** Localized "Resend code" label. */
  resendCodeLabel?: string;
  /** Renderer for the countdown label, e.g. (n) => `Resend in ${n}s`. */
  resendCodeCountdownLabel?: (seconds: number) => string;
  /** Verify button label (e.g. "Verify", "Verify & log in", "Verify & save"). */
  primaryButtonLabel?: string;
  /** Called when user clicks the resend button. */
  onResendCode?: () => void;
  /** Called with the complete OTP string. Fires automatically on completion. */
  onVerify: (otp: string) => void;
  /** Optional: clear external error state when the user edits the OTP. */
  onClearError?: () => void;
  /** Seconds remaining on the resend cooldown; 0 = resend enabled. */
  countdown?: number;
  /** While true, the Verify button shows a loading state and auto-submit is paused. */
  loading?: boolean;
  /** External error to show beneath the boxes. */
  error?: string;
  /** Show the "Code sent to <contact>" chip. Default: true (when contactInfo is set). */
  showInfoChip?: boolean;
  /** Show the "Verification Code *" label above the boxes. Default: true. */
  showLabel?: boolean;
  /** Show the Resend + Verify action row. Default: true. */
  showActions?: boolean;
  /** Layout for the action row. Default: "row" (Resend left, Verify right).
   *  Use "stacked" when used in narrow flows (e.g. /auth/register) to put
   *  Verify full-width on top and the resend hint underneath. */
  actionsLayout?: "row" | "stacked";
  /** Reset the boxes when this key changes (e.g. on resend). */
  resetKey?: string | number;
}

type OtpFieldName = `otp${number}`;
type OtpFormValues = Partial<Record<OtpFieldName, string>>;

const generateOtpInitial = (length: number): OtpFormValues => {
  const initial: OtpFormValues = {};
  for (let i = 1; i <= length; i++) {
    const fieldName = `otp${i}` as OtpFieldName;
    initial[fieldName] = "";
  }
  return initial;
};

const OtpInputPanel: React.FC<OtpInputPanelProps> = ({
  contactInfo = "",
  contactType = "email",
  otpLength = 6,
  resendCodeLabel,
  resendCodeCountdownLabel,
  primaryButtonLabel,
  onResendCode,
  onVerify,
  onClearError,
  countdown = 0,
  loading = false,
  error,
  showInfoChip = true,
  showLabel = true,
  showActions = true,
  actionsLayout = "row",
  resetKey,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  const otpInitial = React.useMemo(
    () => generateOtpInitial(otpLength),
    [otpLength],
  );

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const previousOtpRef = useRef<string>("");
  const formValuesRef = useRef<OtpFormValues | null>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const resetFormRef = useRef<((values?: OtpFormValues) => void) | null>(null);

  const labelResend = resendCodeLabel || t("resendCode");
  const labelCountdown =
    resendCodeCountdownLabel ||
    ((seconds: number) => `${t("codeIn")} ${seconds}s`);
  const labelPrimary = primaryButtonLabel || t("verify");

  const inputSize = isMobile ? "44px" : "48px";

  const otpSchema = React.useMemo(() => {
    const shape: Record<OtpFieldName, yup.StringSchema<string>> = {} as Record<
      OtpFieldName,
      yup.StringSchema<string>
    >;
    for (let i = 1; i <= otpLength; i++) {
      const fieldName = `otp${i}` as OtpFieldName;
      shape[fieldName] = yup
        .string()
        .required(t("required"))
        .matches(/^[0-9]$/, t("mustBeNumeric"));
    }
    return yup.object().shape(shape);
  }, [otpLength, t]);

  // Reset state on mount / resetKey change. Also auto-focus first box.
  useEffect(() => {
    previousOtpRef.current = "";
    isSubmittingRef.current = false;
    // Clear all boxes when resetKey changes
    if (resetFormRef.current) {
      resetFormRef.current(otpInitial);
    }
    const focusFirst = () => {
      const firstInput = inputRefs.current[0];
      if (firstInput) firstInput.focus();
    };
    if (typeof window !== "undefined") {
      const id = window.requestAnimationFrame(focusFirst);
      return () => window.cancelAnimationFrame(id);
    }
    focusFirst();
  }, [resetKey, otpInitial]);

  // When an external error appears, allow the user to retype without our
  // de-dup guard blocking a fresh submit attempt.
  useEffect(() => {
    if (error) {
      previousOtpRef.current = "";
      isSubmittingRef.current = false;
    }
  }, [error]);

  const buildOtpFromValues = React.useCallback(
    (values: OtpFormValues): string => {
      const digits: string[] = [];
      for (let i = 1; i <= otpLength; i++) {
        const fieldName = `otp${i}` as OtpFieldName;
        const value = (values[fieldName] ?? "").trim();
        digits.push(value);
      }
      return digits.join("");
    },
    [otpLength],
  );

  const isOtpComplete = React.useCallback(
    (values: OtpFormValues): boolean => {
      for (let i = 1; i <= otpLength; i++) {
        const fieldName = `otp${i}` as OtpFieldName;
        const value = (values[fieldName] ?? "").trim();
        if (!/^\d$/.test(value)) return false;
      }
      return true;
    },
    [otpLength],
  );

  const validateOtp = React.useCallback(
    (values: OtpFormValues): { isValid: boolean; otp: string } => {
      const otp = buildOtpFromValues(values);
      if (otp.length !== otpLength) return { isValid: false, otp };
      if (!/^\d+$/.test(otp)) return { isValid: false, otp };
      if (!isOtpComplete(values)) return { isValid: false, otp };
      return { isValid: true, otp };
    },
    [buildOtpFromValues, isOtpComplete, otpLength],
  );

  const submitOtp = React.useCallback(
    (otp: string) => {
      const trimmedOtp = otp.trim();
      if (!trimmedOtp) return;
      if (isSubmittingRef.current) return;
      if (trimmedOtp === previousOtpRef.current) return;
      if (onVerify) {
        isSubmittingRef.current = true;
        previousOtpRef.current = trimmedOtp;
        onVerify(trimmedOtp);
      }
    },
    [onVerify],
  );

  const attemptAutoSubmit = React.useCallback(
    (values: OtpFormValues, loadingFlag: boolean) => {
      if (loadingFlag) return;
      const { isValid, otp } = validateOtp(values);
      if (!isValid) {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
        return;
      }
      submitOtp(otp);
    },
    [submitOtp, validateOtp],
  );

  const handleOtpChange = React.useCallback(
    (
      index: number,
      value: string,
      handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
      values: OtpFormValues,
      loadingFlag: boolean,
    ) => {
      const numericValue = value.replace(/\D/g, "");
      const fieldName = `otp${index + 1}` as OtpFieldName;

      if (numericValue.length === 0 && value === "") {
        const clearEvent = {
          target: { name: fieldName, value: "" },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleChange(clearEvent);
        if (error && onClearError) onClearError();
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
        return;
      }

      if (numericValue.length === 0) return;

      const singleDigit = numericValue.slice(-1);
      const updatedValues: OtpFormValues = {
        ...values,
        [fieldName]: singleDigit,
      };

      const changeEvent = {
        target: { name: fieldName, value: singleDigit },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleChange(changeEvent);
      if (error && onClearError) onClearError();

      if (numericValue.length > 1) {
        const remainingDigits = numericValue.slice(1);
        remainingDigits.split("").forEach((digit, idx) => {
          const nextIndex = index + idx + 1;
          if (nextIndex < otpLength) {
            const nextFieldName = `otp${nextIndex + 1}` as OtpFieldName;
            updatedValues[nextFieldName] = digit;
            const nextEvent = {
              target: { name: nextFieldName, value: digit },
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            handleChange(nextEvent);
          }
        });
        const lastFilledIndex = Math.min(
          index + numericValue.length - 1,
          otpLength - 1,
        );
        const nextField = inputRefs.current[lastFilledIndex];
        if (nextField) {
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => nextField.focus());
          } else {
            nextField.focus();
          }
        }
      } else if (singleDigit && index < otpLength - 1) {
        const nextField = inputRefs.current[index + 1];
        if (nextField) {
          if (typeof window !== "undefined") {
            window.requestAnimationFrame(() => nextField.focus());
          } else {
            nextField.focus();
          }
        }
      }

      if (isOtpComplete(updatedValues)) {
        attemptAutoSubmit(updatedValues, loadingFlag);
      } else {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
      }
    },
    [attemptAutoSubmit, error, isOtpComplete, onClearError, otpLength],
  );

  const handleOtpBlur = (
    fieldName: OtpFieldName,
    handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void,
  ) => {
    const blurEvent = {
      target: { name: fieldName },
    } as unknown as React.FocusEvent<HTMLInputElement>;
    handleBlur(blurEvent);
  };

  const handleKeyDown = React.useCallback(
    (
      index: number,
      e: React.KeyboardEvent<HTMLInputElement>,
      values: OtpFormValues,
      handleChange: (ev: React.ChangeEvent<HTMLInputElement>) => void,
      loadingFlag: boolean,
    ) => {
      const fieldName = `otp${index + 1}` as OtpFieldName;
      const currentValue = values[fieldName];

      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
        return;
      }
      if (e.key === "ArrowRight" && index < otpLength - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
        return;
      }
      if (e.key === "Backspace") {
        if (!currentValue && index > 0) {
          e.preventDefault();
          const prevFieldName = `otp${index}` as OtpFieldName;
          const clearEvent = {
            target: { name: prevFieldName, value: "" },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleChange(clearEvent);
          inputRefs.current[index - 1]?.focus();
        } else if (currentValue) {
          const clearEvent = {
            target: { name: fieldName, value: "" },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          handleChange(clearEvent);
        }
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        const clearEvent = {
          target: { name: fieldName, value: "" },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleChange(clearEvent);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        attemptAutoSubmit(values, loadingFlag);
        return;
      }
      if (
        !/^[0-9]$/.test(e.key) &&
        ![
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Enter",
          "Control",
          "v",
          "V",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
    },
    [attemptAutoSubmit, otpLength],
  );

  const handlePaste = React.useCallback(
    (
      e: React.ClipboardEvent<HTMLInputElement | HTMLDivElement>,
      handleFieldsChange: (updates: Partial<OtpFormValues>) => void,
      values: OtpFormValues,
      startIndex: number,
      loadingFlag: boolean,
    ) => {
      const pastedData = e.clipboardData.getData("text");
      const numericValue = pastedData.replace(/\D/g, "");
      if (numericValue.length === 0) return;
      if (error && onClearError) onClearError();

      const currentValues = formValuesRef.current || values;
      let fillIndex = startIndex;
      const startField = currentValues[`otp${fillIndex + 1}` as OtpFieldName];
      if (startField && String(startField).trim().length > 0) {
        for (let i = startIndex; i < otpLength; i++) {
          const fName = `otp${i + 1}` as OtpFieldName;
          if (
            !currentValues[fName] ||
            String(currentValues[fName]).trim().length === 0
          ) {
            fillIndex = i;
            break;
          }
        }
      }

      const digits = numericValue.split("").filter((d) => /^\d$/.test(d));
      if (digits.length === 0) return;

      const updatedValues: OtpFormValues = { ...currentValues };
      let lastIndex = fillIndex - 1;
      digits.forEach((digit) => {
        if (fillIndex < otpLength) {
          const fName = `otp${fillIndex + 1}` as OtpFieldName;
          updatedValues[fName] = digit;
          lastIndex = fillIndex;
          fillIndex += 1;
        }
      });

      const partial: Partial<OtpFormValues> = {};
      for (let i = startIndex; i <= lastIndex; i++) {
        partial[`otp${i + 1}` as OtpFieldName] =
          updatedValues[`otp${i + 1}` as OtpFieldName];
      }
      handleFieldsChange(partial);
      formValuesRef.current = updatedValues;

      const allFilled = isOtpComplete(updatedValues);
      let nextFocusIndex = lastIndex;
      if (!allFilled) {
        for (let i = lastIndex + 1; i < otpLength; i++) {
          const fName = `otp${i + 1}` as OtpFieldName;
          if (
            !updatedValues[fName] ||
            String(updatedValues[fName]).trim().length === 0
          ) {
            nextFocusIndex = i;
            break;
          }
        }
      } else {
        nextFocusIndex = otpLength - 1;
      }
      const nextField = inputRefs.current[nextFocusIndex];
      if (nextField) {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(() => {
            nextField.focus();
            nextField.select();
          });
        } else {
          nextField.focus();
          nextField.select();
        }
      }
      if (allFilled) {
        attemptAutoSubmit(updatedValues, loadingFlag);
      } else {
        previousOtpRef.current = "";
        isSubmittingRef.current = false;
      }
    },
    [attemptAutoSubmit, error, isOtpComplete, onClearError, otpLength],
  );

  const handleSubmit = (values: OtpFormValues) => {
    attemptAutoSubmit(values, loading);
  };

  return (
    <FormManager
      initialValues={otpInitial}
      yupSchema={otpSchema}
      onSubmit={handleSubmit}
    >
      {({
        handleBlur,
        handleChange,
        submitDisable,
        values,
        handleFieldsChange,
      }) => {
        formValuesRef.current = values;
        // Expose handleFieldsChange via ref so the resetKey effect can clear boxes
        resetFormRef.current = (next?: OtpFormValues) => {
          if (next) handleFieldsChange(next as Partial<OtpFormValues>);
        };

        const areAllFieldsFilled = isOtpComplete(values);
        const { isValid } = validateOtp(values);

        return (
          <>
            {/* Info Message Box */}
            {showInfoChip && contactInfo && (
              <Box
                sx={{
                  backgroundColor: theme.palette.secondary.main,
                  borderRadius: "8px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: `1px solid ${theme.palette.border.main}`,
                  marginBottom: "14px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Info
                  sx={{
                    color: theme.palette.primary.main,
                    fontSize: "18px",
                    width: "16px",
                    height: "16px",
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: isMobile ? "12px" : "14px",
                    color: theme.palette.primary.main,
                    fontFamily: "UrbanistMedium",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {t("codeSentTo")}{" "}
                  <span style={{ fontWeight: 600, fontFamily: "UrbanistBold" }}>
                    {contactInfo}
                  </span>
                </Typography>
              </Box>
            )}

            <Box sx={{ marginBottom: isMobile ? "14px" : "16px" }}>
              {showLabel && (
                <Typography
                  sx={{
                    fontSize: isMobile ? "13px" : "15px",
                    fontWeight: 500,
                    lineHeight: "1.2",
                    letterSpacing: 0,
                    color: theme.palette.text.primary,
                    fontFamily: "UrbanistMedium",
                    marginBottom: "8px",
                  }}
                >
                  {t("verificationCode")} *
                </Typography>
              )}
              <Box
                sx={{
                  display: "flex",
                  gap: isMobile ? "6px" : "8px",
                  justifyContent: "flex-start",
                  flexWrap: "nowrap",
                }}
              >
                {Array.from({ length: otpLength }).map((_, index) => {
                  const fieldName = `otp${index + 1}` as OtpFieldName;
                  const valueForField = values[fieldName] ?? "";
                  const hasValue =
                    typeof valueForField === "string" &&
                    valueForField.length > 0;
                  const hasError = !!error;
                  const ariaLabel = `${contactType === "phone" ? "SMS" : "Email"} OTP digit ${index + 1} of ${otpLength}`;

                  return (
                    <Box
                      key={fieldName}
                      sx={{
                        width: inputSize,
                        minWidth: inputSize,
                        maxWidth: inputSize,
                        flexShrink: 0,
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        MozUserSelect: "none",
                        msUserSelect: "none",
                      }}
                    >
                      <InputField
                        value={values[fieldName] || ""}
                        name={fieldName}
                        type="text"
                        ariaLabel={ariaLabel}
                        ariaInvalid={Boolean(error)}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          handleOtpChange(
                            index,
                            inputValue,
                            handleChange,
                            values,
                            loading,
                          );
                        }}
                        onBlur={() => handleOtpBlur(fieldName, handleBlur)}
                        onKeyDown={(e) =>
                          handleKeyDown(
                            index,
                            e,
                            values,
                            handleChange,
                            loading,
                          )
                        }
                        onPaste={(e) => {
                          handlePaste(
                            e,
                            handleFieldsChange,
                            values,
                            index,
                            loading,
                          );
                        }}
                        autoComplete="off"
                        error={hasError}
                        success={Boolean(hasValue && !hasError)}
                        fullWidth
                        maxLength={1}
                        inputMode="numeric"
                        inputHeight={inputSize}
                        inputRef={(el: HTMLInputElement | null) => {
                          inputRefs.current[index] = el;
                        }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "8px !important",
                            backgroundColor:
                              theme.palette.mode === "dark"
                                ? "rgba(255,255,255,0.06) !important"
                                : "#fff !important",
                            "& fieldset": {
                              borderColor:
                                theme.palette.border.main + " !important",
                              borderWidth: "1px",
                            },
                            "&:hover fieldset": {
                              borderColor:
                                theme.palette.primary.main + " !important",
                            },
                            "&.Mui-focused fieldset": {
                              borderColor:
                                theme.palette.primary.main + " !important",
                              borderWidth: "2px",
                            },
                          },
                          "& .MuiInputBase-input": {
                            textAlign: "center",
                            fontSize: isMobile ? "20px" : "22px",
                            fontWeight: 700,
                            fontFamily: "UrbanistBold",
                            padding: "0 !important",
                            letterSpacing: "0.5px",
                            color: theme.palette.text.primary,
                            height: "100%",
                            lineHeight: inputSize,
                          },
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
              {error && (
                <Typography
                  role="alert"
                  sx={{
                    fontSize: "12px",
                    color: theme.palette.error.main,
                    marginTop: "8px",
                    fontFamily: "UrbanistMedium",
                  }}
                >
                  {error}
                </Typography>
              )}
            </Box>

            {showActions && actionsLayout === "row" && (
              <Box
                sx={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "space-between",
                }}
              >
                <CustomButton
                  variant="secondary"
                  size={isMobile ? "small" : "medium"}
                  label={countdown > 0 ? labelCountdown(countdown) : labelResend}
                  onClick={() => {
                    if (onResendCode) onResendCode();
                  }}
                  disabled={countdown > 0 || loading || !onResendCode}
                  endIcon={
                    countdown > 0 || loading ? undefined : ArrowUpwardIcon
                  }
                  type="button"
                  sx={{
                    fontWeight: 500,
                    padding: "11px 20px",
                    flex: 1,
                    fontSize: isMobile ? "13px" : "15px",
                    [theme.breakpoints.down("sm")]: {
                      fontSize: "13px",
                      padding: "10px 16px",
                    },
                  }}
                />
                <CustomButton
                  variant="primary"
                  size={isMobile ? "small" : "medium"}
                  label={loading ? (t("verifying")) : labelPrimary}
                  type="submit"
                  loading={loading}
                  disabled={
                    submitDisable ||
                    !areAllFieldsFilled ||
                    !isValid
                  }
                  sx={{
                    fontWeight: 700,
                    padding: "15px 24px",
                    flex: 1,
                    fontSize: isMobile ? "13px" : "15px",
                    [theme.breakpoints.down("sm")]: {
                      fontSize: "13px",
                      padding: "12px 20px",
                    },
                  }}
                />
              </Box>
            )}

            {showActions && actionsLayout === "stacked" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <CustomButton
                  variant="primary"
                  size="medium"
                  label={loading ? (t("verifying")) : labelPrimary}
                  type="submit"
                  loading={loading}
                  disabled={
                    submitDisable ||
                    !areAllFieldsFilled ||
                    !isValid
                  }
                  fullWidth
                  sx={{
                    fontWeight: 700,
                    padding: "13px 24px",
                    borderRadius: "12px",
                    fontSize: "15px",
                  }}
                />
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 0.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "13px",
                      color: "text.secondary",
                      fontFamily: "UrbanistMedium",
                    }}
                  >
                    {t("didntReceiveCode")}
                  </Typography>
                  {countdown > 0 ? (
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: "text.secondary",
                        fontFamily: "UrbanistSemiBold",
                      }}
                    >
                      {labelCountdown(countdown)}
                    </Typography>
                  ) : (
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => {
                        if (onResendCode) onResendCode();
                      }}
                      disabled={!onResendCode}
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.primary.main,
                        fontFamily: "UrbanistSemiBold",
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        padding: 0,
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        "&:hover": { opacity: 0.8 },
                      }}
                    >
                      {labelResend}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </>
        );
      }}
    </FormManager>
  );
};

export default OtpInputPanel;
