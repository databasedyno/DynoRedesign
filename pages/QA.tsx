import React, { useState, useCallback, useEffect } from "react";
import Head from "next/head";
import {
  Box,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  TextField,
  InputAdornment,
} from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ErrorIcon from "@mui/icons-material/Error";
import SearchIcon from "@mui/icons-material/Search";
import useIsMobile from "@/hooks/useIsMobile";
import copyToClipboard from "@/helpers/copyToClipboard";
import {
  Body,
  HeadlineL,
} from "@/Components/Page/Home/v3/styled.v3";
import { toFixedStr } from "@/utils/money";
import { TEST_SECTIONS } from "@/data/qaCatalog";
import QaGuidePanel from "@/Components/Page/Quality/QaGuidePanel";

/* ==================== TYPES ==================== */
type StepStatus = "pending" | "pass" | "fail";

/* ==================== STYLED COMPONENTS ==================== */
const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: "100vh",
  backgroundColor: theme.palette.mode === "dark" ? "#0B0E11" : "#F8FAFC",
  paddingTop: 80,
  paddingBottom: 80,
}));

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

const SectionAccordion = styled(Accordion)(({ theme }) => ({
  background: theme.palette.mode === "dark" ? "#151921" : "#FFFFFF",
  borderRadius: "14px !important",
  border: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
  marginBottom: 12,
  "&:before": { display: "none" },
  overflow: "hidden",
  boxShadow: theme.palette.mode === "dark"
    ? "0 2px 8px rgba(0,0,0,0.3)"
    : "0 1px 4px rgba(0,0,0,0.04)",
}));

const StepRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "36px 1fr 1fr 80px",
  gap: theme.spacing(1.5),
  alignItems: "flex-start",
  padding: "10px 0",
  borderBottom: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
  "&:last-child": { borderBottom: "none" },
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "32px 1fr",
    gap: theme.spacing(1),
  },
}));


/* ==================== NOMADLY1 WALLET TEST DATA ==================== */
interface WalletTestData {
  walletId: number;
  type: string;
  address: string;
  balance: string;
  network: string;
}

const NOMADLY1_WALLETS: WalletTestData[] = [
  { walletId: 41,  type: "BTC",          address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",                     balance: "0.0630 BTC",     network: "Bitcoin" },
  { walletId: 42,  type: "LTC",          address: "LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm",                      balance: "23.5502 LTC",    network: "Litecoin" },
  { walletId: 43,  type: "DOGE",         address: "DEReH1ES1zT8MUtkBQPqLqYGWrJhw2gCUL",                      balance: "84.2443 DOGE",   network: "Dogecoin" },
  { walletId: 45,  type: "ETH",          address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "1.7800 ETH",     network: "Ethereum" },
  { walletId: 46,  type: "TRX",          address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",                      balance: "25.2750 TRX",    network: "Tron" },
  { walletId: 47,  type: "USDT-ERC20",   address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "581.8425 USDT",  network: "Ethereum" },
  { walletId: 48,  type: "USDT-TRC20",   address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",                      balance: "1,809.6905 USDT", network: "Tron" },
  { walletId: 495, type: "USDC-ERC20",   address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 USDC",    network: "Ethereum" },
  { walletId: 518, type: "BCH",          address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",                     balance: "0.0000 BCH",     network: "Bitcoin Cash" },
  { walletId: 519, type: "SOL",          address: "Gjjphdxe26tayH3PBQcqXYt3R2gt7phEdCAFfxZB63U8",             balance: "0.0000 SOL",     network: "Solana" },
  { walletId: 520, type: "XRP",          address: "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV",                      balance: "0.0000 XRP",     network: "Ripple" },
  { walletId: 521, type: "POLYGON",      address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 MATIC",   network: "Polygon" },
  { walletId: 522, type: "RLUSD",        address: "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV",                      balance: "0.0000 RLUSD",   network: "Ripple" },
  { walletId: 523, type: "USDT-POLYGON", address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 USDT",    network: "Polygon" },
  { walletId: 524, type: "RLUSD-ERC20",  address: "0x9a7221b5e32d5f99e8da95585835442e29afb38f",                balance: "0.0000 RLUSD",   network: "Ethereum" },
];


/* ==================== TEST DATA ==================== */
/* ==================== PRIORITY COLORS ==================== */
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#EF4444",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#6B7280",
};

/* ==================== COMPONENT ==================== */
const QAPage = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const isDark = theme.palette.mode === "dark";

  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // Load saved progress from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qa_progress");
      if (saved) {
        try { setStepStatuses(JSON.parse(saved)); } catch { /* ignore */ }
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(stepStatuses).length > 0) {
      localStorage.setItem("qa_progress", JSON.stringify(stepStatuses));
    }
  }, [stepStatuses]);

  const toggleStepStatus = useCallback((key: string) => {
    setStepStatuses((prev) => {
      const current = prev[key] || "pending";
      const next: StepStatus = current === "pending" ? "pass" : current === "pass" ? "fail" : "pending";
      return { ...prev, [key]: next };
    });
  }, []);

  // Calculate progress
  const totalSteps = TEST_SECTIONS.reduce((acc, s) => acc + s.cases.reduce((a, c) => a + c.steps.length, 0), 0);
  const passedSteps = Object.values(stepStatuses).filter((s) => s === "pass").length;
  const failedSteps = Object.values(stepStatuses).filter((s) => s === "fail").length;
  const testedSteps = passedSteps + failedSteps;
  const progressPercent = totalSteps > 0 ? (testedSteps / totalSteps) * 100 : 0;

  // Search filtering
  const filteredSections = searchQuery.trim()
    ? TEST_SECTIONS.map((section) => ({
        ...section,
        cases: section.cases.filter(
          (c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.steps.some(
              (s) =>
                s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.expected.toLowerCase().includes(searchQuery.toLowerCase())
            )
        ),
      })).filter((s) => s.cases.length > 0)
    : TEST_SECTIONS;

  const totalCases = TEST_SECTIONS.reduce((acc, s) => acc + s.cases.length, 0);

  const renderStatusIcon = (key: string) => {
    const status = stepStatuses[key] || "pending";
    if (status === "pass") return <CheckCircleIcon sx={{ color: "#22C55E", fontSize: 22 }} />;
    if (status === "fail") return <ErrorIcon sx={{ color: "#EF4444", fontSize: 22 }} />;
    return <RadioButtonUncheckedIcon sx={{ color: isDark ? "#4B5563" : "#D1D5DB", fontSize: 22 }} />;
  };

  return (
    <>
      <Head>
        <title>QA Test Plan · Dynopay</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <PageWrapper>
        <Container>
          {/* Header — v3 typography sweep */}
          <Box sx={{ textAlign: "center", mb: 5 }}>
            <HeadlineL
              component="h1"
              sx={{ fontSize: { xs: 28, md: 42 }, mb: 1 }}
            >
              Dynopay QA Test Plan
            </HeadlineL>
            <Body sx={{ maxWidth: 640, mx: "auto", mb: 3 }}>
              Comprehensive step-by-step functionality tests covering all features.
              Click the circle to toggle each step: ⚪ Pending → ✅ Pass → ❌ Fail. Progress is saved in your browser.
            </Body>

            {/* Progress bar */}
            <Box
              sx={{
                maxWidth: 600,
                mx: "auto",
                p: 2.5,
                borderRadius: 3,
                bgcolor: isDark ? "#151921" : "#FFF",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: "text.secondary" }}>
                  Overall Progress
                </Typography>
                <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: "text.primary" }}>
                  {testedSteps} / {totalSteps} steps ({toFixedStr(progressPercent, 0)}%)
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 4,
                    background: failedSteps > 0
                      ? "linear-gradient(90deg, #22C55E, #F59E0B)"
                      : "linear-gradient(90deg, #22C55E, #3B82F6)",
                  },
                }}
              />
              <Box sx={{ display: "flex", gap: 3, mt: 1.5, justifyContent: "center" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#22C55E" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{passedSteps} Passed</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#EF4444" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{failedSteps} Failed</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: isDark ? "#4B5563" : "#D1D5DB" }} />
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{totalSteps - testedSteps} Pending</Typography>
                </Box>
              </Box>
            </Box>

            {/* Stats chips */}
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 2, flexWrap: "wrap" }}>
              <Chip label={`${filteredSections.length} Sections`} size="small" sx={{ fontFamily: "var(--font-sans)", fontSize: 12 }} />
              <Chip label={`${totalCases} Test Cases`} size="small" sx={{ fontFamily: "var(--font-sans)", fontSize: 12 }} />
              <Chip label={`${totalSteps} Steps`} size="small" sx={{ fontFamily: "var(--font-sans)", fontSize: 12 }} />
            </Box>

            {/* Search */}
            <Box sx={{ maxWidth: 460, mx: "auto", mt: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search test cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 2.5,
                    fontSize: 14,
                    bgcolor: isDark ? "#1A1F2B" : "#F1F5F9",
                  },
                }}
              />
            </Box>
          </Box>

          {/* Nomadly1 Wallet Test Data Reference */}
          <SectionAccordion
            expanded={expandedSections.includes("wallet-data")}
            onChange={(_, expanded) => {
              setExpandedSections((prev) =>
                expanded ? [...prev, "wallet-data"] : prev.filter((id) => id !== "wallet-data")
              );
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                <Typography sx={{ fontSize: 22 }}>🧪</Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "text.primary" }}>
                    Test Data — Nomadly1 Wallet Addresses
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                    15 saved wallet addresses for the Nomadly1 company (company_id: 3). Use these to verify wallet display, payment routing, and address management.
                  </Typography>
                </Box>
                <Chip
                  label="15 wallets"
                  size="small"
                  sx={{ fontSize: 11, fontFamily: "var(--font-sans)", bgcolor: alpha("#8B5CF6", 0.12), color: "#8B5CF6", mr: 1 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, overflowX: "auto" }}>
              {/* Table header */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "60px 120px 1fr 130px 110px",
                  gap: 1,
                  py: 1,
                  borderBottom: `2px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  minWidth: isMobile ? "auto" : 750,
                }}
              >
                {!isMobile && (
                  <>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>ID</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>Type</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>Address</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>Balance</Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>Network</Typography>
                  </>
                )}
              </Box>
              {/* Wallet rows */}
              {NOMADLY1_WALLETS.map((w) => (
                <Box
                  key={w.walletId}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "60px 120px 1fr 130px 110px",
                    gap: 1,
                    py: 1.2,
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                    minWidth: isMobile ? "auto" : 750,
                    "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)" },
                  }}
                >
                  {isMobile ? (
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Chip label={w.type} size="small" sx={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, height: 22 }} />
                        <Typography sx={{ fontSize: 11, color: "text.secondary" }}>{w.network}</Typography>
                        <Typography sx={{ fontSize: 11, fontFamily: "var(--font-sans)", color: parseFloat(w.balance) > 0 ? "#22C55E" : "text.secondary", ml: "auto" }}>
                          {w.balance}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "text.secondary",
                          wordBreak: "break-all",
                          cursor: "pointer",
                          "&:hover": { color: "primary.main" },
                        }}
                        onClick={() => { copyToClipboard(w.address); }}
                      >
                        {w.address}
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", fontFamily: "monospace" }}>{w.walletId}</Typography>
                      <Chip label={w.type} size="small" sx={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, height: 22, justifySelf: "start" }} />
                      <Tooltip title="Click to copy" arrow>
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "text.secondary",
                            wordBreak: "break-all",
                            cursor: "pointer",
                            "&:hover": { color: "primary.main" },
                          }}
                          onClick={() => { copyToClipboard(w.address); }}
                        >
                          {w.address}
                        </Typography>
                      </Tooltip>
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontFamily: "var(--font-sans)",
                          color: parseFloat(w.balance.replace(",", "")) > 0 ? "#22C55E" : "text.secondary",
                        }}
                      >
                        {w.balance}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{w.network}</Typography>
                    </>
                  )}
                </Box>
              ))}
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: isDark ? alpha("#3B82F6", 0.06) : alpha("#3B82F6", 0.04), border: `1px solid ${alpha("#3B82F6", 0.12)}` }}>
                <Typography sx={{ fontSize: 12, color: "#3B82F6", fontFamily: "var(--font-sans)" }}>
                  💡 Click any address to copy it. Green balances indicate wallets with funds available for transaction testing.
                  Shared EVM addresses (ETH, USDT-ERC20, USDC-ERC20, POLYGON, USDT-POLYGON, RLUSD-ERC20) all use the same address: 0x9a72...b38f
                </Typography>
              </Box>
            </AccordionDetails>
          </SectionAccordion>

          {/* QA Playbook — how to test effectively */}
          <QaGuidePanel isDark={isDark} cardBg={isDark ? "#151921" : "#FFFFFF"} border={`1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`} />

          {/* Test Sections */}
          {filteredSections.map((section) => (
            <SectionAccordion
              key={section.id}
              expanded={expandedSections.includes(section.id)}
              onChange={(_, expanded) => {
                setExpandedSections((prev) =>
                  expanded ? [...prev, section.id] : prev.filter((id) => id !== section.id)
                );
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%" }}>
                  <Typography sx={{ fontSize: 22 }}>{section.icon}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 16, color: "text.primary" }}>
                      {section.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }}>
                      {section.description} — {section.cases.length} test cases
                    </Typography>
                  </Box>
                  {/* Section mini progress */}
                  {(() => {
                    const sectionSteps = section.cases.flatMap((c) => c.steps.map((s) => `${c.id}-${s.id}`));
                    const sectionPassed = sectionSteps.filter((k) => stepStatuses[k] === "pass").length;
                    const sectionTested = sectionSteps.filter((k) => stepStatuses[k] === "pass" || stepStatuses[k] === "fail").length;
                    return sectionTested > 0 ? (
                      <Chip
                        label={`${sectionPassed}/${sectionSteps.length}`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontFamily: "var(--font-sans)",
                          bgcolor: sectionPassed === sectionSteps.length ? alpha("#22C55E", 0.15) : alpha("#3B82F6", 0.1),
                          color: sectionPassed === sectionSteps.length ? "#22C55E" : "#3B82F6",
                          mr: 1,
                        }}
                      />
                    ) : null;
                  })()}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {section.cases.map((testCase, caseIdx) => (
                  <Box key={testCase.id} sx={{ mb: caseIdx < section.cases.length - 1 ? 3 : 0 }}>
                    {/* Case header */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                      <Chip
                        label={testCase.id}
                        size="small"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          fontWeight: 700,
                          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        }}
                      />
                      <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "text.primary", flex: 1 }}>
                        {testCase.title}
                      </Typography>
                      <Chip
                        label={testCase.priority}
                        size="small"
                        sx={{
                          fontSize: 10,
                          fontFamily: "var(--font-sans)",
                          bgcolor: alpha(PRIORITY_COLORS[testCase.priority], 0.12),
                          color: PRIORITY_COLORS[testCase.priority],
                          height: 22,
                        }}
                      />
                    </Box>

                    {/* Preconditions */}
                    {testCase.preconditions && (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha("#F59E0B", 0.06) : alpha("#F59E0B", 0.05),
                          border: `1px solid ${alpha("#F59E0B", 0.15)}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: "#F59E0B", fontFamily: "var(--font-sans)" }}>
                          ⚠️ Preconditions: {testCase.preconditions}
                        </Typography>
                      </Box>
                    )}

                    {/* Notes */}
                    {testCase.notes && (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha("#EF4444", 0.06) : alpha("#EF4444", 0.05),
                          border: `1px solid ${alpha("#EF4444", 0.15)}`,
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: "#EF4444", fontFamily: "var(--font-sans)" }}>
                          📌 {testCase.notes}
                        </Typography>
                      </Box>
                    )}

                    {/* Column headers (desktop only) */}
                    {!isMobile && (
                      <StepRow sx={{ borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, py: 0.5 }}>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>
                          #
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>
                          Action
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase" }}>
                          Expected Result
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "uppercase", textAlign: "center" }}>
                          Status
                        </Typography>
                      </StepRow>
                    )}

                    {/* Steps */}
                    {testCase.steps.map((step) => {
                      const stepKey = `${testCase.id}-${step.id}`;
                      return isMobile ? (
                        <Box key={step.id} sx={{ display: "flex", gap: 1, py: 1.2, borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
                          <Tooltip title="Click to toggle status" arrow>
                            <IconButton size="small" onClick={() => toggleStepStatus(stepKey)} sx={{ mt: 0.2 }}>
                              {renderStatusIcon(stepKey)}
                            </IconButton>
                          </Tooltip>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 13, color: "text.primary", fontFamily: "var(--font-sans)", mb: 0.5 }}>
                              Step {step.id}: {step.action}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                              → {step.expected}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <StepRow key={step.id}>
                          <Typography sx={{ fontSize: 12, color: "text.secondary", fontFamily: "var(--font-sans)", pt: 0.3 }}>
                            {step.id}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "text.primary", lineHeight: 1.5 }}>
                            {step.action}
                          </Typography>
                          <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
                            {step.expected}
                          </Typography>
                          <Box sx={{ textAlign: "center" }}>
                            <Tooltip title="Click to toggle: Pending → Pass → Fail" arrow>
                              <IconButton size="small" onClick={() => toggleStepStatus(stepKey)}>
                                {renderStatusIcon(stepKey)}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </StepRow>
                      );
                    })}

                    {caseIdx < section.cases.length - 1 && (
                      <Divider sx={{ mt: 2, borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }} />
                    )}
                  </Box>
                ))}
              </AccordionDetails>
            </SectionAccordion>
          ))}

          {/* Footer */}
          <Box sx={{ textAlign: "center", mt: 5 }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              Dynopay QA Test Plan • {totalCases} Test Cases • {totalSteps} Steps • Last Updated: March 2026
            </Typography>
            <Typography
              component="button"
              onClick={() => {
                if (confirm("Reset all test progress? This cannot be undone.")) {
                  setStepStatuses({});
                  localStorage.removeItem("qa_progress");
                }
              }}
              sx={{
                fontSize: 12,
                color: "#EF4444",
                mt: 1,
                cursor: "pointer",
                background: "none",
                border: "none",
                textDecoration: "underline",
                fontFamily: "inherit",
                "&:hover": { opacity: 0.8 },
              }}
            >
              Reset All Progress
            </Typography>
          </Box>
        </Container>
      </PageWrapper>
    </>
  );
};

export default QAPage;

// Make this page publicly accessible with the home layout (no auth required)
(QAPage as any).layout = "home";
