import checkTouched from "./checkTouchedHelper";
import checkValidation from "./checkValidationHelper";
import createEncryption from "./createEncryption";

import getRandomColor from "./getRandomColor";
import getRandomNumber from "./getRandomNumber";
import getInitials from "./getInitials";
import inputHelper from "./inputHelper";
import unAuthorizedHelper from "./unAutorizedHelper";

const a11yProps = (index: number) => {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
};

const firstCapital = (string: string) => {
  let hasDash = false;
  if (string?.includes("_")) {
    hasDash = true;
  }

  const str = hasDash
    ? string.split("_").join(" ").toLowerCase()
    : string.toLowerCase();

  const returnedString = str.charAt(0).toUpperCase() + str.slice(1);

  return returnedString;
};

const extractLinks = (text: string) => {
  const regex = /^(https):\/\/[^ "]+\.[^ "]+$/;
  return text.match(regex);
};

const getTime = (dateStamp: any) => {
  const date = new Date(dateStamp);

  let hours = date.getHours();
  let minutes: any = date.getMinutes();
  let ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? "0" + minutes : minutes;
  let strTime = hours + ":" + minutes + " " + ampm;
  return strTime;
};

const generateRedirectUrl = (data: any) => {
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '');
  let url;
  url =
    serverUrl +
    "/payment/verify?response=" +
    JSON.stringify(data);

  return url;
};

const generateStatusUrl = (data: any) => {
  let url;
  const status = data?.status;
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '');
  if (status === "successful") {
    url =
      serverUrl +
      "/payment/success?response=" +
      JSON.stringify(data);
  } else {
    url =
      serverUrl +
      "/payment/failed?response=" +
      JSON.stringify(data);
  }
  return url;
};

const getCurrencySymbol = (currency: any, amount: any) => {
  switch (currency) {
    case "NGN":
      return "₦" + amount;
    case "KES":
      return amount;
    case "UGX":
      return amount;
    case "GHS":
      return "₵" + amount;
    case "RWF":
      return "₣" + amount;
    case "EUR":
      return "€" + amount;
    case "GBP":
      return "£" + amount;
    case "USD":
      return "$" + amount;
    default:
      return amount;
  }
};
const countDecimals = (number: number) => {
  if (Math.floor(number) === number) return 0;
  return number.toString().split(".")[1].length || 0;
};

const stringShorten = (string: string, startChars = 10, endChars = 5) => {
  const firstString = string.substring(0, startChars);
  const lastString = string.substring(string.length - endChars);
  return firstString + "••••••••••••••••••••" + lastString;
};

const formatNumberWithComma = (number: number): string => {
  const numStr = number.toString();
  const decimalIndex = numStr.indexOf(".");
  const decimalPlaces =
    decimalIndex === -1
      ? 0
      : Math.min(numStr.length - decimalIndex - 1, 2);
  return number
    .toLocaleString("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: 2,
    });
};

export {
  a11yProps,
  countDecimals,
  inputHelper,
  getRandomColor,
  checkValidation,
  checkTouched,
  unAuthorizedHelper,
  firstCapital,
  extractLinks,
  getRandomNumber,
  getInitials,
  createEncryption,
  getTime,
  generateRedirectUrl,
  generateStatusUrl,
  getCurrencySymbol,
  stringShorten,
  formatNumberWithComma,
};
