import { raw as envRaw } from "./config";
export const allowedOrigins = [
  envRaw("FRONTEND_URL"),
  envRaw("CHECKOUT_URL") || "https://checkout.dynopay.com",
  ...(envRaw("NODE_ENV") !== 'production' ? ["http://localhost:3000"] : [])
].filter(Boolean);

