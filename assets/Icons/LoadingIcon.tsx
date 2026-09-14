import { IconProps } from "@/utils/types";
import React from "react";

const LoadingIcon = ({ fill, size = 15 }: IconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={`${size}px`}
      height={`${size}px`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid"
    >
      <circle
        cx="50"
        cy="50"
        r="35"
        strokeWidth="10"
        stroke={fill ?? "#1034a6"}
        strokeDasharray="54.97787143782138 54.97787143782138"
        fill="none"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          repeatCount="indefinite"
          dur="1s"
          keyTimes="0;1"
          values="0 50 50;360 50 50"
        ></animateTransform>
      </circle>
    </svg>
  );
};

export default LoadingIcon;
