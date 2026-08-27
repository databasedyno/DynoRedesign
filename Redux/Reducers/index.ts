import { combineReducers } from "@reduxjs/toolkit";
import userReducer from "./userReducer";
import toastReducer from "./toastReducer";
import paymentLinkReducer from "./paymentLinkReducer";

export default combineReducers({
  userReducer,
  toastReducer,
  paymentLinkReducer,
});
