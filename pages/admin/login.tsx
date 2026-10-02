import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import MuiCard from "@mui/material/Card";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/router";
import adminBaseApi from "@/axiosAdmin";

const Card = styled(MuiCard)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignSelf: "center",
  width: "100%",
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: "auto",
  [theme.breakpoints.up("sm")]: {
    maxWidth: "450px",
  },
  boxShadow:
    "hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px",
  ...theme.applyStyles("dark", {
    boxShadow:
      "hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px",
  }),
}));

const SignInContainer = styled(Stack)(({ theme }) => ({
  height: "calc((1 - var(--template-frame-height, 0)) * 100dvh)",
  minHeight: "100%",
  padding: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(4),
  },
  "&::before": {
    content: '""',
    display: "block",
    position: "absolute",
    zIndex: -1,
    inset: 0,
    backgroundImage:
      "radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))",
    backgroundRepeat: "no-repeat",
    ...theme.applyStyles("dark", {
      backgroundImage:
        "radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))",
    }),
  },
}));

type Step = "password" | "totp" | "enroll" | "backup";

const errMsg = (e: any): string =>
  e?.response?.data?.message || e?.message || "Something went wrong. Please try again.";

const AdminLogin = () => {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("password");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const [challengeToken, setChallengeToken] = React.useState("");
  const [enrollToken, setEnrollToken] = React.useState("");
  const [qr, setQr] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);

  const finish = (token: string) => {
    localStorage.setItem("admin_token", token);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/login/password", { email, password });
      if (data.status === "TOTP_REQUIRED") {
        setChallengeToken(data.challengeToken);
        setCode("");
        setStep("totp");
      } else if (data.status === "ENROLL_REQUIRED") {
        setEnrollToken(data.enrollToken);
        // Immediately fetch the QR to enroll.
        const {
          data: { data: enroll },
        } = await adminBaseApi.post("/admin/enroll/begin", { enrollToken: data.enrollToken });
        setQr(enroll.qr);
        setSecret(enroll.secret);
        setCode("");
        setStep("enroll");
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const submitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/login/totp", { challengeToken, code });
      finish(data.accessToken);
      router.replace("/admin");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const submitEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const {
        data: { data },
      } = await adminBaseApi.post("/admin/enroll/complete", { enrollToken, code });
      finish(data.accessToken);
      setBackupCodes(data.backupCodes || []);
      setStep("backup");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const CodeField = (
    <FormControl>
      <FormLabel htmlFor="code">6-digit code</FormLabel>
      <TextField
        id="code"
        name="code"
        placeholder="123456"
        autoComplete="one-time-code"
        inputProps={{ inputMode: "numeric", "data-testid": "admin-2fa-code-input" }}
        autoFocus
        fullWidth
        variant="outlined"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
      />
    </FormControl>
  );

  return (
    <SignInContainer direction="column" justifyContent="space-between">
      <CssBaseline enableColorScheme />
      <Card variant="outlined" data-testid="admin-login-card">
        <Typography
          component="h1"
          variant="h4"
          sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}
        >
          {step === "password" && "Admin sign in"}
          {step === "totp" && "Two-factor verification"}
          {step === "enroll" && "Set up two-factor auth"}
          {step === "backup" && "Save your backup codes"}
        </Typography>

        {error && (
          <Alert severity="error" data-testid="admin-login-error">
            {error}
          </Alert>
        )}

        {step === "password" && (
          <Box component="form" onSubmit={submitPassword} sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 2 }}>
            <FormControl>
              <FormLabel htmlFor="email">Email</FormLabel>
              <TextField
                type="email"
                id="email"
                name="email"
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                fullWidth
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputProps={{ "data-testid": "admin-email-input" }}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                type="password"
                id="password"
                name="password"
                placeholder="••••••"
                autoComplete="current-password"
                fullWidth
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                inputProps={{ "data-testid": "admin-password-input" }}
              />
            </FormControl>
            <Button type="submit" fullWidth variant="contained" disabled={loading} data-testid="admin-login-submit">
              {loading ? <CircularProgress size={22} /> : "Continue"}
            </Button>
          </Box>
        )}

        {step === "totp" && (
          <Box component="form" onSubmit={submitTotp} sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Enter the 6-digit code from your authenticator app (or a backup code).
            </Typography>
            {CodeField}
            <Button type="submit" fullWidth variant="contained" disabled={loading} data-testid="admin-2fa-verify-btn">
              {loading ? <CircularProgress size={22} /> : "Verify & sign in"}
            </Button>
          </Box>
        )}

        {step === "enroll" && (
          <Box component="form" onSubmit={submitEnroll} sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Scan this QR code with Google Authenticator, 1Password or Authy, then enter the 6-digit code to finish.
            </Typography>
            {qr && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Authenticator QR code" width={190} height={190} data-testid="admin-enroll-qr" />
              </Box>
            )}
            {secret && (
              <Typography variant="caption" sx={{ wordBreak: "break-all", textAlign: "center" }} data-testid="admin-enroll-secret">
                Manual key: <strong>{secret}</strong>
              </Typography>
            )}
            {CodeField}
            <Button type="submit" fullWidth variant="contained" disabled={loading} data-testid="admin-enroll-verify-btn">
              {loading ? <CircularProgress size={22} /> : "Enable & sign in"}
            </Button>
          </Box>
        )}

        {step === "backup" && (
          <Box sx={{ display: "flex", flexDirection: "column", width: "100%", gap: 2 }} data-testid="admin-backup-codes">
            <Alert severity="warning">
              Store these one-time backup codes somewhere safe. Each works once if you lose your authenticator. They will not be shown again.
            </Alert>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1,
                fontFamily: "monospace",
                fontSize: 15,
                bgcolor: "action.hover",
                borderRadius: 1,
                p: 2,
              }}
            >
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </Box>
            <Button
              fullWidth
              variant="contained"
              onClick={() => router.replace("/admin")}
              data-testid="admin-backup-continue-btn"
            >
              I&apos;ve saved them — continue
            </Button>
          </Box>
        )}
      </Card>
    </SignInContainer>
  );
};

export default AdminLogin;
