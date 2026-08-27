import { showToast } from "@/helpers/toastStore";
import { EditRounded } from "@mui/icons-material";
import {
  Box,
  Button,
  Collapse,
  Divider,
  FormHelperText,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";

import * as yup from "yup";

import { firstCapital } from "@/helpers";
import { TokenData } from "@/utils/types";
import Panel from "@/Components/UI/Panel";

import TextBox from "@/Components/UI/TextBox";
import { MuiTelInput } from "mui-tel-input";
import FormManager from "@/Components/Page/Common/FormManager";
import { decodeJwt } from "@/utils/decodeJwt";
import adminBaseApi from "@/axiosAdmin";

const initialValue = {
  email: "",
  otp: "",
};

const initialPasswords = {
  oldPassword: "",
  newPassword: "",
};

const AdminProfilePage = () => {

  const fileRef = useRef<any>();
  const [otpSent, setOTPSent] = useState(false);
  const [editable, setEditable] = useState(false);
  const [initialUser, setInitialUser] = useState({ ...initialValue });
  const [initialPass, setInitialPass] = useState({ ...initialPasswords });
  const [currentEmail, setCurrentEmail] = useState("");

  const regex = new RegExp(
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()-=_+{}[\]:;<>,.?/~]).{8,20}$/,
    "gm"
  );

  const registerSchema = yup.object().shape({
    email: yup
      .string()
      .email("Please enter a valid email")
      .required("email is required"),
    ...(otpSent && {
      otp: yup
        .string()
        .required("otp is required")
        .test(
          "len",
          "Must be exactly 6 digits",
          (val: any) => val.toString().length === 6
        ),
    }),
  });

  useEffect(() => {
    if (localStorage) {
      const token = decodeJwt<TokenData>(
        localStorage.getItem("admin_token") ?? ""
      ) as TokenData;
      setInitialUser({
        ...initialUser,
        email: token?.email,
      });
      setCurrentEmail(token?.email);
    }
  }, []);

  const passwordSchema = yup.object().shape({
    newPassword: yup
      .string()
      .required("New password is required")
      .matches(
        regex,
        "Please enter a valid password (requires 1 capital letter,1 small letter,1 number,1 special character and minimum 8 digit)"
      ),
  });

  const handleSubmit = async (values: any) => {
    try {
      const { email, otp } = values;
      const finalPayload = {
        otp,
        email,
      };
      if (currentEmail === email) {
        setEditable(false);
        return;
      }

      const {
        data: { data, message },
      } = await adminBaseApi.put("admin/updateEmail", { ...finalPayload });

      showToast({
          message: message,
        });

      if (!otp) {
        setOTPSent(true);
      } else {
        localStorage.setItem("admin_token", data?.accessToken);
        setInitialUser({ ...initialUser, email });
        setEditable(false);
        setOTPSent(false);
      }
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  const handlePasswordSubmit = async (values: any) => {
    try {
      const {
        data: { data, message },
      } = await adminBaseApi.put("admin/changePassword", { ...values });

      showToast({
          message: message,
        });

      setInitialPass({ ...initialPasswords });
    } catch (e: any) {
      const message = e.response.data.message ?? e.message;
      showToast({
          message: message,
          severity: "error",
        });
    }
  };

  return (
    <Grid container columnSpacing={3} sx={{ mb: 3, rowGap: 2 }}>
      <Grid item md={6} xs={12}>
        <Panel>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6" fontWeight={700}>
              Email Update
            </Typography>

            {!editable && (
              <IconButton onClick={() => setEditable(true)}>
                <EditRounded color="secondary" />
              </IconButton>
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              position: "relative",
              mt: 3,
              width: "fit-content",
              "& img": {
                width: "200px",
                height: "200px",
                borderRadius: "20px",
                objectFit: "cover",
              },
              ...(editable && {
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: "rgba(0,0,0,0.3)",
                  zIndex: 1,
                  borderRadius: "20px",
                  transition: "0.3s",
                  opacity: 0,
                },
                "& .actionbar": {
                  position: "absolute",
                  top: "5px",
                  right: "5px",
                  opacity: 0,
                  transition: "0.3s",

                  boxShadow:
                    "rgb(0 0 0 / 20%) 0px 3px 1px -2px, rgb(0 0 0 / 14%) 0px 2px 2px 0px, rgb(0 0 0 / 12%) 0px 1px 5px 0px",
                  zIndex: 2,
                  background: "#fff",
                  borderRadius: "20px",
                },
                "&:hover": {
                  cursor: "pointer",
                  "& img": {
                    // opacity: 0.5,
                  },
                  "& .actionbar": {
                    opacity: 1,
                  },
                  "&::before": {
                    opacity: 1,
                  },
                },
              }),
            }}
          >
            {/* eslint-disable-next-line */}

            {editable && (
              <Box className="actionbar">
                <IconButton onClick={() => fileRef.current.click()}>
                  <EditRounded color="secondary" />
                </IconButton>
              </Box>
            )}
          </Box>
          <FormManager
            initialValues={initialUser}
            yupSchema={registerSchema}
            onSubmit={handleSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
            }) => (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    rowGap: "20px",
                    width: "100%",
                    mt: 5,
                  }}
                >
                  <TextBox
                    fullWidth={true}
                    label="email"
                    placeholder="Enter your email"
                    name="email"
                    value={values.email}
                    error={touched.email && errors.email}
                    helperText={touched.email && errors.email && errors.email}
                    disabled={otpSent ? otpSent : !editable}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  <Collapse in={otpSent} sx={{ width: "100%" }}>
                    <TextBox
                      fullWidth={true}
                      label="OTP"
                      placeholder="Enter otp"
                      name="otp"
                      value={values.otp}
                      error={touched.otp && errors.otp}
                      helperText={touched.otp && errors.otp && errors.otp}
                      disabled={!editable}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Collapse>
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    disableRipple={false}
                    sx={{
                      mt: 2,
                      borderRadius: "30px",
                      textTransform: "none",
                    }}
                    type="submit"
                    disabled={submitDisable ? submitDisable : !editable}
                  >
                    Update
                  </Button>

                  {editable && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      disableRipple={false}
                      sx={{
                        mt: 2,
                        ml: 1,
                        px: 3,
                        py: 1.5,
                        borderRadius: "30px",
                        textTransform: "none",
                      }}
                      onClick={() => {
                        setEditable(false);
                        setOTPSent(false);
                        setInitialUser({
                          ...initialValue,
                          email: currentEmail,
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </Box>
              </>
            )}
          </FormManager>
        </Panel>
      </Grid>
      <Grid item md={6} xs={12}>
        <Panel>
          <Typography variant="h6" fontWeight={700}>
            Update Password
          </Typography>

          <FormManager
            initialValues={initialPass}
            yupSchema={passwordSchema}
            onSubmit={handlePasswordSubmit}
          >
            {({
              errors,
              handleBlur,
              handleChange,
              submitDisable,
              touched,
              values,
            }) => (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    rowGap: "20px",
                    width: "100%",
                    mt: 2.5,
                  }}
                >
                  <Box sx={{ width: "100%" }}>
                    <TextBox
                      fullWidth={true}
                      label="Old Password"
                      placeholder="Enter your old password"
                      name="oldPassword"
                      value={values.oldPassword}
                      error={touched.oldPassword && errors.oldPassword}
                      type="password"
                      helperText={
                        touched.oldPassword &&
                        errors.oldPassword &&
                        errors.oldPassword
                      }
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </Box>

                  <TextBox
                    fullWidth={true}
                    label="New Password"
                    placeholder="Enter your new password"
                    name="newPassword"
                    type="password"
                    value={values.newPassword}
                    error={touched.newPassword && errors.newPassword}
                    helperText={
                      touched.newPassword &&
                      errors.newPassword &&
                      errors.newPassword
                    }
                    onChange={(e) => {
                      handleChange(e);
                      console.log(e.target.value);
                    }}
                    onBlur={handleBlur}
                  />
                </Box>

                <Box sx={{ mt: 1 }}>
                  <Button
                    variant="contained"
                    color="secondary"
                    disableRipple={false}
                    sx={{
                      my: 2,
                      borderRadius: "30px",
                      textTransform: "none",
                    }}
                    type="submit"
                    disabled={submitDisable}
                  >
                    Update
                  </Button>
                </Box>
              </>
            )}
          </FormManager>
        </Panel>
      </Grid>
    </Grid>
  );
};

export default AdminProfilePage;
