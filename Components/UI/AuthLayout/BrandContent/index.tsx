import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import Logo from "@/assets/Images/auth/dynopay-white-logo.png";
import useIsMobile from "@/hooks/useIsMobile";

interface AuthBrandContentProps {
  headline?: string;
  subtitle?: string;
}

const AuthBrandContent = ({
  headline = "Accept crypto payments with confidence",
  subtitle = "Dynopay makes it simple for merchants to receive cryptocurrency payments — fast, secure, and with real-time settlement.",
}: AuthBrandContentProps) => {
  const isMobile = useIsMobile("md");
  const theme = useTheme();

  if (isMobile) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Image
          src={Logo}
          alt="Dynopay"
          width={100}
          height={34}
          draggable={false}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "32px",
        maxWidth: "400px",
      }}
    >
      <Image
        src={Logo}
        alt="Dynopay"
        width={140}
        height={48}
        draggable={false}
      />

      <Box>
        <Typography
          sx={{
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "var(--font-sans), sans-serif",
            lineHeight: 1.25,
            color: "#fff",
            mb: "16px",
          }}
        >
          {headline}
        </Typography>

        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 400,
            fontFamily: "var(--font-sans), sans-serif",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          {subtitle}
        </Typography>
      </Box>

      {/* Feature pills */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {[
          "Multi-Currency",
          "Instant Settlement",
          "Low Fees",
          "Secure & Encrypted",
        ].map((tag) => (
          <Box
            key={tag}
            sx={{
              px: "14px",
              py: "6px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.15)",
              fontSize: "12px",
              fontFamily: "var(--font-sans), sans-serif",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.3px",
            }}
          >
            {tag}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default AuthBrandContent;
