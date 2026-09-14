import React from 'react';

const USDCIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
    <path d="M20.5 18.5C20.5 16.5 19 15.5 16 15C13.5 14.5 13 14 13 13C13 12 14 11.5 15.5 11.5C17 11.5 17.5 12 18 13L20 12C19.5 10.5 18 9.5 16.5 9.5V8H15V9.5C13 10 11.5 11.5 11.5 13.5C11.5 15.5 13 16.5 16 17C18 17.5 19 18 19 19C19 20 18 20.5 16.5 20.5C15 20.5 14 20 13.5 18.5L11.5 19.5C12 21 13.5 22 15 22.5V24H16.5V22.5C19 22 20.5 20.5 20.5 18.5Z" fill="white"/>
  </svg>
);

export default USDCIcon;
