import React from "react";
import { IconProps } from "../types";

const RightArrowIcon = ({ fill, size }: IconProps) => {
  return (
    <svg
      width={size || 16}
      height={size || 16}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 9L12.17 9L6.58 14.59L8 16L16 8L8 0L6.59 1.41L12.17 7L0 7V9Z"
        fill={fill}
      />
    </svg>
  );
};

export default RightArrowIcon;
