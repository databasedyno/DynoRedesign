import { raw as envRaw } from "../utils/config";
import { HmacSHA256 } from "crypto-js";
import CryptoJS from "crypto-js";

/**
 * HTX API signature generation
 * Used for authenticated requests to HTX (formerly Huobi) exchange
 */
const sign_sha = (method: string, baseurl: string, path: string, data: Record<string, string | number | boolean>): string => {
  const pars: string[] = [];
  for (const item in data) {
    pars.push(item + "=" + encodeURIComponent(String(data[item])));
  }
  const p = pars.sort().join("&");
  const meta = [method, baseurl, path, p].join("\n");
  const hash = HmacSHA256(meta, envRaw("CRYPTO_SECRET_KEY") || '');
  const signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(hash));
  return `${p}&Signature=${signature}`;
};

export default sign_sha;
