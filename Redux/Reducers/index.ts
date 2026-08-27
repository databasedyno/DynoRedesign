import { combineReducers } from "@reduxjs/toolkit";
import userReducer from "./userReducer";
import toastReducer from "./toastReducer";
import dashboardReducer from "./dashboardReducer";
import paymentLinkReducer from "./paymentLinkReducer";

export default combineReducers({
  userReducer,
  toastReducer,
  dashboardReducer,
  paymentLinkReducer,
});
