import { Box, Button, Collapse, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";

import Cards, { Focused } from "react-credit-cards-2";
import "react-credit-cards-2/dist/es/styles-compiled.css";
import * as yup from "yup";
import FormManager from "../Common/FormManager";
import TextBox from "@/Components/UI/TextBox";
import { formatCreditCardNumber, formatExpirationDate } from "./utils";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { createEncryption, generateRedirectUrl } from "@/helpers";
import axiosBaseApi from "@/axiosConfig";
import { useRouter } from "next/router";
import { paymentTypes } from "../../../utils/enums";
import { CardApiRes, cardType } from "@/utils/types/paymentTypes";
import { API_ENDPOINTS } from "@/api/endpoints";

const initialValue = {
  number: "",
  expiry: "",
  cvc: "",
  name: "",
  focus: "",
};

const CardComponent = () => {
  const [state, setState] = useState<cardType>({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
    focus: "",
  });

  const [isValid, setIsValid] = useState(false);
  const [authType, setAuthType] = useState<any>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [hash, setHash] = useState<string>("");
  const [collapse, setCollapse] = useState(false);
  const [fieldInitialValue, setFieldInitialValue] = useState<any>();
  const walletState = useSelector((state: rootReducer) => state.walletReducer);
  const [fieldSchema, setFieldSchema] = useState<any>();
  const cardPaymentSchema = yup.object().shape({
    name: yup
      .string()
      .required("card holder name is required!")
      .max(30, "Please enter a valid name"),
    expiry: yup
      .string()
      .required("Please enter expiry date")
      .test("expiry", "please provide a valid expiry date", (value) => {
        if (value.includes("/")) {
          const expiryData = value.split("/");
          const currentYear = Number(
            new Date().getFullYear().toString().slice(2)
          );
          if (Number(expiryData[0]) > 12 || Number(expiryData[0]) < 1) {
            return false;
          } else if (Number(expiryData[1]) < currentYear) {
            return false;
          }
          return true;
        } else {
          return false;
        }
      }),
    cvc: yup.string().required("please enter cvc"),
    number: yup
      .string()
      .required("please enter a valid card")
      .test("number", "please provide a valid card", (value) => {
        const trimmedValue = value.replaceAll(" ", "");
        if (trimmedValue.length < 15) {
          return false;
        }
        return true;
      }),
  });

  useEffect(() => {
    if (authType !== null) {
      setCollapse(true);
    }
  }, [authType]);

  useEffect(() => {
    if (fields.length > 0) {
      const tempObject: any = {};
      for (let i = 0; i < fields.length; i++) {
        tempObject[fields[i]] = "";
      }

      setFieldInitialValue(tempObject);
      const tempSchema = yup.object().shape({
        ...(fields.includes("pin")
          ? {
              pin: yup.string().required("please provide pin"),
            }
          : fields.includes("otp")
          ? { otp: yup.string().required("please provide otp") }
          : {
              city: yup.string().required("please provide city"),
              address: yup.string().required("please provide address"),
              state: yup.string().required("please provide state"),
              country: yup.string().required("please provide country"),
              zipcode: yup.string().required("please provide zipcode"),
            }),
      });
      setFieldSchema(tempSchema);
    }
  }, [fields]);

  const handleInputChange = (evt: any) => {
    let { name, value } = evt.target;

    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputFocus = (evt: any) => {
    setState((prev) => ({ ...prev, focus: evt.target.name }));
  };

  const handleSubmit = async (values: any) => {
    const { number } = values;
    const trimmedValue = number.replaceAll(" ", "");

    const finalPayload = {
      ...values,
      paymentType: paymentTypes.CARD,
      number: trimmedValue,
      currency: walletState.currency,
      amount: walletState.amount,
    };
    const res = await createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: CardApiRes } = await axiosBaseApi.post(API_ENDPOINTS.wallet.addFunds, {
      data: res,
    });

    if (data.mode === "pin" || data.mode === "avs_noauth") {
      setAuthType(data.mode);
      setFields(data.fields);
      setHash(data.hash);
    } else {
      window.location.replace(data.redirect);
    }
  };

  const handleFieldSubmit = async (values: any) => {
    const finalPayload = {
      ...values,
      uniqueRef: hash,
      paymentType: paymentTypes.CARD,
      mode: authType,
    };
    const res = await createEncryption(JSON.stringify(finalPayload));

    const {
      data: { data },
    }: { data: CardApiRes } = await axiosBaseApi.post(API_ENDPOINTS.wallet.authStep, {
      data: res,
    });
    if (data.mode === "redirect") {
      window.location.replace(data.redirect);
    } else {
      if (data?.status) {
        const redirectUri = generateRedirectUrl(data);
        window.location.replace(redirectUri);
      } else {
        setAuthType("otp");
        setFields(["otp"]);
        setHash(data.hash);
      }
    }
  };

  return (
    <Box>
      <Collapse in={!collapse}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mt: 5,
            width: "100%",
          }}
        >
          <Cards
            number={state.number}
            expiry={state.expiry}
            cvc={state.cvc}
            name={state.name}
            preview
            focused={state.focus}
            callback={(type, valid) => {
              console.log("here", type, valid);

              setIsValid(valid);
            }}
          />
          <Box
            sx={{
              width: "100%",
            }}
          >
            <FormManager
              initialValues={initialValue}
              yupSchema={cardPaymentSchema}
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
                    }}
                  >
                    <TextBox
                      name="name"
                      placeholder="Enter card holder name"
                      label="card holder"
                      value={values.name}
                      fullWidth
                      onChange={(e) => {
                        handleInputChange(e);
                        handleChange(e);
                      }}
                      onFocus={handleInputFocus}
                      onBlur={handleBlur}
                      error={touched.name && errors.name}
                      helperText={touched.name && errors.name && errors.name}
                    />
                    <TextBox
                      type="tel"
                      name="number"
                      placeholder="Enter card number"
                      label="Card number"
                      value={values.number}
                      fullWidth
                      onChange={(evt) => {
                        let e: any = {
                          target: {
                            name: "number",
                            value: formatCreditCardNumber(evt.target.value),
                          },
                        };
                        handleInputChange(e);
                        handleChange(e);
                      }}
                      onFocus={handleInputFocus}
                      onBlur={handleBlur}
                      error={touched.number && errors.number}
                      helperText={
                        touched.number && errors.number && errors.number
                      }
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <TextBox
                        name="expiry"
                        placeholder="Expiry Date"
                        value={values.expiry}
                        label={"valid till"}
                        fullWidth
                        onChange={(evt) => {
                          let e: any = {
                            target: {
                              name: "expiry",
                              value: formatExpirationDate(evt.target.value),
                            },
                          };

                          handleInputChange(e);
                          handleChange(e);
                        }}
                        onFocus={handleInputFocus}
                        onBlur={handleBlur}
                        error={touched.expiry && errors.expiry}
                        helperText={
                          touched.expiry && errors.expiry && errors.expiry
                        }
                      />
                      <Box>
                        <Typography
                          sx={{ fontSize: 11, fontWeight: 600, ml: 1 }}
                        >
                          CVC/CVV
                        </Typography>
                        <TextBox
                          type="password"
                          name="cvc"
                          placeholder="CVC"
                          value={state.cvc}
                          fullWidth
                          onChange={(e) => {
                            handleInputChange(e);
                            handleChange(e);
                          }}
                          onInput={(e: any) => {
                            const isDigit = new RegExp(/[0-9]/gm).test(
                              e.target.value
                            );

                            if (e.target.value !== "" && isDigit) {
                              e.target.value = Math.max(
                                0,
                                parseInt(e.target.value)
                              )
                                .toString()
                                .slice(0, 4);
                            } else {
                              e.target.value = "";
                            }
                          }}
                          onFocus={handleInputFocus}
                          onBlur={handleBlur}
                          error={touched.cvc && errors.cvc}
                          helperText={touched.cvc && errors.cvc && errors.cvc}
                        />
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ mt: 3, textAlign: "right" }}>
                    <Button
                      variant="rounded"
                      type="submit"
                      disabled={submitDisable}
                      // disabled={isValid === false ? true : submitDisable}
                    >
                      Pay ${walletState.amount}
                    </Button>
                  </Box>
                </>
              )}
            </FormManager>
          </Box>
        </Box>
      </Collapse>
      <Collapse in={collapse}>
        {fields.length > 0 && fieldInitialValue && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              mt: 5,
              width: "100%",
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: "500px",
                mx: "auto",
              }}
            >
              <FormManager
                initialValues={fieldInitialValue}
                yupSchema={fieldSchema}
                onSubmit={handleFieldSubmit}
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
                      }}
                    >
                      {fields.map((x) => (
                        <TextBox
                          key={x}
                          name={x}
                          type={
                            ["pin", "zipcode"].indexOf(x) !== -1
                              ? "number"
                              : "text"
                          }
                          placeholder={`Enter ${x}`}
                          label={x}
                          value={values[x]}
                          fullWidth
                          onChange={handleChange}
                          onBlur={handleBlur}
                          error={touched[x] && errors[x]}
                          helperText={touched[x] && errors[x] && errors[x]}
                        />
                      ))}
                    </Box>
                    <Box sx={{ mt: 3, textAlign: "right" }}>
                      <Button
                        variant="rounded"
                        type="submit"
                        disabled={submitDisable}
                      >
                        Submit
                      </Button>
                    </Box>
                  </>
                )}
              </FormManager>
            </Box>
          </Box>
        )}
      </Collapse>
    </Box>
  );
};

export default CardComponent;
