import express from "express";
import { revertWalletChange } from "../controller/wallet/walletSecurity";

/**
 * PUBLIC wallet-security routes — mounted WITHOUT auth so the one-tap
 * "this wasn't me" email link works from any inbox. Token-authenticated only.
 */
const walletSecurityRouter = express.Router();

walletSecurityRouter.post("/revert-change", revertWalletChange);

export default walletSecurityRouter;
