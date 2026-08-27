import { combineReducers } from "@reduxjs/toolkit";
import userReducer from "./userReducer";
import toastReducer from "./toastReducer";

export default combineReducers({
  userReducer,
  toastReducer,
});
