import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CssBaseline from "@mui/material/CssBaseline";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import MuiCard from "@mui/material/Card";
import { styled } from "@mui/material/styles";
import FormManager from "@/Components/Page/Common/FormManager";
import * as yup from "yup";

import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
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

const AdminLogin = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const initialValue = {
    email: "",
    password: "",
  };

  const handleSubmit = async (values: any) => {
    try {
      console.log(values);
      const {
        data: { data, message },
      } = await adminBaseApi.post("/admin/login", values);
      console.log(data);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
        },
      });
      localStorage.setItem("admin_token", data.accessToken);
      router.replace("/admin");
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  const schema = yup.object().shape({
    email: yup
      .string()
      .email("Please enter a valid email")
      .required("email is required!"),
    password: yup.string().required("Password is required!"),
  });

  return (
    <SignInContainer direction="column" justifyContent="space-between">
      <Card variant="outlined">
        <Typography
          component="h1"
          variant="h4"
          sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}
        >
          Sign in
        </Typography>
        <FormManager
          initialValues={initialValue}
          onSubmit={handleSubmit}
          yupSchema={schema}
        >
          {({
            errors,
            handleBlur,
            handleChange,
            submitDisable,
            touched,
            values,
          }) => (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                gap: 2,
              }}
            >
              <FormControl>
                <FormLabel htmlFor="email">Email</FormLabel>
                <TextField
                  type="email"
                  placeholder="your@email.com"
                  autoComplete="email"
                  autoFocus
                  fullWidth
                  variant="outlined"
                  name="email"
                  value={values.email}
                  error={touched.email && errors.email}
                  helperText={touched.email && errors.email && errors.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="password">Password</FormLabel>
                <TextField
                  placeholder="••••••"
                  type="password"
                  id="password"
                  autoFocus
                  fullWidth
                  variant="outlined"
                  name="password"
                  value={values.password}
                  error={touched.password && errors.password}
                  helperText={
                    touched.password && errors.password && errors.password
                  }
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </FormControl>

              <Button type="submit" fullWidth variant="contained">
                Sign in
              </Button>
            </Box>
          )}
        </FormManager>
      </Card>
    </SignInContainer>
  );
};

export default AdminLogin;
