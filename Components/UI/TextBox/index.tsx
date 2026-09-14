import { useTheme } from "@mui/material";
import { TextField, TextFieldProps, Typography, Box } from "@mui/material";
import React from "react";

type TextBoxProps = TextFieldProps & {
  label?: string;
  customWidth?: string;
  cursor?: string;
  mt?: number;
  uppercase?: boolean;
};

const TextBox = ({
  label,
  customWidth,
  cursor,
  mt,
  sx,
  uppercase = false,
  ...props
}: TextBoxProps) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: customWidth ?? "100%",
        mt: mt,
        "& .MuiOutlinedInput-input": {
          padding: "11px 14px",
          ...(cursor && { cursor: `${cursor} !important` }),
        },
      }}
    >
      {label && (
        <Typography
          sx={{
            ml: 1,
            fontWeight: 600,
            fontSize: "11px",
            ...(uppercase
              ? { textTransform: "uppercase" }
              : {
                  textTransform: "lowercase",
                  "&:first-letter": {
                    textTransform: "uppercase",
                  },
                }),
          }}
        >
          {label}
        </Typography>
      )}
      <TextField
        sx={{
          ".MuiOutlinedInput-notchedOutline": {
            border: "0 !important",
          },
          ".Mui-focused": {
            ".MuiOutlinedInput-notchedOutline": {
              border: `1px solid ${theme.palette.primary.main} !important`,
            },
          },
          ".Mui-error": {
            ".MuiOutlinedInput-notchedOutline": {
              border: `1px solid ${theme.palette.error.main} !important`,
            },
          },
          ".Mui-disabled": {
            WebkitTextFillColor: `${theme.palette.primary.main} !important`,
            cursor: "not-allowed",
          },

          ...sx,
        }}
        {...props}
      />
    </Box>
  );
};

export default TextBox;
