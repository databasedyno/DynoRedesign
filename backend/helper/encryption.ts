import { raw as envRaw } from "../utils/config";
import CryptoJS from "crypto-js";
import dotenv from "dotenv";
dotenv.config();

const localSecretKey = envRaw("CYPHER_KEY");

const encrypt = (content: unknown, secretKey?: string) => {
  const cipherText = CryptoJS.AES.encrypt(
    String(content),
    secretKey ?? localSecretKey
  ).toString();

  return cipherText;
};

const decrypt = (ciphertext, secretKey?: string) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey ?? localSecretKey);
  const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
  return decryptedText;
};

export { encrypt, decrypt };
