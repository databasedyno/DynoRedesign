import { menuItem } from "@/utils/types";
import {
  Typography,
  useTheme,
  Select,
  SelectChangeEvent,
  SelectProps,
  FormHelperText,
} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";

import React, { useEffect, useState } from "react";
import { brandFg } from "@/constants/theme";

type DropdownProps = SelectProps & {
  menuItems?: menuItem[];
  multiple?: boolean;
  getValue?: Function;
  helperText?: string;
};

const Dropdown = ({
  menuItems,
  multiple,
  getValue,
  defaultValue,
  label,
  ...rest
}: DropdownProps) => {
  const [value, setValue] = useState(defaultValue);
  const theme = useTheme();
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);
  return (
    <>
      {label && (
        <Typography
          sx={{
            ml: 1,
            fontWeight: "600 !important",
            fontSize: "11px",
            textTransform: "lowercase",
            "&:first-letter": {
              textTransform: "uppercase",
            },
          }}
        >
          {label}
        </Typography>
      )}
      <Select
        sx={{
          ".MuiOutlinedInput-notchedOutline": { border: "0 !important" },
          "&.Mui-focused": {
            "& .MuiSelect-outlined": {
              border: `1px solid ${theme.palette.primary.main} !important`,
              color: brandFg(theme.palette.mode === "dark"),
            },
          },
          "&.Mui-error": {
            // background: "red",
            "& .MuiSelect-outlined": {
              border: `1px solid ${theme.palette.error.main} !important`,
              color: theme.palette.error.main,
            },
          },
          "& .MuiSelect-multiple": {
            maxHeight: "200px",
            overflow: "auto",
          },
        }}
        value={value}
        multiple={multiple}
        onChange={(e: SelectChangeEvent<any>) => {
          setValue(e.target.value);
          getValue && getValue(e.target.value);
        }}
        {...rest}
      >
        {menuItems &&
          menuItems.map((item) => (
            <MenuItem
              disabled={item.disable}
              value={item.value}
              key={item.value}
            >
              {item.label}
            </MenuItem>
          ))}
      </Select>
      {rest.helperText && (
        <FormHelperText sx={{ ml: 2 }} error={rest.error}>
          {rest.helperText}
        </FormHelperText>
      )}
    </>
  );
};

export default Dropdown;
