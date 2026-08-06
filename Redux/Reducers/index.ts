import { combineReducers } from "@reduxjs/toolkit";
import userReducer from "./userReducer";
import toastReducer from "./toastReducer";
import apiReducer from "./apiReducer";
import transactionReducer from "./transactionReducer";
import dashboardReducer from "./dashboardReducer";
import paymentLinkReducer from "./paymentLinkReducer";

export default combineReducers({
  userReducer,
  toastReducer,
  apiReducer,
  transactionReducer,
  dashboardReducer,
  paymentLinkReducer,
});
