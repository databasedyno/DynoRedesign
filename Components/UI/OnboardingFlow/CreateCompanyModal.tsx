import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { CompanyAction } from "@/Redux/Actions";
import { COMPANY_INSERT } from "@/Redux/Actions/CompanyAction";
import { rootReducer } from "@/utils/types";
import {
  BusinessRounded,
  CloudUploadRounded,
  CloseRounded,
} from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  Typography,
  useTheme,
} from "@mui/material";
import StepIndicator from "./StepIndicator";
import { TransitionProps } from "@mui/material/transitions";
import { MuiTelInput } from "mui-tel-input";
import React, { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface CreateCompanyModalProps {
  open: boolean;
  onSuccess: () => void;
  onClose?: () => void;
  closeLabel?: string;
  /** When false, the "Step 1 of 2" indicator is hidden (use for "Add another
   *  company" outside the onboarding flow). Default: true. */
  showStepIndicator?: boolean;
  /** Override the modal heading. Default: "Create Your Company". */
  title?: string;
  /** Override the modal sub-heading. Default copy matches onboarding. */
  subtitle?: string;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({
  open,
  onSuccess,
  onClose,
  closeLabel = "I'll do this later",
  showStepIndicator = true,
  title,
  subtitle,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("sm");
  const companyState = useSelector(
    (state: rootReducer) => state.companyReducer,
  );
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // A) Prefill business email & mobile from the account the user just created,
  // so they don't have to re-type details they already provided at signup.
  React.useEffect(() => {
    if (!open) return;
    setEmail((prev) => prev || userState.email || "");
    setMobile((prev) => prev || userState.mobile || "");
    // Prefill first/last name from user profile if available
    if (userState.name) {
      const parts = (userState.name || "").trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName((prev) => prev || parts[0]);
        setLastName((prev) => prev || parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        setFirstName((prev) => prev || parts[0]);
      }
    }
  }, [open, userState.email, userState.mobile, userState.name]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!companyName.trim()) newErrors.companyName = "Company name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email";
    // D) Mobile is optional — only validate the format if a value was entered.
    if (mobile && mobile.replace(/\D/g, "").length < 10)
      newErrors.mobile = "Please enter a valid mobile number";
    if (website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
      if (!urlPattern.test(website.trim()))
        newErrors.website = "Please enter a valid URL (e.g., https://yourcompany.com)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [fileError, setFileError] = useState("");

  const handleFileChange = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      setFileError("Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be less than 5MB");
      return;
    }
    setFileError("");
    setMediaFile(file);
    setFileName(file.name);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);

    const values = {
      company_name: companyName.trim(),
      email: email.trim(),
      mobile,
      website: website.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };

    const formData = new FormData();
    formData.append("data", JSON.stringify(values));
    if (mediaFile) formData.append("image", mediaFile);

    dispatch(CompanyAction(COMPANY_INSERT, formData));
    submittedRef.current = true;
  };

  // Watch for successful company creation
  const prevLoading = useRef(false);
  const submittedRef = useRef(false);
  React.useEffect(() => {
    // Only trigger success if the modal is actually open AND the user submitted
    if (open && submittedRef.current && prevLoading.current && !companyState.loading) {
      submittedRef.current = false;
      if (companyState.companyList?.length > 0) {
        setSubmitting(false);
        onSuccess();
      } else {
        setSubmitting(false);
      }
    }
    prevLoading.current = companyState.loading;
  }, [companyState.loading, companyState.companyList, onSuccess, open]);

  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: "16px",
          overflow: "visible",
          maxWidth: isMobile ? "95vw" : "520px",
          maxHeight: "90vh",
          mx: "auto",
          display: "flex",
          flexDirection: "column",
        },
      }}
      data-testid="create-company-modal"
    >
      {/* Close Button */}
      {onClose && (
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1,
            color: theme.palette.text.secondary,
            "&:hover": {
              backgroundColor: theme.palette.action.hover,
            },
          }}
          data-testid="close-company-modal-btn"
        >
          <CloseRounded sx={{ fontSize: 22 }} />
        </IconButton>
      )}
      {/* Step Indicator */}
      {showStepIndicator && (
        <Box
          sx={{
            px: isMobile ? 2.5 : 3.5,
            pt: isMobile ? 2 : 2.5,
            pb: 0,
          }}
        >
          <StepIndicator currentStep={1} totalSteps={2} />
        </Box>
      )}

      {/* Header */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pt: isMobile ? 1.5 : 2,
          pb: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: theme.palette.primary.light || "#E5EDFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BusinessRounded
              sx={{ fontSize: 22, color: theme.palette.primary.main }}
            />
          </Box>
          <Box>
            <Typography
              data-testid="create-company-title"
              sx={{
                fontSize: isMobile ? "18px" : "20px",
                fontFamily: "UrbanistSemibold",
                fontWeight: 700,
                color: theme.palette.text.primary,
                lineHeight: 1.3,
              }}
            >
              {title || "Create Your Company"}
            </Typography>
            <Typography
              sx={{
                fontSize: isMobile ? "12px" : "13px",
                fontFamily: "UrbanistMedium",
                fontWeight: 500,
                color: theme.palette.text.secondary,
                lineHeight: 1.4,
              }}
            >
              {subtitle || "Set up your business profile to start accepting payments"}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Form */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          py: isMobile ? 2 : 2.5,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          overflowY: "auto",
          flexGrow: 1,
        }}
      >
        {/* Your Name Section */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px", fontWeight: 600, fontFamily: "UrbanistSemiBold",
              color: theme.palette.text.secondary, mb: 1, textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Your Name
          </Typography>
          <Box sx={{ display: "flex", gap: "12px" }}>
            <Box sx={{ flex: 1 }}>
              <InputField
                label="First Name *"
                placeholder="First name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (errors.firstName) setErrors({ ...errors, firstName: "" });
                }}
                error={!!errors.firstName}
                helperText={errors.firstName}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <InputField
                label="Last Name *"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (errors.lastName) setErrors({ ...errors, lastName: "" });
                }}
                error={!!errors.lastName}
                helperText={errors.lastName}
              />
            </Box>
          </Box>
        </Box>

        {/* Company Section */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px", fontWeight: 600, fontFamily: "UrbanistSemiBold",
              color: theme.palette.text.secondary, mb: 1, textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Company Details
          </Typography>
        </Box>

        <InputField
          label="Company Name *"
          placeholder="Enter your company name"
          value={companyName}
          onChange={(e) => {
            setCompanyName(e.target.value);
            if (errors.companyName) setErrors({ ...errors, companyName: "" });
          }}
          error={!!errors.companyName}
          helperText={errors.companyName}
          data-testid="company-name-input"
        />

        <InputField
          label="Business Email *"
          placeholder="Enter your business email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: "" });
          }}
          error={!!errors.email}
          helperText={errors.email}
          data-testid="company-email-input"
        />

        <Box>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.primary,
              mb: 0.5,
              ml: 0.25,
            }}
          >
            Mobile Number (optional)
          </Typography>
          <MuiTelInput
            fullWidth
            placeholder="Enter mobile number"
            forceCallingCode
            disableFormatting
            defaultCountry="US"
            value={mobile}
            error={!!errors.mobile}
            helperText={errors.mobile}
            onChange={(newValue) => {
              setMobile(newValue);
              if (errors.mobile) setErrors({ ...errors, mobile: "" });
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: isMobile ? "13px" : "15px",
                fontFamily: "UrbanistMedium",
                height: isMobile ? "40px" : "44px",
                "& fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#E9ECF2",
                },
                "&:hover fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : "#D0D5DD",
                },
                "&.Mui-focused fieldset": {
                  borderColor: errors.mobile
                    ? theme.palette.error.main
                    : theme.palette.primary.main,
                },
              },
              "& .MuiFormHelperText-root": {
                fontFamily: "UrbanistMedium",
                fontSize: "12px",
                marginLeft: "4px",
              },
            }}
            data-testid="company-mobile-input"
          />
        </Box>

        <InputField
          label="Website (optional)"
          placeholder="https://yourcompany.com"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            if (errors.website) setErrors({ ...errors, website: "" });
          }}
          error={!!errors.website}
          helperText={errors.website}
          data-testid="company-website-input"
        />

        {/* Logo upload */}
        <Box>
          <Typography
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "UrbanistMedium",
              color: theme.palette.text.primary,
              mb: 0.75,
              ml: 0.25,
            }}
          >
            Brand Logo (optional)
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.5,
                py: 0.75,
                borderRadius: "8px",
                border: `1px solid #E9ECF2`,
                cursor: "pointer",
                transition: "background-color 0.15s",
                "&:hover": { backgroundColor: "#F4F6FA" },
              }}
            >
              <CloudUploadRounded
                sx={{ fontSize: 16, color: theme.palette.text.secondary }}
              />
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "UrbanistMedium",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                }}
              >
                {fileName ? "Change" : "Upload"}
              </Typography>
            </Box>
            {imagePreview && (
              <Box
                component="img"
                src={imagePreview}
                alt="logo preview"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  objectFit: "cover",
                  border: `1px solid #E9ECF2`,
                }}
              />
            )}
            {fileName && !imagePreview && (
              <Typography
                sx={{
                  fontSize: "12px",
                  color: theme.palette.text.secondary,
                  fontFamily: "UrbanistMedium",
                }}
              >
                {fileName}
              </Typography>
            )}
            <input
              type="file"
              ref={fileRef}
              hidden
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
              }}
            />
          </Box>
          {fileError && (
            <Typography
              sx={{
                color: theme.palette.error.main,
                fontSize: "12px",
                fontFamily: "UrbanistMedium",
                mt: 0.5,
              }}
            >
              {fileError}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: isMobile ? 2.5 : 3.5,
          pb: isMobile ? 2.5 : 3,
          pt: 0.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <CustomButton
          data-testid="create-company-submit-btn"
          label={submitting ? "" : "Create Company"}
          variant="primary"
          size={isMobile ? "small" : "medium"}
          fullWidth
          disabled={submitting}
          onClick={handleSubmit}
          startIcon={submitting ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : undefined}
        />
        {onClose && (
          <CustomButton
            data-testid="cancel-company-btn"
            label={closeLabel}
            variant="secondary"
            size={isMobile ? "small" : "medium"}
            fullWidth
            disabled={submitting}
            onClick={onClose}
          />
        )}
      </Box>
    </Dialog>
  );
};

export default CreateCompanyModal;
