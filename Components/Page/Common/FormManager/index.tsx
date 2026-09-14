import { checkTouched, checkValidation, inputHelper } from "@/helpers";
import React, { useEffect, useState } from "react";
import { FormManagerProps, Values } from "./types";

const FormManager = ({
  initialValues,
  children,
  yupSchema,
  onSubmit,
}: FormManagerProps) => {
  let initialTouchValue: any = {};
  Object.keys(initialValues).map((x) => {
    initialTouchValue[x] = false;
  });

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const [values, setValues] = useState({ ...initialValues });
  const [errors, setErrors] = useState({ ...initialValues });
  const [submitDisable, setSubmitDisable] = useState(false);
  const [touched, setTouched] = useState(initialTouchValue);

  const handleBlur = async (e: React.FocusEvent<any>) => {
    if (yupSchema) {
      const tempTouched = checkTouched(touched, e);
      const tempErrors = await checkValidation(yupSchema, { ...values });
      const tempInitialValues: any = {};
      Object.keys(initialValues).map((item) => {
        if (Number.isInteger(initialTouchValue && initialTouchValue[item]))
          tempInitialValues[item] = "";
        else tempInitialValues[item] = "";
      });
      setErrors(tempErrors ?? { ...tempInitialValues });
      setSubmitDisable(tempErrors ? true : false);
      setTouched(tempTouched);
    }
  };

  const handleChange = (e: React.ChangeEvent<any>) => {
    if (yupSchema) {
      const tempData = inputHelper({ ...values }, e);
      // Update values first to ensure validation uses the latest data
      setValues(tempData);
      // Then validate with the new values
      const tempErrors = checkValidation(yupSchema, tempData);
      const tempInitialValues: any = {};
      Object.keys(initialValues).map((item) => {
        if (Number.isInteger(initialTouchValue && initialTouchValue[item]))
          tempInitialValues[item] = "";
        else tempInitialValues[item] = "";
      });
      setErrors(tempErrors ?? { ...tempInitialValues });
      // Enable submit if validation passes (no errors)
      setSubmitDisable(tempErrors ? true : false);
    } else {
      // If no schema, just update values and enable submit
      const tempData = inputHelper({ ...values }, e);
      setValues(tempData);
      setSubmitDisable(false);
    }
  };

  const handleFieldsChange = (updates: Partial<Values>) => {
    if (yupSchema) {
      const tempData = { ...values, ...updates };
      setValues(tempData);
      const tempErrors = checkValidation(yupSchema, tempData);
      const tempInitialValues: any = {};
      Object.keys(initialValues).map((item) => {
        if (Number.isInteger(initialTouchValue && initialTouchValue[item]))
          tempInitialValues[item] = "";
        else tempInitialValues[item] = "";
      });
      setErrors(tempErrors ?? { ...tempInitialValues });
      setSubmitDisable(tempErrors ? true : false);
    } else {
      const tempData = { ...values, ...updates };
      setValues(tempData);
      setSubmitDisable(false);
    }
  };

  const handleSubmit = (e: any) => {
    if (yupSchema) {
      e.preventDefault();
      const tempErrors = checkValidation(yupSchema, values);
      const touchedTrue: any = {};
      Object.keys(initialValues).map((x) => {
        touchedTrue[x] = true;
      });
      setTouched(touchedTrue);
      const tempInitialValues: any = {};
      Object.keys(initialValues).map((item) => {
        if (Number.isInteger(initialTouchValue && initialTouchValue[item]))
          tempInitialValues[item] = "";
        else tempInitialValues[item] = "";
      });
      setErrors(tempErrors ?? { ...tempInitialValues });
      setSubmitDisable(tempErrors ? true : false);
      if (!tempErrors) {
        onSubmit(values);
      }
    }
  };

  const revalidate = () => {
    if (yupSchema) {
      const tempErrors = checkValidation(yupSchema, values);
      const tempInitialValues: any = {};
      Object.keys(initialValues).map((item) => {
        if (Number.isInteger(initialTouchValue && initialTouchValue[item]))
          tempInitialValues[item] = "";
        else tempInitialValues[item] = "";
      });
      setErrors(tempErrors ?? { ...tempInitialValues });
      setSubmitDisable(tempErrors ? true : false);
    }
  };

  useEffect(() => {
    revalidate();
  }, [yupSchema]);

  return (
    <form method="post" onSubmit={handleSubmit}>
      {children({
        errors,
        handleBlur,
        handleChange,
        touched,
        values,
        submitDisable,
        revalidate,
        handleFieldsChange,
      })}
    </form>
  );
};

export default FormManager;
