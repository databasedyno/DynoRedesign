import React, { useEffect, useRef } from "react";
import { Box, FormHelperText, Typography } from "@mui/material";
interface TextAreaProps {
  value?: string | number;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  name: string;
  placeHolder?: string;
  error?: boolean;
  height?: number | string;
  label?: string;
  helperText?: string;
  onBlur?: any;
  mt?: any;
  isDynamic?: boolean;
  disabled?: boolean;
  borderRadius?: number;
  background?: string;
  focusNone?: boolean;
  dynamicTextAreaHeight?: (arg0: number) => void;
}
const TextArea = ({
  value,
  onChange,
  name,
  placeHolder,
  error,
  label,
  height,
  helperText,
  onBlur,
  mt,
  isDynamic = false,
  disabled = false,
  borderRadius = 20,
  background,
  focusNone = false,
  dynamicTextAreaHeight,
}: TextAreaProps) => {
  const textareaRef = useRef<any>();

  useEffect(() => {
    if (textareaRef.current && isDynamic) {
      const textarea = textareaRef.current;

      textarea.addEventListener("keyup", function (e: any) {
        // if (e.key === "Enter") {
        autoExpandTextarea(textarea);
        // }
      });
    }
  }, [textareaRef, isDynamic]);

  const autoExpandTextarea = (textarea: any) => {
    // Reset the textarea height to default to properly calculate the new height
    textarea.style.height = "auto";

    // Set the new height based on the scroll height
    textarea.style.height = textarea.scrollHeight + "px";
    const height = Number(textarea.style.height.slice(0, -2));
    let tempHeight = height;
    if (height > 200) {
      tempHeight = 200;
    }
    dynamicTextAreaHeight && dynamicTextAreaHeight(tempHeight);
  };

  return (
    <>
      {label && (
        <Typography
          sx={{
            ml: 1,
            mt: mt ?? 0,
            fontWeight: 600,
            fontSize: "11px",
            textTransform: "capitalize",
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        sx={{
          "& *": {
            width: "100%",
            height: height ?? 230,
            background: background ?? "#f8f8f8",
            fontFamily: "poppins",
            borderRadius: `${borderRadius}px`,
            maxHeight: isDynamic ? "200px" : "300px",
            border: 0,
            padding: 2,
            resize: "none",
            ...(focusNone && {
              outline: "none !important",
            }),
          },
        }}
      >
        <textarea
          ref={textareaRef}
          className={error ? "errorFile" : ""}
          name={name}
          onChange={onChange}
          value={value}
          placeholder={placeHolder}
          onBlur={onBlur}
          disabled={disabled}
        ></textarea>
      </Box>
      <FormHelperText sx={{ ml: 2 }} error={error}>
        {helperText}
      </FormHelperText>
    </>
  );
};

export default TextArea;
