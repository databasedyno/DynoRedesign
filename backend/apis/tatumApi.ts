import {
  FeeEvmBased,
  PrivKey,
  SignatureId,
  TatumApi,
  TransactionHash,
} from "@tatumio/api-client";
import { cronLogger } from "../utils/loggers";
import { IGenerateUserAddressParams, virtualAccount } from "../utils/types";
// Phase 4: route Tatum/blockchain HTTP through the shared resilient client
// (auto-retries transient GET failures; writes are never retried). See utils/tatumHttp.ts.
import axios from "../utils/tatumHttp";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import tronweb from "tronweb";
import { Crc32c } from "@aws-crypto/crc32c";
import { buildUrl } from "../helper";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { withSdkFallback } from "../utils/rpcFallback";
import {
  calculateOptimalFeeLimit,
  calculateDynamicTRC20Fee,
  calculateDynamicTRXNativeFee,
  logCostSavings,
} from "../services/tronEnergyService";
import * as bchaddr from "bchaddrjs";

// Type interfaces for blockchain transaction data
interface ERC20Transaction {
  to?: string;
  from?: string;
  value?: string;
  transactionHash?: string;
  txId?: string;
  hash?: string;
  timestamp?: number;
  blockTimestamp?: number;
}

interface UTXOOutput {
  address?: string;
  value?: string;
}

interface UTXOTransaction {
  hash?: string;
  outputs?: UTXOOutput[];
  time?: number;
}

interface BlockchainTxWithConfirmations {
  confirmations?: number;
  blockNumber?: number;
}

interface TronBlockInfo {
  block_header?: {
    raw_data?: {
      number?: number;
    };
  };
  blockNumber?: number;
}

// Type guard for TransactionHash (has txId)
const isTransactionHash = (result: TransactionHash | SignatureId): result is TransactionHash => {
  return 'txId' in result;
};

// Testnet configuration helper
const isTestnet = () => process.env.TATUM_TESTNET === 'true';
const getTestnetType = () => process.env.TATUM_TESTNET_TYPE || 'ethereum-sepolia';

// Get headers with optional testnet type
const getTatumHeaders = async () => {
  const tatumKey = await getTatumKey();
  const headers: Record<string, string> = {
    "x-api-key": tatumKey,
  };
  
  if (isTestnet()) {
    headers["x-testnet-type"] = getTestnetType();
    cronLogger.info(`[Tatum] Using TESTNET mode: ${getTestnetType()}`);
  }
  
  return headers;
};

/**
 * Normalize PEM private key newlines.
 * Handles multiple escape levels:
 *  - \\n  (double-escaped, e.g. DigitalOcean App Platform injects two literal backslashes + n)
 *  - \n   (single-escaped, standard dotenv / Railway / Heroku)
 *  - real newlines (already correct — no-op)
 * Order matters: collapse double-escapes first, then single-escapes.
 */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/\\\\n/g, '\n')   // \\n  →  real newline
    .replace(/\\n/g, '\n');     // \n   →  real newline
}

// CRC32C helper using AWS Crypto library (pure JavaScript, works on all platforms)
const crc32c = {
  calculate: (data: Buffer | string): number => {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    const crc = new Crc32c();
    crc.update(buffer);
    return Number(crc.digest());
  }
};

const encryptSymmetric = async (dataToEncrypt, keyId) => {
  const plaintextBuffer = Buffer.from(dataToEncrypt);
  const projectId = process.env.PROJECT_ID;
  const locationId = process.env.LOCATION_ID;
  const keyRingId = process.env.KEY_RING_ID;

  // Properly format private key: ensure newlines are converted from \n to actual newlines
  const privateKey = normalizePrivateKey(process.env.GOOGLE_CLIENT_KEY);

  const client = new KeyManagementServiceClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    } as Record<string, unknown>,
  });

  const keyName = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);

  const plaintextCrc32c = crc32c.calculate(plaintextBuffer);
  const [encryptResponse] = await client.encrypt({
    name: keyName,
    plaintext: plaintextBuffer,
    plaintextCrc32c: {
      value: plaintextCrc32c,
    },
  });

  const ciphertext = encryptResponse.ciphertext;

  if (!encryptResponse.verifiedPlaintextCrc32c) {
    throw new Error("Encrypt: request corrupted in-transit");
  }
  if (
    crc32c.calculate(ciphertext as string) !==
    Number(encryptResponse.ciphertextCrc32c.value)
  ) {
    throw new Error("Encrypt: response corrupted in-transit");
  }

  return ciphertext.toString("base64");
};

async function decryptSymmetric(ciphertext, keyId) {
  const projectId = process.env.PROJECT_ID;
  const locationId = process.env.LOCATION_ID;
  const keyRingId = process.env.KEY_RING_ID;
  
  // Properly format private key: ensure newlines are converted from \n to actual newlines
  const privateKey = normalizePrivateKey(process.env.GOOGLE_CLIENT_KEY);
  
  const client = new KeyManagementServiceClient({
    credentials: {
      type: "service_account",
      project_id: projectId,
      private_key_id: process.env.PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
    } as Record<string, unknown>,
  });

  const buffer = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const keyName = client.cryptoKeyPath(projectId, locationId, keyRingId, keyId);

  const ciphertextCrc32c = crc32c.calculate(buffer as Buffer);
  const [decryptResponse] = await client.decrypt({
    name: keyName,
    ciphertext: buffer,
    ciphertextCrc32c: {
      value: ciphertextCrc32c,
    },
  });
  if (
    crc32c.calculate(decryptResponse.plaintext as Buffer) !==
    Number(decryptResponse.plaintextCrc32c.value)
  ) {
    throw new Error("Decrypt: response corrupted in-transit");
  }

  const plaintext = decryptResponse.plaintext.toString();

  return plaintext;
}

let tatumSdkInitLogged = false;

const getTatumSDK = async () => {
  try {
    // Use testnet key if in testnet mode
    if (isTestnet() && process.env.TATUM_TESTNET_KEY) {
      if (!tatumSdkInitLogged) cronLogger.info('[getTatumSDK] Using TESTNET key');
      const tatumSdk = TatumApi(process.env.TATUM_TESTNET_KEY);
      tatumSdkInitLogged = true;
      return tatumSdk;
    }
    
    let tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    
    if (!tatumKey) {
      if (!tatumSdkInitLogged) cronLogger.info('[getTatumSDK] No Tatum key found in .env, attempting Secret Manager...');
      const privateKey = normalizePrivateKey(process.env.GOOGLE_CLIENT_KEY);
      const client = new SecretManagerServiceClient({
        credentials: {
          type: "service_account",
          project_id: process.env.PROJECT_ID,
          private_key_id: process.env.PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
        } as Record<string, unknown>,
      });
      const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID || '163670787265';
      const [version] = await client.accessSecretVersion({
        name: `projects/${gcpProjectId}/secrets/Dynopay_Tatum/versions/latest`,
      });
      const payload = version.payload.data.toString();
      tatumKey = payload;
      if (!tatumSdkInitLogged) cronLogger.info('[getTatumSDK] Using key from Secret Manager');
    } else {
      if (!tatumSdkInitLogged) cronLogger.info('[getTatumSDK] Using key from .env file');
    }
    
    const tatumSdk = TatumApi(tatumKey);
    if (!tatumSdkInitLogged) cronLogger.info('[getTatumSDK] TatumApi initialized: true');
    tatumSdkInitLogged = true;
    return tatumSdk;
  } catch (e) {
    cronLogger.info('[getTatumSDK] ERROR:', e);
    throw e;
  }
};

const getTatumKey = async () => {
  try {
    // Use testnet key if in testnet mode
    if (isTestnet() && process.env.TATUM_TESTNET_KEY) {
      cronLogger.info('[getTatumKey] Using TESTNET key');
      return process.env.TATUM_TESTNET_KEY;
    }
    
    let tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    if (!tatumKey) {
      const privateKey = normalizePrivateKey(process.env.GOOGLE_CLIENT_KEY);
      const client = new SecretManagerServiceClient({
        credentials: {
          type: "service_account",
          project_id: process.env.PROJECT_ID,
          private_key_id: process.env.PRIVATE_KEY_ID,
          private_key: privateKey,
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
        } as Record<string, unknown>,
      });
      const gcpProjectId = process.env.GCP_PROJECT_ID || process.env.PROJECT_ID || '1098360994708';
      const [version] = await client.accessSecretVersion({
        name: `projects/${gcpProjectId}/secrets/Dynopay_Tatum/versions/latest`,
      });
      const payload = version.payload.data.toString();
      tatumKey = payload;
    }
    return tatumKey;
  } catch (e) {
    cronLogger.info(e);
  }
};

const testingFunction = async () => {
  try {
    const tatumSdk = await getTatumSDK();
    const data = await tatumSdk.blockchain.bitcoin.btcGetBlockChainInfo();

    return data;
  } catch (e) {
    cronLogger.info(e);
  }
};

const generateWallet = async (currency) => {
  try {
    const tatumSdk = await getTatumSDK();
    let mnemonic, xpub, address, privateKey;
    if (currency === "BTC") {
      const wallet = await tatumSdk.blockchain.bitcoin.btcGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.bitcoin.btcGenerateAddress(xpub, index)
      ).address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}: ${address}`);
    } else if (currency === "ETH") {
      const wallet = await tatumSdk.blockchain.eth.ethGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index))
        .address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived ETH address for index ${index}: ${address}`);
    } else if (currency === "TRX") {
      const wallet = await tatumSdk.blockchain.tron.generateTronwallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.tron.tronGenerateAddress(xpub, index)
      ).address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    } else if (currency === "DOGE") {
      const wallet = await tatumSdk.blockchain.doge.dogeGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.doge.dogeGenerateAddress(xpub, index)
      ).address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    } else if (currency === "LTC") {
      const wallet = await tatumSdk.blockchain.ltc.ltcGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.ltc.ltcGenerateAddress(xpub, index))
        .address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    } else if (currency === "BSC") {
      const wallet = await tatumSdk.blockchain.bsc.bscGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.bsc.bscGenerateAddress(xpub, index))
        .address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    } else if (currency === "BCH") {
      const wallet = await tatumSdk.blockchain.bcash.bchGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (
        await tatumSdk.blockchain.bcash.bchGenerateAddress(xpub, index)
      ).address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    } else if (currency === "SOL") {
      // Solana: Non-HD — each wallet is a unique keypair
      const wallet = await tatumSdk.blockchain.solana.solanaGenerateWallet();
      address = wallet.address;
      privateKey = wallet.privateKey;
      mnemonic = "NON_HD";
      xpub = `NON_HD_SOL_${address.substring(0, 8)}`;
      cronLogger.info("SOL Address:", address);
    } else if (currency === "XRP") {
      // XRP: Non-HD — each wallet is account + secret
      const wallet = await tatumSdk.blockchain.xrp.xrpWallet();
      address = wallet.address;
      privateKey = wallet.secret;
      mnemonic = "NON_HD";
      xpub = `NON_HD_XRP_${address.substring(0, 8)}`;
      cronLogger.info("XRP Address:", address);
    } else if (currency === "POLYGON") {
      // Polygon: EVM-compatible, HD derivation like ETH
      const wallet = await tatumSdk.blockchain.polygon.polygonGenerateWallet();
      mnemonic = wallet.mnemonic;
      xpub = wallet.xpub;

      cronLogger.info("Mnemonic:", mnemonic);
      cronLogger.info("xPub:", xpub);

      const index = 0;
      address = (await tatumSdk.blockchain.polygon.polygonGenerateAddress(xpub, index))
        .address;
      cronLogger.info(`Derived Address [Index ${index}]:`, address);

      privateKey = (
        await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey({
          mnemonic,
          index: 0,
        })
      ).key;
      // SECURITY: Private keys must never be logged
      cronLogger.info(`Derived address for index ${index}`);
    }
    return {
      mnemonic,
      xpub,
      address,
      privateKey,
    };
  } catch (error) {
    cronLogger.error("Error in wallet generation and key derivation:", error);
  }
};

const generatePrivatekey = async (currency, index, mnemonic) => {
  let privateKey: PrivKey;
  const tatumSdk = await getTatumSDK();
  if (currency === "BTC") {
    privateKey = await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey(
      {
        mnemonic,
        index,
      }
    );
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "RLUSD-ERC20") {
    privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "TRX" || currency === "USDT-TRC20") {
    privateKey = await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "BSC") {
    privateKey = await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "DOGE") {
    privateKey = await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "LTC") {
    privateKey = await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "BCH") {
    privateKey = await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  } else if (currency === "SOL" || currency === "RLUSD" || currency === "XRP") {
    // Non-HD chains: mnemonic IS the private key (stored directly)
    return mnemonic;
  } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
    privateKey = await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey({
      mnemonic,
      index,
    });
  }
  return privateKey.key;
};

const createVirtualAccount = async ({
  currency,
  xpub,
  customerId,
}: virtualAccount) => {
  cronLogger.info(currency, xpub, customerId);
  try {
    const tatumSdk = await getTatumSDK();
    const account = await tatumSdk.ledger.account.createAccount({
      currency,
      xpub,
      accountingCurrency: "USD",
      customer: {
        externalId: customerId,
      },
    });

    return { account };
  } catch (error) {
    cronLogger.error("Error in wallet generation and key derivation:", error);
  }
};

const getAllAccounts = async () => {
  try {
    const tatumSdk = await getTatumSDK();
    const accounts = await tatumSdk.ledger.account.getAccounts();
    return { accounts };
  } catch (error) {
    cronLogger.error("Error in wallet generation and key derivation:", error);
  }
};

const generateUserAddress = async ({
  currency,
  xpub,
  mnemonic,
  index = 0,
}: IGenerateUserAddressParams): Promise<
  { address: string; privateKey: string } | undefined
> => {
  try {
    const tatumSdk = await getTatumSDK();
    let address;
    let privateKey;

    // Import ethers for deriving address from private key (testnet compatibility)
    const { ethers } = require('ethers');

    switch (currency) {
      case "BTC":
        address = await tatumSdk.blockchain.bitcoin.btcGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.bitcoin.btcGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "ETH":
      case "USDT-ERC20":
      case "USDC-ERC20":
      case "RLUSD-ERC20":
        // Generate private key first
        privateKey = await tatumSdk.blockchain.eth.ethGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        // CRITICAL FIX: For testnet compatibility, derive address directly from private key
        // This ensures address and private key always match, regardless of testnet/mainnet
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          cronLogger.info(`[generateUserAddress] Testnet: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.eth.ethGenerateAddress(xpub, index);
        }
        break;
      case "TRX":
      case "USDT-TRC20":
        address = await tatumSdk.blockchain.tron.tronGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.tron.tronGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "DOGE":
        address = await tatumSdk.blockchain.doge.dogeGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.doge.dogeGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "LTC":
        address = await tatumSdk.blockchain.ltc.ltcGenerateAddress(xpub, index);
        privateKey = await tatumSdk.blockchain.ltc.ltcGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        break;
      case "BSC":
        // Generate private key first for BSC too (same derivation as ETH)
        privateKey = await tatumSdk.blockchain.bsc.bscGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        // For testnet, derive address from private key
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          cronLogger.info(`[generateUserAddress] Testnet BSC: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.bsc.bscGenerateAddress(xpub, index);
        }
        break;
      case "BCH":
        address = await tatumSdk.blockchain.bcash.bchGenerateAddress(
          xpub,
          index
        );
        privateKey =
          await tatumSdk.blockchain.bcash.bchGenerateAddressPrivateKey({
            mnemonic,
            index,
          });
        break;
      case "SOL": {
        // Non-HD: generate fresh keypair for each address
        const solWallet = await tatumSdk.blockchain.solana.solanaGenerateWallet();
        return { address: solWallet.address, privateKey: solWallet.privateKey };
      }
      case "XRP":
      case "RLUSD": {
        // Non-HD: generate fresh XRP account for each address
        const xrpWallet = await tatumSdk.blockchain.xrp.xrpWallet();
        return { address: xrpWallet.address, privateKey: xrpWallet.secret };
      }
      case "POLYGON":
      case "USDT-POLYGON":
        // Generate private key first for Polygon (same derivation pattern as ETH)
        privateKey = await tatumSdk.blockchain.polygon.polygonGenerateAddressPrivateKey(
          { mnemonic, index }
        );
        
        if (isTestnet()) {
          const wallet = new ethers.Wallet(privateKey.key);
          address = { address: wallet.address };
          cronLogger.info(`[generateUserAddress] Testnet POLYGON: Derived address ${wallet.address} from private key`);
        } else {
          address = await tatumSdk.blockchain.polygon.polygonGenerateAddress(xpub, index);
        }
        break;
      default:
        throw new Error("Unsupported currency");
    }
    return { address: address.address, privateKey: privateKey.key };
  } catch (error) {
    cronLogger.error("Error in address generation:", error);
  }
};

const deleteUserAddress = async (customerID, address) => {
  try {
    const tatumSdk = await getTatumSDK();
    const resData = await tatumSdk.virtualAccount.account.removeAddress(
      customerID,
      address
    );

    return { resData };
  } catch (error) {
    cronLogger.error("Error in wallet generation and key derivation:", error);
  }
};

const createSubscription = async (address, currency, onlyCrypto = false) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20" || currency === "RLUSD-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOL"
        : currency;

    // Construct webhook URL properly
    const webhookPath = onlyCrypto ? "api/tatum-crypto-webhook" : "api/tatum-webhook";
    const url = buildUrl(webhookPath);
    
    cronLogger.info(`[createSubscription] Address: ${address}, Chain: ${chain}, Webhook URL: ${url}`);

    const { data } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );
    let resData = { id: null };

    if (data?.length > 0) {
      resData = { id: data[0]?.id };
      const existingUrl = data[0]?.attr?.url;
      
      // ALWAYS update webhook URL to ensure it matches current SERVER_URL
      // This fixes issues where subscription was created with old URL
      cronLogger.info(`[createSubscription] Existing subscription ${resData.id}, URL: ${existingUrl}`);
      if (existingUrl !== url) {
        cronLogger.info(`[createSubscription] Updating webhook URL from ${existingUrl} to ${url}`);
      }
      await axios.put(
        "https://api.tatum.io/v4/subscription/" + resData.id,
        { url },
        { headers }
      );
      cronLogger.info(`[createSubscription] Webhook URL updated for subscription ${resData.id}`);
    } else {
      const { data } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url,
          },
        },
        { headers }
      );
      cronLogger.info("[createSubscription] New Tatum subscription created:", data?.id);
      resData = data;
    }
    return resData;
  } catch (e) {
    const errorData = e?.response?.data;
    // Handle "subscription already exists" — extract existing subscription ID
    if (errorData?.errorCode === 'subscription.exists.on.address-and-currency') {
      const match = errorData.message?.match(/already exists \(([a-f0-9]+)\)/);
      if (match && match[1]) {
        cronLogger.info(`[createSubscription] Subscription already exists (${match[1]}), returning existing`);
        return { id: match[1] };
      }
    }
    cronLogger.info("[createSubscription] Tatum subscription error:", JSON.stringify(errorData || e.message, null, 2));
    throw e;
  }
};

/**
 * Create subscription with custom webhook URL (for multi-tenant company pools)
 * This allows each company to have its own webhook endpoint
 */
const createSubscriptionWithUrl = async (address: string, currency: string, customUrl: string) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOL"
        : currency;

    cronLogger.info(`[createSubscriptionWithUrl] Address: ${address}, Chain: ${chain}, URL: ${customUrl}`);

    // Check for existing subscription
    const { data: existingData } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );

    let resData = { id: null as string | null };

    if (existingData?.length > 0) {
      resData = { id: existingData[0]?.id };
      const existingUrl = existingData[0]?.attr?.url;
      
      cronLogger.info(`[createSubscriptionWithUrl] Existing subscription ${resData.id}, URL: ${existingUrl}`);
      
      // Update URL if different
      if (existingUrl !== customUrl) {
        cronLogger.info(`[createSubscriptionWithUrl] Updating URL: ${existingUrl} -> ${customUrl}`);
        await axios.put(
          "https://api.tatum.io/v4/subscription/" + resData.id,
          { url: customUrl },
          { headers }
        );
        cronLogger.info(`[createSubscriptionWithUrl] ✅ URL updated for subscription ${resData.id}`);
      }
    } else {
      // Create new subscription
      const { data: newData } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url: customUrl,
          },
        },
        { headers }
      );
      cronLogger.info(`[createSubscriptionWithUrl] ✅ New subscription created: ${newData?.id}`);
      resData = newData;
    }
    
    return resData;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    cronLogger.info("[createSubscriptionWithUrl] Error:", JSON.stringify(error.response?.data || error.message, null, 2));
    throw e;
  }
};

/**
 * BlockBee Style: Create subscription with company_id encoded in webhook URL
 * This enables multi-tenant routing without per-company backends
 * 
 * URL Format: https://SERVER_URL/api/tatum-crypto-webhook?company_id=38&address_id=5&user_id=28
 */
const createSubscriptionBlockBeeStyle = async (
  address: string, 
  currency: string, 
  companyId: number,
  userId: number,
  addressId: number
) => {
  try {
    const headers = await getTatumHeaders();

    const chain =
      currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20"
        ? "ETH"
        : currency === "USDT-TRC20"
        ? "TRON"
        : currency === "TRX"
        ? "TRON"
        : currency === "RLUSD"
        ? "XRP"
        : currency === "POLYGON" || currency === "USDT-POLYGON"
        ? "MATIC"
        : currency === "SOL"
        ? "SOLANA"
        : currency;

    // BlockBee Style: Encode company info in webhook URL
    const baseUrl = (process.env.SERVER_URL || '').replace(/\/$/, '');
    const webhookUrl = `${baseUrl}/api/tatum-crypto-webhook?company_id=${companyId}&user_id=${userId}&address_id=${addressId}`;
    
    cronLogger.info(`[createSubscriptionBlockBeeStyle] Address: ${address}, Chain: ${chain}`);
    cronLogger.info(`[createSubscriptionBlockBeeStyle] Webhook URL: ${webhookUrl}`);

    // Check for existing subscription
    const { data: existingData } = await axios.get(
      "https://api.tatum.io/v4/subscription?pageSize=10&address=" + address,
      { headers }
    );

    let resData = { id: null as string | null, url: webhookUrl };

    if (existingData?.length > 0) {
      resData.id = existingData[0]?.id;
      const existingUrl = existingData[0]?.attr?.url;
      
      cronLogger.info(`[createSubscriptionBlockBeeStyle] Existing subscription ${resData.id}`);
      cronLogger.info(`[createSubscriptionBlockBeeStyle] Current URL: ${existingUrl}`);
      
      // Always update URL to ensure company_id params are current
      if (existingUrl !== webhookUrl) {
        cronLogger.info(`[createSubscriptionBlockBeeStyle] Updating URL with new company info`);
        await axios.put(
          "https://api.tatum.io/v4/subscription/" + resData.id,
          { url: webhookUrl },
          { headers }
        );
        cronLogger.info(`[createSubscriptionBlockBeeStyle] ✅ URL updated`);
      }
    } else {
      // Create new subscription
      const { data: newData } = await axios.post(
        "https://api.tatum.io/v4/subscription",
        {
          type: "ADDRESS_EVENT",
          attr: {
            address,
            chain,
            url: webhookUrl,
          },
        },
        { headers }
      );
      cronLogger.info(`[createSubscriptionBlockBeeStyle] ✅ New subscription created: ${newData?.id}`);
      resData.id = newData?.id;
    }
    
    return resData;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    cronLogger.error("[createSubscriptionBlockBeeStyle] Error:", error.response?.data || error.message);
    throw e;
  }
};

const deleteSubscription = async (id: string | number | null): Promise<unknown> => {
  try {
    if (id) {
      const headers = await getTatumHeaders();
      const networkType = isTestnet() ? 'testnet' : 'mainnet';
      const resData = await axios.delete(
        `https://api.tatum.io/v4/subscription/${id}?type=${networkType}`,
        { headers }
      );
      cronLogger.info(resData.data);
      return resData.data;
    }
    return null;
  } catch (e: unknown) {
    cronLogger.info(e);
  }
};

/**
 * List all active subscriptions from Tatum
 * Cost: ~2 credits per call
 */
const listAllSubscriptions = async (): Promise<Array<Record<string, unknown>>> => {
  try {
    const headers = await getTatumHeaders();
    const allSubscriptions: Array<Record<string, unknown>> = [];
    let offset = 0;
    const pageSize = 50;
    
    // Paginate through all subscriptions
    while (true) {
      const { data } = await axios.get(
        `https://api.tatum.io/v4/subscription?pageSize=${pageSize}&offset=${offset}`,
        { headers }
      );
      
      if (!data || data.length === 0) break;
      
      allSubscriptions.push(...data);
      
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    
    return allSubscriptions;
  } catch (e: unknown) {
    const error = e as { response?: { data?: unknown }; message?: string };
    cronLogger.error("Failed to list subscriptions:", error.response?.data || error.message);
    throw e;
  }
};

const sendFeeToAdmin = async (userId: string, adminID: string, amount: number | string): Promise<string | undefined> => {
  try {
    const tatumSdk = await getTatumSDK();
    const resData = await tatumSdk.ledger.transaction.sendTransaction({
      amount: amount.toString(),
      recipientAccountId: adminID,
      senderAccountId: userId,
    });
    cronLogger.info(resData.reference);
    return resData.reference;
  } catch (e: unknown) {
    cronLogger.info(e);
  }
};

const getBitcoinAddress = async (address) => {
  try {
    const tatumSdk = await getTatumSDK();
    const data = await tatumSdk.blockchain.bitcoin.btcGetBalanceOfAddress(
      address
    );
    cronLogger.info(data);
  } catch (e) {
    cronLogger.info(e);
  }
};

const feeEstimation = async (
  currency,
  fromAddress,
  toAddress,
  amount,
  _contractAddress = "",
  bchInputs = 1
) => {
  // Chain-specific cache TTLs (seconds):
  // UTXO (BTC, LTC, DOGE, BCH): 60s (block times 1-10 min)
  // EVM (ETH, POLYGON): 15s (block time ~2-12s)
  // TRON: 30s (block time 3s, but energy prices change slowly)
  // SOL: 10s (block time 0.4s but priority fees change fast)
  // XRP/RLUSD: no caching (hardcoded, instant)
  const FEE_CACHE_TTLS: Record<string, number> = {
    BTC: 60, LTC: 60, DOGE: 60, BCH: 60,
    ETH: 15, 'USDT-ERC20': 15, 'USDC-ERC20': 15, 'RLUSD-ERC20': 15,
    POLYGON: 15, 'USDT-POLYGON': 15,
    TRX: 30, 'USDT-TRC20': 30,
    SOL: 10,
  };
  
  const cacheTTL = FEE_CACHE_TTLS[currency];
  if (cacheTTL) {
    const cacheKey = `fee-cache:${currency}`;
    try {
      const cached = await getRedisItem(cacheKey);
      if (cached) {
        cronLogger.info(`[feeEstimation] ⚡ Cache hit for ${currency}`);
        return JSON.parse(cached);
      }
    } catch (_cacheErr) {
      // Cache miss or error — proceed with live estimation
    }
  }

  let fees;
  const tatumSdk = await getTatumSDK();
  if (["BTC", "LTC", "DOGE"].indexOf(currency) !== -1) {
    fees = await tatumSdk.fee.estimateFeeBlockchain({
      chain: currency,
      type: "TRANSFER",
      fromAddress: [fromAddress],
      to: [{ address: toAddress, value: Number(amount) }],
    });

    // ── STUCK-TX GUARD (2026-07-17): BTC fee floor from mempool.space ────────────
    // Tatum's fee estimator has occasionally returned fees BELOW the current
    // network `hourFee`, causing settlement TXs to sit unconfirmed in the mempool
    // for hours/days. Concrete incident (2026-07-17): a $50 BTC settlement was
    // broadcast at 3.63 sat/vB when the network hourFee was 4 sat/vB — the tx
    // (d242834b676489eff…) remained unconfirmed 30+ min after broadcast and
    // could not be RBF-bumped (Tatum SDK does not signal RBF).
    //
    // Fix: query mempool.space's recommended fees and enforce a floor on
    // `fast`/`medium` so we always outbid the "hour" tier.
    if (currency === "BTC") {
      try {
        const mempoolRes = await axios.get(
          "https://mempool.space/api/v1/fees/recommended",
          { timeout: 5000 }
        );
        const halfHourFee: number = Number(mempoolRes?.data?.halfHourFee ?? 0);
        const hourFee: number = Number(mempoolRes?.data?.hourFee ?? 0);
        // Prefer halfHourFee (~30-min target); fall back to hourFee.
        const targetSatPerVB: number = halfHourFee > 0 ? halfHourFee : hourFee;
        if (targetSatPerVB > 0) {
          // Estimated worst-case vsize for a P2WPKH sweep (1-in, up to 2-out): ~200 vB.
          // Overestimating vsize is safe — it just adds a small fee cushion.
          const ESTIMATED_VSIZE = 200;
          const minFeeSats = Math.ceil(targetSatPerVB * ESTIMATED_VSIZE);
          const minFeeBtc = minFeeSats / 1e8;

          const tatumFastBtc = Number(fees?.fast ?? 0);
          const tatumMediumBtc = Number(fees?.medium ?? 0);
          if (tatumFastBtc < minFeeBtc) {
            cronLogger.warn(
              `[feeEstimation] 🚨 BTC Tatum fast=${tatumFastBtc} BTC (${Math.round(
                tatumFastBtc * 1e8
              )} sat) is BELOW mempool.space target ${targetSatPerVB} sat/vB × ${ESTIMATED_VSIZE} vB = ${minFeeSats} sat — flooring to ${minFeeBtc} BTC to prevent stuck settlement.`
            );
            (fees as { fast?: string | number }).fast = minFeeBtc.toFixed(8);
            if (tatumMediumBtc < minFeeBtc) {
              (fees as { medium?: string | number }).medium = minFeeBtc.toFixed(8);
            }
          } else {
            cronLogger.info(
              `[feeEstimation] BTC Tatum fast=${tatumFastBtc} BTC ≥ mempool.space floor ${minFeeBtc} BTC (${targetSatPerVB} sat/vB × ${ESTIMATED_VSIZE} vB) — using Tatum estimate.`
            );
          }
        }
      } catch (mempoolErr) {
        cronLogger.warn(
          `[feeEstimation] ⚠️ mempool.space fee lookup failed, using Tatum estimate as-is: ${(mempoolErr as Error).message}`
        );
      }
    }
  } else if (["ETH", "BSC", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20"].indexOf(currency) !== -1) {
    const isERC20 = currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20";
    const localAmount: number = Number(amount);
    // ERC-20 tokens (USDT/USDC/RLUSD) have 6 decimals; ETH has 18 — truncate to avoid BigNumber parse errors
    const decimals = isERC20 ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeEstimateAmount = (Math.floor(localAmount * factor) / factor).toString();
    if (isERC20) {
      cronLogger.info(`[getGasFee] ${currency} amount for gas estimation: ${localAmount} → truncated to ${decimals} decimals: ${safeEstimateAmount}`);
    }
    const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
      chain: isERC20 ? "ETH" : currency,
      type: isERC20 ? "TRANSFER_ERC20" : "TRANSFER_NFT",
      sender: fromAddress,
      ...(isERC20 && {
        contractAddress: currency === "USDC-ERC20" ? process.env.USDC_CONTRACT
          : currency === "RLUSD-ERC20" ? process.env.RLUSD_ERC20_CONTRACT
          : process.env.ETH_CONTRACT,
      }),
      recipient: toAddress,
      amount: safeEstimateAmount,
    })) as FeeEvmBased;

    cronLogger.info(gasFees);

    // Use EVM chain strategy utility for gas fee calculation
    const { calculateEvmGasFee } = require('../services/chains/evmChain');
    const isPolygon = ["POLYGON", "USDT-POLYGON"].includes(currency);
    fees = calculateEvmGasFee(gasFees?.gasPrice || 1, gasFees?.gasLimit || 21000, isERC20, {
      minGas: isPolygon ? 25 : 1,
      maxGas: isPolygon ? 1000 : 50,
    });
    const usedGasPrice = fees.gasPrice;
    cronLogger.info(`[EVM Gas] ⛽ Price: raw=${Math.ceil(gasFees?.gasPrice || 1)}, capped=${usedGasPrice}, chain=${currency}`);
  } else if (currency === "BCH") {
    const headers = await getTatumHeaders();
    const {
      data: { result },
    } = await axios.post(
      "https://api.tatum.io/v3/blockchain/node/BCH",
      {
        jsonrpc: "1.0",
        id: "1",
        method: "estimatefee",
        params: [],
      },
      { headers }
    );
    // Use UTXO chain strategy utility for byte calculation
    const { calculateUtxoTxSizeKb } = require('../services/chains/utxoChain');
    const bytes = calculateUtxoTxSizeKb(bchInputs, 2);
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result * 1.2).toFixed(8), // 20% buffer on fast tier
    };
  } else if (currency === "TRX") {
    // Dynamic TRX native fee: free with bandwidth, ~0.3 TRX otherwise (was hardcoded 10)
    try {
      const trxFee = await calculateDynamicTRXNativeFee(fromAddress);
      logCostSavings("feeEstimation-TRX", 10, trxFee.fast, { bandwidthFree: trxFee.bandwidthFree });
      fees = {
        fast: trxFee.fast,
        medium: trxFee.medium,
        slow: trxFee.slow,
      };
    } catch (_trxFeeError) {
      cronLogger.warn(`[feeEstimation] ⚠️ Dynamic TRX fee failed, using fallback 1 TRX`);
      fees = { fast: 1, medium: 1, slow: 1 };
    }
  } else if (currency === "USDT-TRC20") {
    // Dynamic TRC20 fee calculation using live TRON Energy price
    // Post Proposal #104 (Aug 2025): Energy reduced from 420 → 100 SUN/unit
    try {
      // FIX: Pass recipient (toAddress) and TRC20 contract so the energy estimation
      // can check if the admin wallet is already ACTIVATED (65k energy) vs NEW (130k).
      // Previously only passed fromAddress, causing it to always assume 130k energy
      // and making sweeps appear unprofitable (16.1 TRX gas vs actual ~8 TRX).
      const trc20Contract = process.env.TRX_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      const dynamicFee = await calculateDynamicTRC20Fee(fromAddress, toAddress, trc20Contract);
      logCostSavings("feeEstimation", 20, dynamicFee.fast, {
        energyPrice: dynamicFee.energyPrice,
        energyAvailable: dynamicFee.energyAvailable,
        sender: fromAddress,
      });
      fees = {
        fast: dynamicFee.fast,
      };
    } catch (feeCalcError) {
      cronLogger.warn(`[feeEstimation] ⚠️ Dynamic TRC20 fee failed, using fallback 14 TRX:`, feeCalcError);
      // Fallback: 65k energy × 100 SUN + bandwidth ≈ 7 TRX, with buffer ≈ 14 TRX
      fees = {
        fast: 14,
      };
    }
  } else if (currency === "SOL") {
    // Solana: base fee is 5000 lamports (0.000005 SOL) per signature
    // During congestion, priority fees can spike — query network for current fees
    try {
      const headers = await getTatumHeaders();
      const { data: feeResult } = await axios.post(
        "https://api.tatum.io/v3/blockchain/node/SOL",
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getRecentPrioritizationFees",
          params: [],
        },
        { headers }
      );
      // Get the median priority fee from recent slots (in micro-lamports per compute unit)
      const recentFees: Array<{ prioritizationFee: number }> = feeResult?.result || [];
      const nonZeroFees = recentFees.filter(f => f.prioritizationFee > 0).map(f => f.prioritizationFee);
      
      if (nonZeroFees.length > 0) {
        nonZeroFees.sort((a, b) => a - b);
        const medianPriorityFee = nonZeroFees[Math.floor(nonZeroFees.length / 2)];
        // Use SOL chain strategy utility for priority fee calculation
        const { calculateSolPriorityFee, SOL_FEE_CONSTANTS } = require('../services/chains/solChain');
        const priorityFeeSol = calculateSolPriorityFee(medianPriorityFee);
        const baseFee = SOL_FEE_CONSTANTS.BASE_FEE_SOL;
        const totalFast = baseFee + priorityFeeSol * 2; // 2x median for fast
        const totalMedium = baseFee + priorityFeeSol;
        
        cronLogger.info(`[feeEstimation] SOL dynamic: base=0.000005, priorityMedian=${medianPriorityFee} µ-lamports/CU, fast=${totalFast.toFixed(9)}, medium=${totalMedium.toFixed(9)}`);
        fees = {
          fast: Math.max(totalFast, 0.00001),    // Floor at 10k lamports
          medium: Math.max(totalMedium, 0.000005), // Floor at base fee
          slow: 0.000005,                          // Base fee only
        };
      } else {
        // No priority fees in recent slots — network is quiet
        fees = { fast: 0.00001, medium: 0.000005, slow: 0.000005 };
      }
    } catch (_solFeeError) {
      cronLogger.warn(`[feeEstimation] ⚠️ SOL dynamic fee query failed, using fallback`);
      fees = { fast: 0.00001, medium: 0.000005, slow: 0.000005 };
    }
  } else if (currency === "XRP") {
    // XRP: very low fees — use XRP chain strategy constants
    const { XRP_FEE_CONSTANTS } = require('../services/chains/xrpChain');
    fees = { fast: XRP_FEE_CONSTANTS.FAST_FEE_XRP, medium: XRP_FEE_CONSTANTS.BASE_FEE_XRP, slow: XRP_FEE_CONSTANTS.BASE_FEE_XRP };
  } else if (currency === "RLUSD") {
    // RLUSD on XRP Ledger: fee in XRP
    const { XRP_FEE_CONSTANTS: xrpConst } = require('../services/chains/xrpChain');
    fees = { fast: xrpConst.FAST_FEE_XRP };
  } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
    // Polygon: EVM-compatible fee estimation
    // Use TRANSFER_ERC20 type for gas price estimation (gas price is network-level, same for all tx types)
    // The gas LIMIT differs: native POL = 21,000, ERC20 token = ~65,000
    const isToken = currency === "USDT-POLYGON";
    const localAmount: number = Number(amount);
    const decimals = isToken ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeEstimateAmount = (Math.floor(localAmount * factor) / factor).toString();
    try {
      // Get gas price from both Tatum SDK and RPC, use the higher one
      // Use withSdkFallback for Polygon gas estimation (SDK + RPC)
      const sdkGasCall = async (): Promise<{ gasPrice: number; gasLimit: number }> => {
        const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
          chain: "MATIC",
          type: "TRANSFER_ERC20",
          sender: fromAddress,
          ...(isToken && {
            contractAddress: process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
          }),
          recipient: toAddress,
          amount: safeEstimateAmount,
        })) as FeeEvmBased;
        return {
          gasPrice: Math.ceil(gasFees?.gasPrice || 30),
          gasLimit: isToken ? (gasFees?.gasLimit || 65000) : 21000,
        };
      };

      const { gasPrice: sdkGasPriceResult, gasLimit: sdkGasLimitResult } = await withSdkFallback(
        sdkGasCall,
        null,
        { operation: 'estimateFee', chain: 'POLYGON', address: fromAddress }
      ).catch(() => ({ gasPrice: 30, gasLimit: isToken ? 65000 : 21000 }));
      
      let sdkGasPrice = sdkGasPriceResult;
      const sdkGasLimit = sdkGasLimitResult;

      // RPC fallback: Polygon gas prices are volatile (30-800+ Gwei), SDK often returns stale data
      let rpcGasPrice = sdkGasPrice;
      try {
        const rpcResp = await axios.post(
          `https://api.tatum.io/v3/polygon/web3/${process.env.TATUM_KEY}`,
          { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 },
          { headers: { "x-api-key": process.env.TATUM_KEY }, timeout: 5000 }
        );
        if (rpcResp.data?.result) {
          rpcGasPrice = Math.ceil(parseInt(rpcResp.data.result, 16) / 1e9);
        }
      } catch (_rpcErr) {
        cronLogger.warn(`[feeEstimation] ⚠️ Polygon RPC gas price failed, using SDK value`);
      }

      // Use Polygon chain strategy utility for fee calculation
      const { calculatePolygonGasFee } = require('../services/chains/polygonChain');
      const rawGasPrice = Math.max(sdkGasPrice, rpcGasPrice);
      cronLogger.info(`[Polygon Gas] ⛽ SDK=${sdkGasPrice}, RPC=${rpcGasPrice}, used=${rawGasPrice} Gwei`);
      
      fees = calculatePolygonGasFee(rawGasPrice, isToken, sdkGasLimit);
    } catch (_polyFeeError) {
      cronLogger.warn(`[feeEstimation] ⚠️ Polygon fee estimation failed entirely, using fallback`);
      fees = { fast: isToken ? 0.05 : 0.005, gasPrice: 100, gasLimit: isToken ? 65000 : 21000 };
    }
  }

  // Cache the result for subsequent calls
  if (fees && cacheTTL) {
    try {
      await setRedisItemWithTTL(`fee-cache:${currency}`, JSON.stringify(fees), cacheTTL);
    } catch (_cacheWriteErr) {
      // Non-critical — proceed without caching
    }
  }

  return fees;
};

const batchFeeEstimation = async ({
  currency,
  fromAddresses,
  toAddresses,
  amount,
  _contractAddress = "",
  bchInputs = 1,
  totalAddress,
}) => {
  let fees;

  const tatumSdk = await getTatumSDK();
  // Handled Batch Transactions
  if (["BTC", "LTC", "DOGE"].indexOf(currency) !== -1) {
    cronLogger.info("###IF 1 BTC OR 1 LTC OR 1 DOGE###");
    cronLogger.info("###Payloads-->", {
      chain: currency,
      type: "TRANSFER",
      fromAddress: fromAddresses.map((address) => address.address),
      to: toAddresses.map((address) => ({
        ...address,
        value: Number(address.value),
      })),
    });
    fees = await tatumSdk.fee.estimateFeeBlockchain({
      chain: currency,
      type: "TRANSFER",
      fromAddress: fromAddresses.map((address) => address.address),
      to: toAddresses.map((address) => ({
        ...address,
        value: Number(address.value),
      })),
    });
    cronLogger.info("###BTC FEES--->", fees);
  } else if (["ETH", "BSC", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"].indexOf(currency) !== -1) {
    const isERC20 = ["USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-POLYGON"].includes(currency);
    const chainId = ["POLYGON", "USDT-POLYGON"].includes(currency) ? "MATIC" : (isERC20 ? "ETH" : currency);
    // Handle Multiple Transactions
    const gasFeesArray = await Promise.all(
      fromAddresses.map(async (fromAddress) => {
        // ERC-20 tokens (USDT/USDC/RLUSD) have 6 decimals — truncate to avoid BigNumber parse errors
        const sweepDecimals = isERC20 ? 6 : 8;
        const sweepFactor = Math.pow(10, sweepDecimals);
        const safeSweepAmount = (Math.floor(Number(amount) * sweepFactor) / sweepFactor).toString();
        const gasFees = (await tatumSdk.fee.estimateFeeBlockchain({
          chain: chainId,
          type: isERC20 ? "TRANSFER_ERC20" : "TRANSFER_NFT",
          sender: fromAddress.address,
          ...(isERC20 && {
            contractAddress: currency === "USDC-ERC20" ? process.env.USDC_CONTRACT 
              : currency === "RLUSD-ERC20" ? process.env.RLUSD_ERC20_CONTRACT
              : currency === "USDT-POLYGON" ? (process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F")
              : process.env.ETH_CONTRACT,
          }),
          recipient: toAddresses[0].address,
          amount: safeSweepAmount,
        })) as FeeEvmBased;

        return gasFees;
      })
    );

    const gasFees = gasFeesArray.reduce(
      (acc, gasFee) => {
        acc.gasPrice = Math.max(acc.gasPrice, gasFee.gasPrice);
        acc.gasLimit = Math.max(acc.gasLimit, gasFee.gasLimit);
        return acc;
      },
      { gasPrice: 0, gasLimit: 0 }
    );

    cronLogger.info({ gasFees });

    // Chain-specific gas cap — Polygon needs higher cap than ETH
    const isPolygonBatch = ["POLYGON", "USDT-POLYGON"].includes(currency);
    
    // For Polygon: also check RPC gas price since SDK can be stale
    let rpcGasPrice = 0;
    if (isPolygonBatch) {
      try {
        const rpcResp = await axios.post(
          `https://api.tatum.io/v3/polygon/web3/${process.env.TATUM_KEY}`,
          { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 1 },
          { headers: { "x-api-key": process.env.TATUM_KEY }, timeout: 5000 }
        );
        if (rpcResp.data?.result) {
          rpcGasPrice = Math.ceil(parseInt(rpcResp.data.result, 16) / 1e9);
        }
      } catch (_rpcErr) { /* use SDK value */ }
    }
    
    const maxBatchGas = isPolygonBatch ? 1500 : 50;
    const rawBatchGas = Math.max(gasFees?.gasPrice || 1, rpcGasPrice);
    let gasPrice = Math.max(isPolygonBatch ? 25 : 1, Math.min(maxBatchGas, rawBatchGas));
    // Percentage-based buffer: 10% + 0.5 Gwei priority tip (was flat +1 Gwei)
    const batchGasBuffer = Math.ceil(gasPrice * 1.1 + 0.5);
    cronLogger.info(`[EVM Gas] ⛽ Batch price: SDK=${gasFees?.gasPrice}, RPC=${rpcGasPrice}, used=${gasPrice}, buffered=${batchGasBuffer} Gwei (chain=${currency}, max=${maxBatchGas})`);

    fees = {
      fast: Number(
        Number(((batchGasBuffer) * gasFees?.gasLimit) / 1000000000) * totalAddress
      ).toFixed(8),
      ...(!isERC20 && {
        medium: Number(
          Number(
            ((batchGasBuffer) * ((gasFees?.gasLimit * 50) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
        slow: Number(
          Number(
            ((batchGasBuffer) * ((gasFees?.gasLimit * 25) / 100)) / 1000000000
          ) * totalAddress
        ).toFixed(8),
      }),
      gasPrice,
      gasLimit: isERC20
          ? gasFees.gasLimit
          : Math.floor((gasFees?.gasLimit * 25) / 100),
    };
  } else if (currency === "BCH") {
    const headers = await getTatumHeaders();
    const {
      data: { result },
    } = await axios.post(
      "https://api.tatum.io/v3/blockchain/node/BCH",
      {
        jsonrpc: "1.0",
        id: "1",
        method: "estimatefee",
        params: [],
      },
      { headers }
    );
    const bytes = ((bchInputs + 1) * 148 + 2 * 34 + 10) / 1000;
    fees = {
      slow: (bytes * result).toFixed(8),
      medium: (bytes * result).toFixed(8),
      fast: (bytes * result).toFixed(8),
    };
  } else if (currency === "TRX") {
    // Dynamic TRX native batch fee: free with bandwidth, ~0.3 TRX/tx otherwise (was 3.5/tx)
    try {
      const trxFee = await calculateDynamicTRXNativeFee();
      const perAddressFee = trxFee.fast || 0.5;
      logCostSavings("batchFeeEstimation-TRX", totalAddress * 3.5, totalAddress * perAddressFee, { totalAddress });
      fees = {
        fast: totalAddress * perAddressFee,
        medium: totalAddress * perAddressFee,
        slow: totalAddress * perAddressFee,
      };
    } catch (_trxBatchError) {
      fees = { fast: totalAddress * 0.5, medium: totalAddress * 0.5, slow: totalAddress * 0.5 };
    }
  } else if (currency === "USDT-TRC20") {
    // Dynamic batch TRC20 fee using live TRON Energy price
    try {
      const dynamicFee = await calculateDynamicTRC20Fee();
      const batchFee = dynamicFee.fast * (totalAddress || 1);
      logCostSavings("batchFeeEstimation", 20, batchFee, { totalAddress });
      fees = {
        fast: batchFee,
      };
    } catch (_batchFeeError) {
      cronLogger.warn(`[batchFeeEstimation] ⚠️ Dynamic TRC20 fee failed, using fallback`);
      fees = {
        fast: 14 * (totalAddress || 1),
      };
    }
  }
  return fees;
};

const assetToOtherAddress = async ({
  currency,
  fromAddress,
  toAddress,
  privateKey,
  amount,
  fee,
  _contractAddress = null,
  fromMaster = false,
  fromUTXO = [],
  toUTXO = [],
  destinationTag = null,
}) => {
  let transaction;
  const tatumSdk = await getTatumSDK();
  // Safe rounding to N decimal places using integer arithmetic (avoids floating-point serialization issues)
  // CRITICAL: Uses Math.round (NOT Math.floor) to prevent off-by-one satoshi errors.
  // Math.floor truncates DOWN, which can lose 1 sat when JS floating-point represents
  // e.g. 34338/1e8 as 0.000343379999... → floor gives 34337 sats instead of 34338.
  const truncateDecimals = (n: number, places: number = 8): number => {
    const factor = Math.pow(10, places);
    return Math.round(n * factor) / factor;
  };
  if (currency === "BTC") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const btcOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: truncateDecimals(Number(o.value)) }))
      : [{ address: toAddress, value: truncateDecimals(Number(amount)) }];
    // UTXO chains: fee should be a simple string, not the full {slow,medium,fast} object
    const btcFee = typeof fee === 'object' && fee !== null
      ? (fee.slow || fee.medium || fee.fast || "0.00005")
      : fee;
    const btcFeeStr = typeof btcFee === 'string' ? btcFee : String(Number(btcFee).toFixed(8));
    transaction = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: btcOutputs,
      fee: btcFeeStr,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
    // DEPRECATION WARNING: For sweep operations, use directEvmSweep() from directEvmTransfer.ts instead.
    // This Tatum SDK path is retained only for non-sweep operations (merchant payouts, admin transfers).
    // Tatum SDK's ethBlockchainTransfer has known ghost TX issues — never use for sweep/pool operations.
    cronLogger.warn(`[assetToOtherAddress] ⚠️ DEPRECATION: Using Tatum SDK for ${currency} transfer. For sweeps, use directEvmSweep().`);
    // USDT/USDC ERC-20 have 6 decimals; ETH has 18 — truncate accordingly
    const isERC20Token = currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20";
    const decimals = isERC20Token ? 6 : 8;
    const factor = Math.pow(10, decimals);
    const safeAmount = (Math.floor(Number(amount) * factor) / factor).toString();
    if (isERC20Token) {
      cronLogger.info(`[assetToOtherAddress] ${currency} amount: ${amount} → truncated to ${decimals} decimals: ${safeAmount}`);
    }
    if (currency === "RLUSD-ERC20") {
      // RLUSD is a custom ERC-20 not in Tatum's predefined list — use generic erc20Transfer
      transaction = await tatumSdk.fungibleToken.erc20Transfer({
        chain: "ETH",
        to: toAddress,
        contractAddress: process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
        amount: safeAmount,
        digits: 6,
        fromPrivateKey: privateKey,
        fee: {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: fee?.gasLimit.toString(),
        },
      });
    } else {
      transaction = await tatumSdk.blockchain.eth.ethBlockchainTransfer({
        fromPrivateKey: privateKey,
        to: toAddress,
        amount: safeAmount,
        fee: {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: fee?.gasLimit.toString(),
        },
        currency: currency === "ETH" ? "ETH" : (currency === "USDC-ERC20" ? "USDC" : "USDT"),
      });
    }
  } else if (currency === "TRX") {
    transaction = await tatumSdk.blockchain.tron.tronTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
    });
  } else if (currency === "USDT-TRC20") {
    // USDT TRC-20 has 6 decimals — truncate (not round) to avoid "callback is not defined" Tatum error
    const truncatedAmount = (Math.floor(Number(amount) * 1e6) / 1e6).toString();
    cronLogger.info(`[assetToOtherAddress] USDT-TRC20 amount: ${amount} → truncated to 6 decimals: ${truncatedAmount}`);

    // Dynamic feeLimit based on sender's Energy & current network price
    let optimalFeeLimit = 15; // Default fallback (was hardcoded 50)
    try {
      const feeLimitResult = await calculateOptimalFeeLimit(
        fromAddress,
        toAddress,
        process.env.TRX_CONTRACT
      );
      optimalFeeLimit = feeLimitResult.feeLimit;
      
      // ── FIX: Align feeLimit with SmartGas estimation to prevent OUT_OF_ENERGY ──
      // SmartGas funds gas based on recipient-aware energy estimation,
      // but calculateOptimalFeeLimit may disagree on activation status.
      // FIX (2026-04-07): Pass recipientAddress + tokenContract to get consistent
      // activation check. Also take MAX of both estimates as safety margin.
      try {
        const { calculateDynamicTRC20Fee } = require("../services/tronEnergyService");
        const trc20Contract = process.env.TRX_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
        const smartGasEstimate = await calculateDynamicTRC20Fee(fromAddress, toAddress, trc20Contract);
        if (optimalFeeLimit < smartGasEstimate.fast) {
          cronLogger.info(`[assetToOtherAddress] 🔒 Aligning feeLimit: ${optimalFeeLimit} TRX → ${smartGasEstimate.fast} TRX (SmartGas estimate). Prevents OUT_OF_ENERGY mismatch.`);
          optimalFeeLimit = Math.min(smartGasEstimate.fast, 30); // Cap at 30 TRX max
        }
      } catch (_alignErr) { /* Non-critical, proceed with original feeLimit */ }
      
      logCostSavings("assetToOtherAddress", 50, optimalFeeLimit, {
        energyDeficit: feeLimitResult.energyDeficit,
        isNewRecipient: feeLimitResult.isNewRecipient,
      });
    } catch (feeLimitError) {
      cronLogger.warn(`[assetToOtherAddress] ⚠️ Dynamic feeLimit failed, using fallback ${optimalFeeLimit} TRX`);
    }

    transaction = await tatumSdk.blockchain.tron.tronTransferTrc20({
      amount: truncatedAmount,
      feeLimit: optimalFeeLimit,
      fromPrivateKey: privateKey,
      to: toAddress,
      tokenAddress: process.env.TRX_CONTRACT,
    });
  } else if (currency === "BSC") {
    cronLogger.warn(`[assetToOtherAddress] ⚠️ DEPRECATION: Using Tatum SDK for BSC transfer. For sweeps, use directEvmSweep().`);
    transaction = await tatumSdk.blockchain.bsc.bscBlockchainTransfer({
      currency,
      amount: Number(amount).toFixed(8).toString(),
      fromPrivateKey: privateKey,
      to: toAddress,
      fee: {
        gasPrice: Math.ceil(fee?.gasPrice).toString(),
        gasLimit: fee?.gasLimit.toString(),
      },
    });
  } else if (currency === "DOGE") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const dogeOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: truncateDecimals(Number(o.value)) }))
      : [{ address: toAddress, value: truncateDecimals(Number(amount)) }];
    // UTXO chains: fee should be a simple string, not the full {slow,medium,fast} object
    const dogeFee = typeof fee === 'object' && fee !== null
      ? (fee.slow || fee.medium || fee.fast || "0.00100")
      : fee;
    const dogeFeeStr = typeof dogeFee === 'string' ? dogeFee : String(Number(dogeFee).toFixed(8));
    transaction = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: dogeOutputs,
      fee: dogeFeeStr,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "LTC") {
    // When toUTXO is provided (merchant + admin split), use multi-output; otherwise single output
    const ltcOutputs = toUTXO.length > 0
      ? toUTXO.map((o: any) => ({ address: o.address, value: truncateDecimals(Number(o.value)) }))
      : [{ address: toAddress, value: truncateDecimals(Number(amount)) }];
    // UTXO chains: fee should be a simple string like "0.00002446", not the full {slow,medium,fast} object
    const ltcFee = typeof fee === 'object' && fee !== null
      ? (fee.slow || fee.medium || fee.fast || "0.00005")
      : fee;
    // Ensure max 8 decimal places
    const ltcFeeStr = typeof ltcFee === 'string' ? ltcFee : String(Number(ltcFee).toFixed(8));
    cronLogger.info(`[assetToOtherAddress] LTC fee: ${JSON.stringify(fee)} → resolved: ${ltcFeeStr}`);
    transaction = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
      fromAddress: [{ address: fromAddress, privateKey }],
      to: ltcOutputs,
      fee: ltcFeeStr,
      changeAddress: toUTXO.length > 0 ? fromAddress : (fromMaster ? fromAddress : toAddress),
    });
  } else if (currency === "BCH") {
    // Normalize ALL BCH addresses to CashAddr format (bitcoincash:q...)
    // Legacy addresses (starting with 1 or 3) cause Tatum validation errors
    const toCashAddr = (addr: string): string => {
      if (!addr) return addr;
      try {
        return bchaddr.toCashAddress(addr);
      } catch {
        // Already in CashAddr or invalid — return as-is
        return addr.startsWith('bitcoincash:') ? addr : `bitcoincash:${addr}`;
      }
    };
    const normalizedFromUTXO = fromUTXO.map((u: any) => ({ ...u }));
    const normalizedToUTXO = toUTXO.map((o: any) => ({
      ...o,
      address: toCashAddr(o.address),
    }));
    const bchChangeAddress = toCashAddr(fromAddress || toAddress);
    // UTXO chains: fee should be a simple string, not the full {slow,medium,fast} object
    const bchFee = fee == null ? "0.00001"
      : typeof fee === 'object' && fee !== null
        ? (fee.slow || fee.medium || fee.fast || "0.00001")
        : fee;
    const bchFeeStr = typeof bchFee === 'string' ? bchFee : String(Number(bchFee).toFixed(8));
    cronLogger.info(`[assetToOtherAddress] BCH: changeAddress=${bchChangeAddress}, fee=${bchFeeStr}, fromUTXO=${normalizedFromUTXO.length}, toUTXO=${normalizedToUTXO.length}, toAddr=${normalizedToUTXO[0]?.address}`);
    // Try without fee+changeAddress first (let Tatum auto-calculate)
    // If that fails with dust, provide both
    transaction = await tatumSdk.blockchain.bcash.bchTransferBlockchain({
      fromUTXO: normalizedFromUTXO,
      to: normalizedToUTXO,
    });
  } else if (currency === "SOL") {
    // Solana native transfer
    transaction = await tatumSdk.blockchain.solana.solanaBlockchainTransfer({
      from: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(9).toString(),
      fromPrivateKey: privateKey,
    });
  } else if (currency === "XRP") {
    // XRP native transfer
    // Destination tag priority: 1) explicit parameter (merchant tag), 2) admin tag if sending to admin wallet
    const adminXrpWallet = process.env.XRP || "";
    const adminDestTag = process.env.XRP_ADMIN_DESTINATION_TAG ? Number(process.env.XRP_ADMIN_DESTINATION_TAG) : undefined;
    const resolvedDestTag = destinationTag 
      ? Number(destinationTag) 
      : (toAddress === adminXrpWallet && adminDestTag) ? adminDestTag : undefined;
    
    if (resolvedDestTag) {
      cronLogger.info(`[assetToOtherAddress] XRP transfer with destination tag: ${resolvedDestTag}`);
    }
    
    transaction = await tatumSdk.blockchain.xrp.xrpTransferBlockchain({
      fromAccount: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(6).toString(),
      fromSecret: privateKey,
      ...(resolvedDestTag !== undefined && { destinationTag: resolvedDestTag }),
    } as any);
  } else if (currency === "RLUSD") {
    // RLUSD token transfer on XRP Ledger
    // Destination tag priority: 1) explicit parameter (merchant tag), 2) admin tag if sending to admin wallet
    const adminXrpWallet = process.env.XRP || "";
    const adminDestTag = process.env.XRP_ADMIN_DESTINATION_TAG ? Number(process.env.XRP_ADMIN_DESTINATION_TAG) : undefined;
    const resolvedDestTag = destinationTag 
      ? Number(destinationTag) 
      : (toAddress === adminXrpWallet && adminDestTag) ? adminDestTag : undefined;
    
    if (resolvedDestTag) {
      cronLogger.info(`[assetToOtherAddress] RLUSD transfer with destination tag: ${resolvedDestTag}`);
    }
    
    const rlusdIssuer = process.env.RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
    const rlusdCurrencyHex = process.env.RLUSD_CURRENCY_HEX || "524C555344000000000000000000000000000000";
    transaction = await tatumSdk.blockchain.xrp.xrpTransferBlockchain({
      fromAccount: fromAddress,
      to: toAddress,
      amount: Number(amount).toFixed(6).toString(),
      fromSecret: privateKey,
      issuerAccount: rlusdIssuer,
      token: rlusdCurrencyHex,
      ...(resolvedDestTag !== undefined && { destinationTag: resolvedDestTag }),
    } as any);
  } else if (currency === "POLYGON") {
    // DEPRECATION WARNING: For sweep operations, use directEvmSweep() from directEvmTransfer.ts instead.
    cronLogger.warn(`[assetToOtherAddress] ⚠️ DEPRECATION: Using Tatum SDK for POLYGON transfer. For sweeps, use directEvmSweep().`);
    // Polygon native transfer (POL)
    transaction = await tatumSdk.blockchain.polygon.polygonBlockchainTransfer({
      fromPrivateKey: privateKey,
      to: toAddress,
      amount: Number(amount).toFixed(8).toString(),
      currency: "MATIC",
      fee: fee ? {
        gasPrice: Math.ceil(fee?.gasPrice).toString(),
        gasLimit: fee?.gasLimit.toString(),
      } : undefined,
    });
  } else if (currency === "USDT-POLYGON") {
    cronLogger.warn(`[assetToOtherAddress] ⚠️ DEPRECATION: Using Tatum SDK for USDT-POLYGON transfer. For sweeps, use directEvmSweep().`);
    // USDT on Polygon — use contract-address-based smart contract invocation
    // This is more reliable than currency-name-based transfer (no dependency on SDK naming)
    const usdtPolygonContract = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    const truncatedAmount = (Math.floor(Number(amount) * 1e6) / 1e6).toString();
    // USDT on Polygon has 6 decimals
    const amountInSmallestUnit = String(Math.floor(Number(truncatedAmount) * 1e6));
    
    try {
      transaction = await tatumSdk.blockchain.polygon.polygonBlockchainSmartContractInvocation({
        fromPrivateKey: privateKey,
        contractAddress: usdtPolygonContract,
        methodName: "transfer",
        methodABI: {
          inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "transfer",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        params: [toAddress, amountInSmallestUnit],
        fee: fee ? {
          gasPrice: Math.ceil(fee?.gasPrice).toString(),
          gasLimit: (fee?.gasLimit || 65000).toString(),
        } : undefined,
      });
    } catch (polyTokenErr) {
      cronLogger.error(`[assetToOtherAddress] USDT-POLYGON transfer failed:`, polyTokenErr?.message);
      throw polyTokenErr;
    }
  }
  return transaction;
};

const assetBatchAddressesToOtherAddress = async ({
  currency,
  fromAddress,
  toAddress,
  fee,
  _contractAddress = null,
  permanentUserWalletAddress = null,
  fromUTXO = [],
  toUTXO = [],
}) => {
  let transactions = [];
  const tatumSdk = await getTatumSDK();

  const destinationAddress = toAddress[0].address;

  if (currency === "BTC") {
    cronLogger.info("#######BTC PAYLOAD ####", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });

    // Send assets to address and handle extra assets in user's paremanent address
    const result = await tatumSdk.blockchain.bitcoin.btcTransferBlockchain(
      {
        fromAddress: fromAddress.map((address) => ({
          address: address.address,
          privateKey: address.privateKey,
        })),
        to: toAddress.map((address) => ({
          ...address,
          value: Number(Number(address.value).toFixed(8)),
        })),
        fee,
        changeAddress: permanentUserWalletAddress
          ? permanentUserWalletAddress
          : destinationAddress,
      }
    );
    cronLogger.info("###result", result);
    const txId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: txId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
    cronLogger.info("###transactions", transactions);
  } else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          cronLogger.info("####ETH Paylaod:", {
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
            fee: {
              gasPrice: Math.ceil(fee?.gasPrice).toString(),
              gasLimit: fee?.gasLimit.toString(),
            },
            currency: currency,
          });
          let result;
          if (currency === "RLUSD-ERC20") {
            // RLUSD is a custom ERC-20 — use generic erc20Transfer with contract address
            result = await tatumSdk.fungibleToken.erc20Transfer({
              chain: "ETH",
              to: destinationAddress,
              contractAddress: process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
              amount: (Math.floor(Number(fromAddr.value) * 1e6) / 1e6).toString(),
              digits: 6,
              fromPrivateKey: fromAddr.privateKey,
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
            });
          } else {
            result = await tatumSdk.blockchain.eth.ethBlockchainTransfer({
              fromPrivateKey: fromAddr.privateKey,
              to: destinationAddress,
              amount: Number(fromAddr.value).toFixed(8).toString(),
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
              currency: currency === "ETH" ? "ETH" : "USDT",
            });
          }
          const ethTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: ethTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          cronLogger.info("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "TRX") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          cronLogger.info("###TRX PAYLOAD: ", {
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          const result = await tatumSdk.blockchain.tron.tronTransfer({
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            amount: Number(fromAddr.value).toFixed(8).toString(),
          });
          cronLogger.info("###result", result);
          const ethTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: ethTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          cronLogger.info("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    cronLogger.info("###transactionResponse", transactionResponse);
    transactions = transactionResponse;
  } else if (currency === "USDT-TRC20") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];

    // Calculate dynamic feeLimit once for the batch (destination is the same)
    let batchFeeLimit = 15; // Default fallback (was hardcoded 50)
    try {
      const feeLimitResult = await calculateOptimalFeeLimit(
        fromAddress[0]?.address || destinationAddress,
        destinationAddress,
        process.env.TRX_CONTRACT
      );
      batchFeeLimit = feeLimitResult.feeLimit;
      logCostSavings("batchTRC20Transfer", 50, batchFeeLimit, {
        addressCount: fromAddress.length,
        energyDeficit: feeLimitResult.energyDeficit,
      });
    } catch (feeLimitError) {
      cronLogger.warn(`[assetBatchAddressesToOtherAddress] ⚠️ Dynamic feeLimit failed, using fallback ${batchFeeLimit} TRX`);
    }

    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          cronLogger.info("###USDT-TRC20 PAYLOAD: ", {
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: batchFeeLimit,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          const result = await tatumSdk.blockchain.tron.tronTransferTrc20({
            amount: Number(fromAddr.value).toFixed(2).toString(),
            feeLimit: batchFeeLimit,
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            tokenAddress: process.env.TRX_CONTRACT,
          });
          cronLogger.info("###result", result);
          const trc20TxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: trc20TxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          cronLogger.info("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "BSC") {
    let transactionResponse: Array<{ txId: string; status: string; reason: string | null; fromAddress: unknown; toAddress?: string; errorMessage?: string; error?: string; cause?: string }> = [];
    // Send assets from all addresses to one address
    await Promise.allSettled(
      fromAddress.map(async (fromAddr) => {
        try {
          cronLogger.info("#######BSC PAYLOAD ####", {
            currency,
            amount: Number(fromAddr.value).toFixed(8).toString(),
            fromPrivateKey: fromAddr.privateKey,
            to: destinationAddress,
            fee: {
              gasPrice: Math.ceil(fee?.gasPrice).toString(),
              gasLimit: fee?.gasLimit.toString(),
            },
          });
          const result = await tatumSdk.blockchain.bsc.bscBlockchainTransfer({
              currency,
              amount: Number(fromAddr.value).toFixed(8).toString(),
              fromPrivateKey: fromAddr.privateKey,
              to: destinationAddress,
              fee: {
                gasPrice: Math.ceil(fee?.gasPrice).toString(),
                gasLimit: fee?.gasLimit.toString(),
              },
            });

          cronLogger.info("###result", result);
          const bscTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
          transactionResponse.push({
            txId: bscTxId,
            status: "success",
            reason: null,
            fromAddress: fromAddr,
          });
        } catch (error: unknown) {
          const err = error as { body?: { message?: string; cause?: string }; message?: string };
          cronLogger.info("###error: ", error);
          transactionResponse.push({
            txId: '',
            fromAddress: fromAddr.address,
            toAddress: destinationAddress,
            status: "failed",
            errorMessage: err.body?.message || '',
            error: err.message || '',
            cause: err.body?.cause || '',
            reason: err.message || null,
          });
        }
      })
    );
    transactions = transactionResponse;
  } else if (currency === "DOGE") {
    cronLogger.info("###DODGE Payload ###", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const result = await tatumSdk.blockchain.doge.dogeTransferBlockchain({
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const dogeTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: dogeTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  } else if (currency === "LTC") {
    cronLogger.info("#####LTC Payload", {
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const result = await tatumSdk.blockchain.ltc.ltcTransferBlockchain({
      fromAddress: fromAddress.map((address) => ({
        address: address.address,
        privateKey: address.privateKey,
      })),
      to: toAddress.map((address) => ({
        ...address,
        value: Number(Number(address.value).toFixed(8)),
      })),
      fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress,
    });
    const ltcTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: ltcTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  } else if (currency === "BCH") {
    cronLogger.info("###BCH Payload###", {
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress?.includes("bitcoincash")
        ? destinationAddress
        : "bitcoincash:" + destinationAddress,
    });
    const result = await tatumSdk.blockchain.bcash.bchTransferBlockchain({
      fromUTXO,
      to: toUTXO,
      fee: fee,
      changeAddress: permanentUserWalletAddress
        ? permanentUserWalletAddress
        : destinationAddress?.includes("bitcoincash")
        ? destinationAddress
        : "bitcoincash:" + destinationAddress,
    });
    const bchTxId = isTransactionHash(result) ? result.txId : (result as SignatureId).signatureId;
    fromAddress.forEach((fromAdd) => {
      transactions.push({
        txId: bchTxId,
        status: "success",
        reason: null,
        fromAddress: fromAdd,
      });
    });
  }
  return transactions;
};

const validateTronAddress = (address) => {
  const status = tronweb.utils.address.isAddress(address);
  if (status) {
    return status;
  } else {
    throw { message: "please enter a valid TRX address!" };
  }
};

/**
 * TATUM CREDIT OPTIMIZATION: Redis-cached balance check.
 * Cron jobs call getAddressBalance hundreds of times per hour across 150+ addresses.
 * Caching with 10-min TTL reduces redundant API calls by ~80%.
 * Use skipCache=true for payment-critical flows that need real-time data.
 */
const BALANCE_CACHE_TTL_SECONDS = 600; // 10 minutes

const getAddressBalance = async (address: string, currency: string, skipCache: boolean = false) => {
  // Check Redis cache first (unless caller needs real-time data)
  if (!skipCache) {
    const cacheKey = `tatum:balance:${currency}:${address}`;
    try {
      const cached = await getRedisItem(cacheKey);
      if (cached !== null && cached !== undefined) {
        return cached as { balance: string; incoming?: string; outgoing?: string };
      }
    } catch {
      // Cache miss or Redis error — proceed with API call
    }
  }

  const tatumSdk = await getTatumSDK();
  let res;
  if (currency === "BTC") {
    res = await tatumSdk.blockchain.bitcoin.btcGetBalanceOfAddress(address);
  } else if (currency === "ETH") {
    // FIX (2026-07-11): Validate the SDK response so a transient failure ({}, undefined)
    // does NOT silently degrade into balance:0 downstream (which would trip the fee
    // wallet monitor into a false "empty" alert). Same rationale as the TRX branch.
    const ethRes = await tatumSdk.blockchain.eth.ethGetBalance(address) as { balance?: string | number } | null | undefined;
    if (!ethRes || (ethRes.balance === undefined || ethRes.balance === null)) {
      throw new Error(`tatum.ethGetBalance.invalidResponse (address=${address})`);
    }
    res = { balance: String(ethRes.balance) };
  } else if (currency === "USDT-ERC20") {
    // FIX (2026-07-08): Tatum SDK's fungibleToken.erc20GetBalance() has been observed
    // returning 0 for addresses that clearly hold USDT on-chain (confirmed via Ethplorer
    // and direct v3 REST). This caused customer payment 0a5bd34d... (100 USDT) to be
    // silently lost by the checkMissedPayments fallback cron. Switch to direct REST.
    try {
      const headers = await getTatumHeaders();
      const contract = process.env.ETH_CONTRACT || "0xdac17f958d2ee523a2206206994597c13d831ec7";
      const { data: erc20Res } = await axios.get(
        `https://api.tatum.io/v3/ethereum/account/balance/erc20/${address}`,
        { headers, params: { contractAddress: contract }, timeout: 15000 }
      );
      // Response: {"balance":"100204754"} — raw units, 6 decimals
      res = { balance: (Number(erc20Res?.balance || 0) / 1000000).toString() };
    } catch (e: unknown) {
      const err = e as { message?: string };
      cronLogger.warn(`[getAddressBalance] USDT-ERC20 REST failed for ${address}: ${err?.message}, trying SDK fallback`);
      const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
        "ETH",
        address,
        process.env.ETH_CONTRACT
      );
      res = { balance: (Number(tempRes.balance) / 1000000).toString() };
    }
  } else if (currency === "USDC-ERC20") {
    // Same REST-first strategy as USDT-ERC20 (see fix note above).
    try {
      const headers = await getTatumHeaders();
      const contract = process.env.USDC_CONTRACT || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      const { data: erc20Res } = await axios.get(
        `https://api.tatum.io/v3/ethereum/account/balance/erc20/${address}`,
        { headers, params: { contractAddress: contract }, timeout: 15000 }
      );
      res = { balance: (Number(erc20Res?.balance || 0) / 1000000).toString() };
    } catch (e: unknown) {
      const err = e as { message?: string };
      cronLogger.warn(`[getAddressBalance] USDC-ERC20 REST failed for ${address}: ${err?.message}, trying SDK fallback`);
      const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
        "ETH",
        address,
        process.env.USDC_CONTRACT
      );
      res = { balance: (Number(tempRes.balance) / 1000000).toString() };
    }
  } else if (currency === "RLUSD-ERC20") {
    // Same REST-first strategy as USDT-ERC20 (see fix note above).
    try {
      const headers = await getTatumHeaders();
      const contract = process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD";
      const { data: erc20Res } = await axios.get(
        `https://api.tatum.io/v3/ethereum/account/balance/erc20/${address}`,
        { headers, params: { contractAddress: contract }, timeout: 15000 }
      );
      // RLUSD ERC20 uses 18 decimals
      res = { balance: (Number(erc20Res?.balance || 0) / 1e18).toString() };
    } catch (e: unknown) {
      const err = e as { message?: string };
      cronLogger.warn(`[getAddressBalance] RLUSD-ERC20 REST failed for ${address}: ${err?.message}, trying SDK fallback`);
      const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
        "ETH",
        address,
        process.env.RLUSD_ERC20_CONTRACT
      );
      res = { balance: (Number(tempRes.balance) / 1000000).toString() };
    }
  } else if (currency === "TRX") {
    try {
      const tempRes = await tatumSdk.blockchain.tron.tronGetAccount(address);
      // BUG FIX: tronGetAccount returns balance in SUN (1 TRX = 1,000,000 SUN).
      // Must convert to TRX to match how all other chains return human-readable units.
      // Without this, sweep code treats SUN value as TRX, attempting to send ~1M× more than available.
      //
      // FIX (2026-07-11): Distinguish "account with 0 balance" from "Tatum returned garbage".
      // Previously: undefined/null/{} → Number(undefined||0)/1e6 = 0 → silent false-empty
      // → feeWalletMonitor fires "🚨 URGENT: TRX Fee Wallet Empty!" while wallet has funds.
      // Now: only accept a response that CLEARLY represents a TRON account (has one of
      // the well-known fields address/create_time/latest_opration_time or an explicit
      // numeric balance). Otherwise throw so caller can degrade gracefully (skip / re-try).
      // ALSO: report the TOTAL balance = liquid + frozenV2 (staked for energy/bandwidth).
      // Operators typically stake TRX so daily gas spend comes from ENERGY (free), leaving
      // liquid balance low; the staked portion is still theirs (unstakable), and it MUST
      // count toward "wallet health" for alerting.
      const acct = tempRes as Record<string, unknown> | undefined | null;
      const hasAccountShape = !!acct && (
        typeof (acct as Record<string, unknown>).balance === 'number' ||
        typeof (acct as Record<string, unknown>).balance === 'string' ||
        !!(acct as Record<string, unknown>).address ||
        !!(acct as Record<string, unknown>).create_time ||
        !!(acct as Record<string, unknown>).latest_opration_time
      );
      if (!hasAccountShape) {
        // Empty {} / undefined / broken response — do NOT masquerade as balance:0.
        // Throw so upstream (feeWalletMonitor / checkFeeBalance) can safely skip
        // this cycle instead of firing a false "empty wallet" alert.
        throw new Error(`tatum.tronGetAccount.invalidResponse (address=${address})`);
      }
      // liquid balance in SUN → TRX
      const liquidSun = Number((acct as Record<string, unknown>).balance || 0);
      // Stake 2.0 (frozenV2): array of { type?, amount? }
      const frozenV2 = (acct as Record<string, unknown>).frozenV2;
      let frozenSun = 0;
      if (Array.isArray(frozenV2)) {
        for (const f of frozenV2) {
          const amt = Number((f as Record<string, unknown>)?.amount || 0);
          if (Number.isFinite(amt)) frozenSun += amt;
        }
      }
      // Stake 1.0 (legacy `frozen: [{ frozen_balance }]`) — still supported on chain
      const legacyFrozen = (acct as Record<string, unknown>).frozen;
      if (Array.isArray(legacyFrozen)) {
        for (const f of legacyFrozen) {
          const amt = Number((f as Record<string, unknown>)?.frozen_balance || 0);
          if (Number.isFinite(amt)) frozenSun += amt;
        }
      }
      // account_resource frozen_balance_for_energy (some SDK versions surface it here)
      const accountResource = (acct as Record<string, unknown>).account_resource;
      if (accountResource && typeof accountResource === 'object') {
        const ar = accountResource as Record<string, unknown>;
        const arEnergy = Number(ar.frozen_balance_for_energy || 0);
        if (Number.isFinite(arEnergy)) frozenSun += arEnergy;
      }
      const totalSun = liquidSun + frozenSun;
      res = {
        // Keep `balance` = LIQUID for backward compat (settlement pre-check,
        // sweep code, diagnostics all reason about spendable TRX, not staked).
        balance: (liquidSun / 1000000).toString(),
        liquid: (liquidSun / 1000000).toString(),
        frozen: (frozenSun / 1000000).toString(),
        // Total wallet worth (liquid + frozen). Used by feeWalletMonitor to
        // avoid spamming low-balance alerts for well-staked fee wallets.
        total: (totalSun / 1000000).toString(),
      } as { balance: string; liquid?: string; frozen?: string; total?: string };
    } catch (e: unknown) {
      const err = e as { message?: string };
      // Only treat "account not found" as a real 0. Everything else is a transient
      // API failure and MUST propagate up so the caller doesn't send a false alert.
      if ((err.message || '').includes('account.not.found') || (err.message || '').includes('not.found')) {
        res = { balance: '0', liquid: '0', frozen: '0', total: '0' } as { balance: string; liquid?: string; frozen?: string; total?: string };
      } else { throw e; }
    }
  } else if (currency === "USDT-TRC20") {
    try {
      const tempRes = await tatumSdk.blockchain.tron.tronGetAccount(address);
      // FIX (2026-07-11): reject clearly-broken responses (empty {}, undefined) instead
      // of returning silent balance:0. See TRX branch above for full rationale.
      const acct = tempRes as Record<string, unknown> | undefined | null;
      const hasAccountShape = !!acct && (
        typeof (acct as Record<string, unknown>).balance === 'number' ||
        typeof (acct as Record<string, unknown>).balance === 'string' ||
        !!(acct as Record<string, unknown>).address ||
        !!(acct as Record<string, unknown>).create_time ||
        !!(acct as Record<string, unknown>).latest_opration_time ||
        Array.isArray((acct as Record<string, unknown>).trc20)
      );
      if (!hasAccountShape) {
        throw new Error(`tatum.tronGetAccount.invalidResponse (address=${address})`);
      }
      if (tempRes && tempRes?.trc20 && Array.isArray(tempRes.trc20)) {
        // FIX: Iterate through ALL trc20 entries to find the USDT contract.
        // Previously hardcoded trc20[0] which broke when spam/airdrop tokens
        // appeared before USDT in the array (extremely common on TRON).
        // This caused getAddressBalance to return NaN, blinding the monitoring
        // cron from detecting received USDT payments.
        const usdtContract = process.env.TRX_CONTRACT;
        let usdtBalance = 0;
        let foundAt = -1;
        for (let i = 0; i < tempRes.trc20.length; i++) {
          const tokenEntry = tempRes.trc20[i];
          if (tokenEntry && usdtContract && tokenEntry[usdtContract] !== undefined) {
            usdtBalance = Number(tokenEntry[usdtContract]) / 1000000;
            foundAt = i;
            break;
          }
        }
        // NaN guard: if parsing failed for any reason, default to 0
        if (!Number.isFinite(usdtBalance)) {
          cronLogger.warn(`[getAddressBalance] USDT-TRC20 balance parsed as NaN for ${address}, defaulting to 0. Contract: ${usdtContract}, trc20 entries: ${tempRes.trc20.length}`);
          usdtBalance = 0;
        }
        if (tempRes.trc20.length > 0) {
          cronLogger.info(`[getAddressBalance] TRC20 tokens found: ${tempRes.trc20.length} entries, USDT at index: ${foundAt}, balance: ${usdtBalance}`);
        }
        res = { balance: usdtBalance.toString() };
      } else {
        res = { balance: '0' };
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      if ((err.message || '').includes('account.not.found') || (err.message || '').includes('not.found')) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "LTC") {
    res = await tatumSdk.blockchain.ltc.ltcGetBalanceOfAddress(address);
  } else if (currency === "DOGE") {
    res = await tatumSdk.blockchain.doge.dogeGetBalanceOfAddress(address);
  } else if (currency === "BSC") {
    res = await tatumSdk.blockchain.bsc.bscGetBalance(address);
  } else if (currency === "BCH") {
    // FIX: Tatum SDK bug — bchGetTxByAddress(address, skip) doesn't send pageSize param.
    // No dedicated bchGetBalance in SDK, so use direct HTTP with pageSize to get tx list.
    const bchHeaders = await getTatumHeaders();
    const { data: bchTxList } = await axios.get(
      `https://api.tatum.io/v3/bcash/transaction/address/${address}`,
      {
        headers: bchHeaders,
        params: { pageSize: 10, skip: 0 },
        timeout: 15000,
      }
    );
    // Calculate balance from UTXO transactions (same approach as SDK, now with pageSize)
    let bchBalance = 0;
    for (const tx of (bchTxList as Array<{ outputs?: Array<{ address?: string; value?: string }> }>) || []) {
      for (const output of tx.outputs || []) {
        if (output.address === address) {
          bchBalance += parseFloat(output.value || '0');
        }
      }
    }
    res = { balance: bchBalance.toString() };
  } else if (currency === "SOL") {
    const solRes = await tatumSdk.blockchain.solana.solanaGetBalance(address);
    res = { balance: solRes?.balance || '0' };
  } else if (currency === "XRP") {
    try {
      const xrpRes = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
      // XRP balance is in drops, convert to XRP
      const xrpBalance = xrpRes?.balance ? (Number(xrpRes.balance) / 1000000).toString() : '0';
      res = { balance: xrpBalance };
    } catch (e: unknown) {
      const err = e as { message?: string; body?: { errorCode?: string; message?: string }; status?: number };
      const errMsg = (err.message || '').toLowerCase();
      const bodyMsg = (err.body?.message || '').toLowerCase();
      const errorCode = (err.body?.errorCode || '').toLowerCase();
      if (errMsg.includes('not.found') || errMsg.includes('account not found') ||
          bodyMsg.includes('not found') || errorCode.includes('account.failed') || err.status === 403) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "RLUSD") {
    try {
      const xrpRes = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
      // Find RLUSD trust line balance from obligations
      const rlusdIssuer = (process.env.RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De").toLowerCase();
      let rlusdBalance = '0';
      const xrpResAny = xrpRes as any;
      if (xrpResAny?.obligations) {
        for (const obligation of xrpResAny.obligations) {
          if ((obligation.currency || '').toUpperCase() === 'RLUSD' || 
              (obligation.currency || '').toUpperCase().startsWith('524C5553')) {
            rlusdBalance = obligation.value || '0';
            break;
          }
        }
      }
      // Also check assets (some versions return balance in assets)
      if (rlusdBalance === '0' && xrpResAny?.assets) {
        for (const asset of xrpResAny.assets) {
          if ((asset.currency || '').toUpperCase() === 'RLUSD' || 
              (asset.currency || '').toUpperCase().startsWith('524C5553')) {
            rlusdBalance = (asset as any).value || '0';
            break;
          }
        }
      }
      res = { balance: rlusdBalance };
    } catch (e: unknown) {
      const err = e as { message?: string; body?: { errorCode?: string; message?: string }; status?: number };
      const errMsg = (err.message || '').toLowerCase();
      const bodyMsg = (err.body?.message || '').toLowerCase();
      const errorCode = (err.body?.errorCode || '').toLowerCase();
      if (errMsg.includes('not.found') || errMsg.includes('account not found') ||
          bodyMsg.includes('not found') || errorCode.includes('account.failed') || err.status === 403) {
        res = { balance: '0' };
      } else { throw e; }
    }
  } else if (currency === "POLYGON") {
    // FIX (2026-07-11): Validate the SDK response — see ETH/TRX branches for rationale.
    // Guards feeWalletMonitor against a false-empty alert on transient Tatum failures.
    const polyRes = await tatumSdk.blockchain.polygon.polygonGetBalance(address) as { balance?: string | number } | null | undefined;
    if (!polyRes || (polyRes.balance === undefined || polyRes.balance === null)) {
      throw new Error(`tatum.polygonGetBalance.invalidResponse (address=${address})`);
    }
    res = { balance: String(polyRes.balance) };
  } else if (currency === "USDT-POLYGON") {
    // FIX (2026-07-08): Mirror USDT-ERC20 REST-first strategy to bypass SDK stale-balance bug.
    try {
      const headers = await getTatumHeaders();
      const contract = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      const { data: erc20Res } = await axios.get(
        `https://api.tatum.io/v3/polygon/account/balance/erc20/${address}`,
        { headers, params: { contractAddress: contract }, timeout: 15000 }
      );
      res = { balance: (Number(erc20Res?.balance || 0) / 1000000).toString() };
    } catch (e: unknown) {
      const err = e as { message?: string };
      cronLogger.warn(`[getAddressBalance] USDT-POLYGON REST failed for ${address}: ${err?.message}, trying SDK fallback`);
      const tempRes = await tatumSdk.fungibleToken.erc20GetBalance(
        "MATIC",
        address,
        process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
      );
      res = { balance: (Number(tempRes.balance) / 1000000).toString() };
    }
  }

  // TATUM CREDIT OPTIMIZATION: Cache the result in Redis
  // SAFETY: Only cache non-zero balances to prevent false "empty wallet" alerts
  // from transient API errors (account.not.found, timeouts) being cached as 0
  if (res && !skipCache) {
    const balanceNum = parseFloat(res.balance || '0');
    if (balanceNum > 0 || (res.incoming !== undefined)) {
      // Only cache positive balances or UTXO results (which have incoming/outgoing fields)
      const cacheKey = `tatum:balance:${currency}:${address}`;
      try {
        await setRedisItemWithTTL(cacheKey, res, BALANCE_CACHE_TTL_SECONDS);
      } catch {
        // Non-critical: cache write failure doesn't affect correctness
      }
    }
  }

  return res;
};

const getCurrentPaymentStatus = async (address: string, currency) => {
  const tatumSdk = await getTatumSDK();
  let res = {
    paymentStatus: "not_found",
    status: 500,
    transaction_id: null,
    message: "We did not received the payment!",
  };

  if (currency === "BTC") {
    const tempData = await tatumSdk.blockchain.bitcoin.btcGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      cronLogger.info(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };

        cronLogger.info("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "LTC") {
    const tempData = await tatumSdk.blockchain.ltc.ltcGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      cronLogger.info(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };
        cronLogger.info("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "DOGE") {
    const tempData = await tatumSdk.blockchain.doge.dogeGetTxByAddress(
      address,
      10,
      0,
      null,
      null,
      "incoming"
    );

    for (let i = 0; i < tempData.length; i++) {
      const currentBlock = tempData[i];
      const blockTime =
        currentBlock.time.toString().length > 10
          ? currentBlock.time
          : currentBlock.time * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      cronLogger.info(todayDate, blockDate, todayDate === blockDate);
      const checkOutput = currentBlock.inputs[0].coin.address === address;
      if (
        todayDate === blockDate &&
        !checkOutput &&
        !currentBlock.blockNumber
      ) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.hash,
          message: "payment detected, please wait for confirmation!",
        };
        cronLogger.info("currentTransactionBlock===========>", res);
      }
    }
  }
  if (currency === "TRON") {
    const { transactions } = await tatumSdk.blockchain.tron.tronAccountTx(
      address,
      null,
      null,
      true
    );

    if (transactions.length > 0) {
      const currentBlock = transactions[0];
      const blockTime =
        currentBlock.rawData.timestamp.toString().length > 10
          ? currentBlock.rawData.timestamp
          : currentBlock.rawData.timestamp * 1000;
      const todayDate = new Date().toISOString().slice(0, 10);
      const blockDate = new Date(blockTime).toISOString().slice(0, 10);
      cronLogger.info(todayDate, blockDate, todayDate === blockDate);
      if (todayDate === blockDate) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.txID,
          message: "payment detected, please wait for confirmation!",
        };

        cronLogger.info("currentTransactionBlock===========>", res);
      }
    }
  }

  if (currency === "USDT-TRC20") {
    const { transactions } = await tatumSdk.blockchain.tron.tronAccountTx20(
      address,
      null,
      null,
      true
    );

    if (transactions.length > 0) {
      const currentBlock = transactions[0];

      res = {
        paymentStatus: "detected",
        status: 200,
        transaction_id: currentBlock.txID,

        message: "payment detected, please wait for confirmation!",
      };

      cronLogger.info("currentTransactionBlock===========>", res);
    }
  }
  if (currency === "USDT-ERC20") {
    const contractAddress = process.env.ETH_CONTRACT;
    const transactions =
      await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH",
        address,
        contractAddress,
        10,
        null,
        null,
        null,
        "DESC"
      );

    for (let i = 0; i < transactions.length; i++) {
      const currentBlock = transactions[i];

      if (!currentBlock.blockNumber) {
        res = {
          paymentStatus: "detected",
          status: 200,
          transaction_id: currentBlock.txId,

          message: "payment detected, please wait for confirmation!",
        };

        cronLogger.info("currentTransactionBlock===========>", res);
      }
    }
  }

  // For chains not explicitly handled above (SOL, XRP, POLYGON, USDT-POLYGON, etc.),
  // use fallback balance-based detection instead of returning "not_found"
  if (res.paymentStatus === "not_found") {
    const fallbackResult = await getPaymentStatusFallback(address, currency, 0);
    if (fallbackResult.paymentStatus !== "not_found") {
      return fallbackResult;
    }
  }

  return res;
};
// This prevents "We did not received the payment!" for pool-based newer chains
const getPaymentStatusFallback = async (address: string, currency: string, expectedAmount: number): Promise<{ paymentStatus: string; status: number; message: string }> => {
  const result = {
    paymentStatus: "not_found",
    status: 500,
    message: "We did not received the payment!",
  };
  
  try {
    const tatumSdk = await getTatumSDK();
    let balance = 0;
    
    if (currency === "SOL") {
      const balData = await tatumSdk.blockchain.solana.solanaGetBalance(address) as any;
      balance = (balData?.balance || 0) / 1e9;
    } else if (currency === "XRP" || currency === "RLUSD") {
      const balData = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address) as any;
      balance = (balData?.balance || 0) / 1e6;
    } else if (currency === "POLYGON") {
      const balData = await tatumSdk.blockchain.polygon.polygonGetBalance(address) as any;
      balance = parseFloat(balData?.balance || '0');
    } else if (currency === "USDT-POLYGON") {
      const headers = await getTatumHeaders();
      const contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      const paddedAddr = '000000000000000000000000' + address.slice(2).toLowerCase();
      const data = '0x70a08231' + paddedAddr;
      const r = await axios.post('https://polygon-mainnet.gateway.tatum.io',
        { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: contractAddress, data }, 'latest'] },
        { headers });
      balance = parseInt(r.data.result, 16) / 1e6;
    } else if (currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
      // Handled by existing USDT-ERC20 path or similar ERC20 check
      return result;
    } else if (currency === "BCH") {
      return result; // BCH uses UTXO model, handled differently
    }
    
    if (balance > 0 && balance >= expectedAmount * 0.5) {
      return {
        paymentStatus: "detected",
        status: 200,
        message: `Payment detected: ${balance} ${currency} at ${address}`,
      };
    }
  } catch (e: any) {
    cronLogger.warn(`[getPaymentStatusFallback] ${currency} balance check failed: ${e.message}`);
  }
  
  return result;
};
const getIncomingTransactions = async (
  address: string, 
  currency: string,
  limit: number = 10,
  filterDestinationTag?: number | null
): Promise<{ txId: string; amount: number; timestamp: number; destinationTag?: number | null }[]> => {
  const tatumSdk = await getTatumSDK();
  const transactions: { txId: string; amount: number; timestamp: number; destinationTag?: number | null }[] = [];

  // Define interfaces for transaction data
  interface BTCTransaction {
    hash?: string;
    outputs?: Array<{ address?: string; value?: string | number }>;
    time?: number;
  }

  interface ETHTransaction {
    hash?: string;
    to?: string;
    value?: string | number;
    blockNumber?: number;
    timestamp?: number;
  }

  interface TRXTransaction {
    hash?: string;
    txID?: string;
    to?: string;
    raw_data?: { contract?: Array<{ parameter?: { value?: { to_address?: string; amount?: number } } }> };
    block_timestamp?: number;
    ret?: Array<{ contractRet?: string }>;
  }

  try {
    if (currency === "BTC") {
      const txData = await tatumSdk.blockchain.bitcoin.btcGetTxByAddress(
        address, limit, 0
      ) as BTCTransaction[] | undefined;
      for (const tx of txData || []) {
        // Find the output for our address
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(String(output.value || '0'));
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time ? (String(tx.time).length > 10 ? tx.time : tx.time * 1000) : Date.now()
          });
        }
      }
    } else if (currency === "ETH") {
      // Note: ethGetAccountTransactions may not exist in newer SDK - use alternative
      interface EthBlockchain {
        ethGetAccountTransactions?: (address: string, offset?: number, limit?: number) => Promise<ETHTransaction[]>;
        ethGetTransaction: (hash: string) => Promise<unknown>;
      }
      const ethApi = tatumSdk.blockchain.eth as unknown as EthBlockchain;
      const txData = await ethApi.ethGetAccountTransactions?.(
        address, 0, limit
      ) || [];
      for (const tx of txData as ETHTransaction[] || []) {
        // Only incoming transactions (where we are the recipient)
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: parseFloat(String(tx.value || '0')) / 1e18, // Convert wei to ETH
            timestamp: tx.timestamp || Date.now()
          });
        }
      }
    } else if (currency === "TRX") {
      interface TronTxResult {
        transactions?: TRXTransaction[];
      }
      const result = await tatumSdk.blockchain.tron.tronAccountTx(
        address, undefined, undefined, true
      ) as TronTxResult;
      for (const tx of result?.transactions || []) {
        // Check if this is a TRX transfer to our address
        const contract = tx.raw_data?.contract?.[0];
        if (contract) {
          const params = contract.parameter?.value;
          if (params?.to_address === address) {
            const amount = (params.amount || 0) / 1e6; // Convert sun to TRX
            if (amount > 0) {
              transactions.push({
                txId: tx.txID || '',
                amount,
                timestamp: tx.block_timestamp || Date.now()
              });
            }
          }
        }
      }
    } else if (currency === "USDT-TRC20") {
      interface TRC20Transaction {
        to?: string;
        value?: string | number;
        txID?: string;
        transaction_id?: string;
        block_timestamp?: number;
      }
      interface TRC20TxResult {
        transactions?: TRC20Transaction[];
      }
      const result = await tatumSdk.blockchain.tron.tronAccountTx20(
        address, undefined, undefined, true
      ) as TRC20TxResult;
      for (const tx of result?.transactions || []) {
        // TRC20 transfers
        if (tx.to === address && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.txID || tx.transaction_id || '',
            amount: parseFloat(String(tx.value || '0')) / 1e6, // USDT has 6 decimals
            timestamp: tx.block_timestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDT-ERC20") {
      const contractAddress = process.env.ETH_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // USDT has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDC-ERC20") {
      const contractAddress = process.env.USDC_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // USDC has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "RLUSD-ERC20") {
      const contractAddress = process.env.RLUSD_ERC20_CONTRACT;
      const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
        "ETH", address, contractAddress, limit
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(tx.value || '0') / 1e6, // RLUSD has 6 decimals
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "LTC") {
      const txData = await tatumSdk.blockchain.ltc.ltcGetTxByAddress(
        address, limit, 0
      );
      for (const tx of (txData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "DOGE") {
      const txData = await tatumSdk.blockchain.doge.dogeGetTxByAddress(
        address, limit, 0
      );
      for (const tx of (txData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "BCH") {
      // FIX: Tatum SDK bug — bchGetTxByAddress(address, skip) doesn't send pageSize param.
      // BTC/LTC/DOGE SDKs have (address, pageSize, offset) but BCH only has (address, skip).
      // The API endpoint requires pageSize, so we use a direct HTTP call instead.
      const bchHeaders = await getTatumHeaders();
      const { data: bchTxData } = await axios.get(
        `https://api.tatum.io/v3/bcash/transaction/address/${address}`,
        {
          headers: bchHeaders,
          params: { pageSize: Math.min(limit, 50), skip: 0 },
          timeout: 15000,
        }
      );
      for (const tx of (bchTxData as UTXOTransaction[]) || []) {
        let receivedAmount = 0;
        for (const output of tx.outputs || []) {
          if (output.address === address) {
            receivedAmount += parseFloat(output.value || '0');
          }
        }
        if (receivedAmount > 0) {
          transactions.push({
            txId: tx.hash || '',
            amount: receivedAmount,
            timestamp: tx.time && tx.time.toString().length > 10 ? tx.time : (tx.time || 0) * 1000
          });
        }
      }
    } else if (currency === "SOL") {
      // Solana incoming transactions — use Tatum RPC gateway (getSignaturesForAddress + getTransaction)
      try {
        const headers = await getTatumHeaders();
        
        // Step 1: Get recent transaction signatures for this address
        const { data: sigsResult } = await axios.post(
          'https://solana-mainnet.gateway.tatum.io',
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [address, { limit }]
          },
          { headers }
        );
        
        const signatures = sigsResult?.result || [];
        
        for (const sig of signatures) {
          if (sig.err) continue; // Skip failed transactions
          
          // Step 2: Get transaction details for each signature
          try {
            const { data: txResult } = await axios.post(
              'https://solana-mainnet.gateway.tatum.io',
              {
                jsonrpc: '2.0',
                id: 1,
                method: 'getTransaction',
                params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
              },
              { headers }
            );
            
            const tx = txResult?.result;
            if (!tx) continue;
            
            // Find the account index for our address
            const accountKeys = tx.transaction?.message?.accountKeys || [];
            const accountIndex = accountKeys.findIndex((k: any) => 
              (typeof k === 'string' ? k : k?.pubkey) === address
            );
            
            if (accountIndex >= 0) {
              const preBalance = (tx.meta?.preBalances?.[accountIndex] || 0);
              const postBalance = (tx.meta?.postBalances?.[accountIndex] || 0);
              const diffLamports = postBalance - preBalance;
              const amount = diffLamports > 0 ? diffLamports / 1e9 : 0;
              
              if (amount > 0) {
                transactions.push({
                  txId: sig.signature,
                  amount,
                  timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now()
                });
              }
            }
          } catch (_txErr) {
            // Skip individual tx errors
          }
        }
      } catch (solErr: any) {
        cronLogger.warn(`[getIncomingTransactions] SOL tx fetch failed for ${address}: ${solErr.response?.data?.message || solErr.message}`);
      }
    } else if (currency === "XRP") {
      // XRP account transactions — include DestinationTag for tag-based filtering
      try {
        const xrpTxData = await tatumSdk.blockchain.xrp.xrpGetAccountTx(address, undefined, undefined);
        const xrpTxs = (xrpTxData as any)?.transactions || [];
        for (const tx of xrpTxs) {
          const meta = tx.meta || tx.metaData;
          const delivered = meta?.delivered_amount;
          const txDestTag = tx.tx?.DestinationTag ?? null;
          if (delivered && typeof delivered === 'string') {
            const amount = Number(delivered) / 1e6;
            if (amount > 0) {
              // If filterDestinationTag specified, only include matching txs
              if (filterDestinationTag !== undefined && filterDestinationTag !== null) {
                if (txDestTag !== filterDestinationTag) continue;
              }
              transactions.push({
                txId: tx.tx?.hash || '',
                amount,
                timestamp: tx.tx?.date ? (tx.tx.date + 946684800) * 1000 : Date.now(),
                destinationTag: txDestTag,
              });
            }
          }
        }
      } catch (_xrpErr) {
        cronLogger.warn(`[getIncomingTransactions] XRP tx fetch failed for ${address}`);
      }
    } else if (currency === "RLUSD") {
      // RLUSD on XRP — include DestinationTag for tag-based filtering
      try {
        const xrpTxData = await tatumSdk.blockchain.xrp.xrpGetAccountTx(address, undefined, undefined);
        const xrpTxs = (xrpTxData as any)?.transactions || [];
        for (const tx of xrpTxs) {
          const meta = tx.meta || tx.metaData;
          const delivered = meta?.delivered_amount;
          const txDestTag = tx.tx?.DestinationTag ?? null;
          if (delivered && typeof delivered === 'object' && (delivered.currency === 'RLUSD' || (delivered.currency || '').startsWith('524C5553'))) {
            const amount = Number(delivered.value || 0);
            if (amount > 0) {
              // If filterDestinationTag specified, only include matching txs
              if (filterDestinationTag !== undefined && filterDestinationTag !== null) {
                if (txDestTag !== filterDestinationTag) continue;
              }
              transactions.push({
                txId: tx.tx?.hash || '',
                amount,
                timestamp: tx.tx?.date ? (tx.tx.date + 946684800) * 1000 : Date.now(),
                destinationTag: txDestTag,
              });
            }
          }
        }
      } catch (_rlusdErr) {
        cronLogger.warn(`[getIncomingTransactions] RLUSD tx fetch failed for ${address}`);
      }
    } else if (currency === "POLYGON") {
      // Polygon native transactions
      const txData = await tatumSdk.blockchain.polygon.polygonGetTransactionByAddress(
        address, limit, 0
      );
      for (const tx of (txData as ERC20Transaction[]) || []) {
        if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(String(tx.value || '0')) > 0) {
          transactions.push({
            txId: tx.transactionHash || tx.txId || tx.hash || '',
            amount: parseFloat(String(tx.value || '0')) / 1e18,
            timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
          });
        }
      }
    } else if (currency === "USDT-POLYGON") {
      const contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      try {
        const txData = await tatumSdk.fungibleToken.erc20GetTransactionByAddress(
          "MATIC", address, contractAddress, limit
        );
        for (const tx of (txData as ERC20Transaction[]) || []) {
          if (tx.to?.toLowerCase() === address.toLowerCase() && parseFloat(tx.value || '0') > 0) {
            transactions.push({
              txId: tx.transactionHash || tx.txId || tx.hash || '',
              amount: parseFloat(tx.value || '0') / 1e6,
              timestamp: tx.timestamp || tx.blockTimestamp || Date.now()
            });
          }
        }
      } catch (_sdkErr) {
        // SDK failed — will use RPC fallback below
        cronLogger.warn(`[getIncomingTransactions] USDT-POLYGON SDK failed for ${address}, will try RPC fallback`);
      }
      
      // RPC fallback: if SDK returned empty or failed, use eth_getLogs to find ERC20 Transfer events
      if (transactions.length === 0) {
        cronLogger.info(`[getIncomingTransactions] USDT-POLYGON: Using RPC fallback (eth_getLogs) for ${address}`);
        try {
          const headers = await getTatumHeaders();
          const blockR = await axios.post('https://polygon-mainnet.gateway.tatum.io',
            { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
            { headers });
          const currentBlock = parseInt(blockR.data.result, 16);
          const fromBlock = '0x' + Math.max(0, currentBlock - 50000).toString(16);
          const topic0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
          const paddedAddr = '0x000000000000000000000000' + address.slice(2).toLowerCase();
          
          const logsR = await axios.post('https://polygon-mainnet.gateway.tatum.io',
            { jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [{
              fromBlock, toBlock: 'latest',
              address: contractAddress,
              topics: [topic0, null, paddedAddr]
            }]},
            { headers });
          
          for (const log of (logsR.data.result || []).slice(0, limit)) {
            const value = parseInt(log.data, 16);
            if (value > 0) {
              transactions.push({
                txId: log.transactionHash || '',
                amount: value / 1e6,
                timestamp: log.blockNumber ? parseInt(log.blockNumber, 16) * 1000 : Date.now()
              });
            }
          }
          cronLogger.info(`[getIncomingTransactions] USDT-POLYGON RPC found ${transactions.length} transactions`);
        } catch (rpcErr: any) {
          cronLogger.warn(`[getIncomingTransactions] USDT-POLYGON RPC fallback failed: ${rpcErr.message}`);
        }
      }
    }
  } catch (error) {
    cronLogger.error(`[getIncomingTransactions] Error fetching transactions for ${currency}:`, error.message);
  }

  // Sort by timestamp descending (most recent first)
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Wait for a transaction to be confirmed on the blockchain
 * Returns true if confirmed within timeout, false if still pending
 */
const waitForTransactionConfirmation = async (
  txHash: string,
  currency: string,
  maxWaitMs: number = 60000, // Default 60 seconds
  pollIntervalMs: number = 5000 // Check every 5 seconds
): Promise<{ confirmed: boolean; blockNumber?: number; contractResult?: string }> => {
  const startTime = Date.now();
  const tatumSdk = await getTatumSDK();
  
  // TRON contract result values that indicate execution failure
  // On TRON, a TX is always included in a block — but the smart contract execution
  // can fail (OUT_OF_ENERGY, REVERT, etc.) meaning tokens didn't actually move.
  const TRON_FAILURE_RESULTS = ["OUT_OF_ENERGY", "REVERT", "JVM_STACK_OVER_FLOW", "OUT_OF_TIME", "TRANSFER_FAILED", "UNKNOWN"];
  const isTronChain = currency === "TRX" || currency === "USDT-TRC20";
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      let txData: Record<string, unknown> | null = null;
      
      if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
        txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash);
      } else if (currency === "BSC") {
        txData = await tatumSdk.blockchain.bsc.bscGetTransaction(txHash);
      } else if (isTronChain) {
        txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash);
      } else if (currency === "POLYGON" || currency === "USDT-POLYGON") {
        txData = await tatumSdk.blockchain.polygon.polygonGetTransaction(txHash);
      } else if (currency === "SOL") {
        // Solana: transactions are confirmed nearly instantly
        return { confirmed: true, blockNumber: 0 };
      } else if (currency === "XRP" || currency === "RLUSD") {
        // XRP: transactions are confirmed in ~4 seconds
        const xrpTx = await tatumSdk.blockchain.xrp.xrpGetTransaction(txHash);
        if (xrpTx && (xrpTx as any).validated) {
          return { confirmed: true, blockNumber: (xrpTx as any).ledger_index || 0 };
        }
        txData = xrpTx as Record<string, unknown>;
      }
      
      if (txData && txData.blockNumber) {
        // TRON-specific: Check contractResult — TX in a block does NOT mean execution succeeded.
        // A TRC20 transfer can be included in a block but fail with OUT_OF_ENERGY if the address
        // didn't have enough TRX to pay for energy. Tokens don't move in this case.
        if (isTronChain) {
          const retArray = (txData as any).ret as Array<{ contractRet?: string; fee?: number }> | undefined;
          const contractResult = retArray?.[0]?.contractRet || "UNKNOWN";
          
          if (contractResult === "SUCCESS") {
            cronLogger.info(`[waitForTransactionConfirmation] TX ${txHash} confirmed in block ${txData.blockNumber} (TRON contractResult: SUCCESS)`);
            return { confirmed: true, blockNumber: txData.blockNumber as number, contractResult };
          } else if (TRON_FAILURE_RESULTS.includes(contractResult)) {
            cronLogger.error(`[waitForTransactionConfirmation] ❌ TX ${txHash} included in block ${txData.blockNumber} but EXECUTION FAILED: contractResult=${contractResult}. Tokens did NOT move.`);
            return { confirmed: false, blockNumber: txData.blockNumber as number, contractResult };
          } else {
            // Unknown contract result — log and treat as pending (might still be processing)
            cronLogger.warn(`[waitForTransactionConfirmation] TX ${txHash} in block ${txData.blockNumber}, unexpected contractResult: ${contractResult}. Waiting...`);
          }
        } else {
          cronLogger.info(`[waitForTransactionConfirmation] TX ${txHash} confirmed in block ${txData.blockNumber}`);
          return { confirmed: true, blockNumber: txData.blockNumber as number };
        }
      }
      
      cronLogger.info(`[waitForTransactionConfirmation] TX ${txHash} still pending, waiting...`);
    } catch (error) {
      cronLogger.info(`[waitForTransactionConfirmation] Error checking TX: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  cronLogger.info(`[waitForTransactionConfirmation] TX ${txHash} not confirmed within ${maxWaitMs}ms`);
  return { confirmed: false };
};

/**
 * Check if a transaction has enough confirmations to be safely processed
 * Different blockchains require different confirmation counts:
 * - BTC: 1 confirmation (10 min avg block time)
 * - LTC: 3 confirmations (2.5 min avg block time)
 * - DOGE: 6 confirmations (1 min avg block time)
 * - BCH: 1 confirmation (10 min avg block time)
 * - ETH: 12 confirmations (12 sec avg block time)
 * - TRX: 19 confirmations (3 sec avg block time)
 * 
 * Returns: { confirmed: boolean, confirmations: number, required: number }
 */
const getTransactionConfirmations = async (
  txHash: string,
  currency: string
): Promise<{ confirmed: boolean; confirmations: number; required: number }> => {
  const tatumSdk = await getTatumSDK();
  
  // Required confirmations per blockchain
  const REQUIRED_CONFIRMATIONS: { [key: string]: number } = {
    'BTC': 1,
    'LTC': 3,
    'DOGE': 6,
    'BCH': 1,
    'ETH': 12,
    'USDT-ERC20': 12,
    'USDC-ERC20': 12,
    'RLUSD-ERC20': 12,
    'TRX': 19,
    'USDT-TRC20': 19,
    'XRP': 1,
    'RLUSD': 1,
    'SOL': 1,
    'POLYGON': 1,
    'USDT-POLYGON': 1,
  };
  
  const required = REQUIRED_CONFIRMATIONS[currency] || 1;
  
  try {
    let confirmations = 0;
    
    if (currency === 'BTC') {
      const txData = await tatumSdk.blockchain.bitcoin.btcGetRawTransaction(txHash) as BlockchainTxWithConfirmations & { blockNumber?: number };
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      } else if (txData && txData.blockNumber) {
        // If confirmations not directly available, calculate from block height
        const blockInfo = await tatumSdk.blockchain.bitcoin.btcGetBlockChainInfo();
        confirmations = blockInfo.blocks - txData.blockNumber + 1;
      }
    } else if (currency === 'LTC') {
      const txData = await tatumSdk.blockchain.ltc.ltcGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'DOGE') {
      const txData = await tatumSdk.blockchain.doge.dogeGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'BCH') {
      const txData = await tatumSdk.blockchain.bcash.bchGetRawTransaction(txHash) as BlockchainTxWithConfirmations;
      if (txData && txData.confirmations !== undefined) {
        confirmations = txData.confirmations;
      }
    } else if (currency === 'ETH' || currency === 'USDT-ERC20' || currency === 'USDC-ERC20') {
      const txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash);
      if (txData && txData.blockNumber) {
        const currentBlock = await (tatumSdk.blockchain.eth as { ethGetBlockNumber?: () => Promise<number> }).ethGetBlockNumber?.() || 0;
        if (currentBlock) {
          confirmations = Number(currentBlock) - txData.blockNumber + 1;
        }
      }
    } else if (currency === 'TRX' || currency === 'USDT-TRC20') {
      const txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash);
      if (txData && txData.blockNumber) {
        const blockInfo = await tatumSdk.blockchain.tron.tronGetCurrentBlock() as TronBlockInfo;
        const currentBlockNumber = blockInfo?.block_header?.raw_data?.number || blockInfo?.blockNumber || 0;
        confirmations = currentBlockNumber - txData.blockNumber + 1;
      }
    } else if (currency === 'XRP' || currency === 'RLUSD') {
      // XRP: If transaction is in a validated ledger, it's confirmed
      try {
        const headers = await getTatumHeaders();
        const { data: txData } = await axios.get(
          `https://api.tatum.io/v3/xrp/transaction/${txHash}`,
          { headers }
        );
        // XRP transactions are final once validated - if we can fetch it, it's confirmed
        if (txData && (txData.validated === true || txData.meta?.TransactionResult === 'tesSUCCESS')) {
          confirmations = 1;
        }
      } catch (_xrpErr) {
        // Try XRPL RPC as fallback
        try {
          const headers = await getTatumHeaders();
          const { data: rpcResult } = await axios.post(
            'https://xrp.tatum.io',
            {
              method: 'tx',
              params: [{ transaction: txHash, binary: false }]
            },
            { headers }
          );
          if (rpcResult?.result?.validated) {
            confirmations = 1;
          }
        } catch (_rpcErr) {
          // If we can't check, leave at 0
        }
      }
    } else if (currency === 'SOL') {
      // Solana: Finalized transactions are confirmed
      try {
        const headers = await getTatumHeaders();
        const { data: rpcResult } = await axios.post(
          'https://solana-mainnet.gateway.tatum.io',
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [txHash, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]
          },
          { headers }
        );
        if (rpcResult?.result && !rpcResult?.result?.meta?.err) {
          confirmations = 1; // Finalized = confirmed on Solana
        }
      } catch (_solErr) {
        // If we can't check, leave at 0
      }
    } else if (currency === 'POLYGON' || currency === 'USDT-POLYGON') {
      // Polygon: Same as ETH but using polygon endpoint
      try {
        const headers = await getTatumHeaders();
        const { data: txData } = await axios.get(
          `https://api.tatum.io/v3/polygon/transaction/${txHash}`,
          { headers }
        );
        if (txData && txData.blockNumber) {
          const { data: currentBlockData } = await axios.get(
            'https://api.tatum.io/v3/polygon/block/current',
            { headers }
          );
          const currentBlock = Number(currentBlockData);
          if (currentBlock) {
            confirmations = currentBlock - txData.blockNumber + 1;
          }
        }
      } catch (_polErr) {
        // If we can't check, leave at 0
      }
    }
    
    cronLogger.info(`[getTransactionConfirmations] ${currency} TX ${txHash}: ${confirmations}/${required} confirmations`);
    
    return {
      confirmed: confirmations >= required,
      confirmations,
      required
    };
  } catch (error) {
    cronLogger.error(`[getTransactionConfirmations] Error checking ${currency} TX ${txHash}:`, error.message);
    // If we can't check, assume not confirmed to be safe
    return { confirmed: false, confirmations: 0, required };
  }
};

/**
 * Find the correct UTXO output index for a given address in a transaction.
 * UTXO transactions can have multiple outputs — we need the index where
 * funds were sent TO our address, not the change output.
 * Falls back to index 0 if lookup fails.
 */
const findUtxoOutputIndex = async (
  txHash: string,
  address: string,
  currency: string
): Promise<number> => {
  try {
    const tatumSdk = await getTatumSDK();
    let txData: { vout?: Array<{ value?: string | number; scriptPubKey?: { addresses?: string[]; address?: string; type?: string; hex?: string; desc?: string; asm?: string }; n?: number }> } | null = null;

    if (currency === 'BTC') {
      txData = await tatumSdk.blockchain.bitcoin.btcGetRawTransaction(txHash) as typeof txData;
    } else if (currency === 'LTC') {
      txData = await tatumSdk.blockchain.ltc.ltcGetRawTransaction(txHash) as typeof txData;
    } else if (currency === 'DOGE') {
      txData = await tatumSdk.blockchain.doge.dogeGetRawTransaction(txHash) as typeof txData;
    } else if (currency === 'BCH') {
      txData = await tatumSdk.blockchain.bcash.bchGetRawTransaction(txHash) as typeof txData;
    }

    // FIX (2026-04-12): Tatum SDK V4 returns `outputs` (not `vout`).
    // Normalize: map outputs → vout so the matching logic below works unchanged.
    const rawData = txData as Record<string, unknown> | null;
    if (rawData && !rawData.vout && Array.isArray(rawData.outputs)) {
      const outputs = rawData.outputs as Array<{ value?: string | number; address?: string; script?: string }>;
      (txData as Record<string, unknown>).vout = outputs.map((o, i) => ({
        value: o.value,
        n: i,
        scriptPubKey: {
          address: o.address || undefined,
          addresses: o.address ? [o.address] : [],
          hex: o.script || undefined,
        },
      }));
      cronLogger.info(
        `[findUtxoOutputIndex] Normalized Tatum outputs→vout for ${currency} tx ${txHash}: ${outputs.length} outputs`
      );
    }

    if (txData?.vout) {
      // FIX BUG-9: Build comprehensive address variants for matching
      const addressLower = address.toLowerCase();
      const addressVariants = new Set([address, addressLower]);

      // For BCH, add CashAddr and legacy formats
      if (currency === 'BCH') {
        try {
          addressVariants.add(bchaddr.toCashAddress(address));
          addressVariants.add(bchaddr.toLegacyAddress(address));
        } catch { /* invalid address, just use original */ }
      }

      for (const output of txData.vout) {
        const spk = output.scriptPubKey;
        if (!spk) continue;

        // Collect all address representations from the output
        const outputAddresses: string[] = [];

        // 1. scriptPubKey.addresses (array — legacy/P2SH)
        if (Array.isArray(spk.addresses)) {
          outputAddresses.push(...spk.addresses);
        }

        // 2. scriptPubKey.address (singular — SegWit/bech32 in modern APIs)
        if (typeof spk.address === 'string' && spk.address) {
          outputAddresses.push(spk.address);
        }

        // 3. FIX: Parse address from scriptPubKey.desc field (e.g., "addr(bc1q...)#checksum")
        if (typeof spk.desc === 'string' && spk.desc) {
          const descMatch = spk.desc.match(/addr\(([^)]+)\)/);
          if (descMatch && descMatch[1]) {
            outputAddresses.push(descMatch[1]);
          }
        }

        // 4. FIX: Parse address from scriptPubKey.asm for witness programs
        // SegWit v0: "0 <20-byte-hash>" or "0 <32-byte-hash>"
        // SegWit v1 (taproot): "1 <32-byte-hash>"
        if (typeof spk.asm === 'string' && spk.asm && outputAddresses.length === 0) {
          // If no addresses found yet, try to decode from asm (last resort)
          cronLogger.info(`[findUtxoOutputIndex] Output ${output.n} has no parsed addresses, asm: ${spk.asm.substring(0, 60)}`);
        }

        // Case-insensitive matching
        const matched = outputAddresses.some((a: string) => {
          const aLower = a.toLowerCase();
          return addressVariants.has(a) || addressVariants.has(aLower);
        });

        if (matched) {
          const idx = output.n ?? 0;
          cronLogger.info(`[findUtxoOutputIndex] Found output index ${idx} for ${address} in tx ${txHash}`);
          return idx;
        }
      }

      // FIX BUG-9: Log actual vout data for debugging when no match found
      const voutSummary = txData.vout.map((o, i) => {
        const spk = o.scriptPubKey;
        const addrs = [
          ...(spk?.addresses || []),
          ...(typeof spk?.address === 'string' ? [spk.address] : []),
        ];
        const desc = spk?.desc ? ` desc=${spk.desc.substring(0, 50)}` : '';
        return `vout[${o.n ?? i}]: value=${o.value}, addrs=[${addrs.join(',')}]${desc}`;
      });
      cronLogger.warn(
        `[findUtxoOutputIndex] ⚠️ Could not find output for ${address} in tx ${txHash}. ` +
        `Outputs: ${voutSummary.join(' | ')}`
      );
    } else {
      // Diagnostic logging (2026-04-12): Log exactly what Tatum returned so we can
      // track whether this is indexer lag, null response, or changed API shape.
      const txDataType = txData === null ? 'null' : txData === undefined ? 'undefined' : typeof txData;
      const txDataKeys = txData && typeof txData === 'object' ? Object.keys(txData) : [];
      const txDataSnippet = txData ? JSON.stringify(txData).substring(0, 500) : String(txData);
      cronLogger.warn(
        `[findUtxoOutputIndex] No vout data in tx ${txHash} for ${currency}. ` +
        `Tatum response diagnostic: type=${txDataType}, keys=[${txDataKeys.join(',')}], ` +
        `snippet=${txDataSnippet}`
      );

      // Fallback chain for BTC: mempool.space → blockstream.info
      if (currency === 'BTC') {
        // Fallback 1: mempool.space
        try {
          cronLogger.info(`[findUtxoOutputIndex] Attempting mempool.space fallback for BTC tx ${txHash}`);
          const mempoolResponse = await fetch(`https://mempool.space/api/tx/${txHash}`);
          if (mempoolResponse.ok) {
            const mempoolTx = await mempoolResponse.json() as {
              vout?: Array<{ value?: number; scriptpubkey_address?: string; n?: number }>;
            };
            if (mempoolTx?.vout) {
              const addressLower = address.toLowerCase();
              for (let i = 0; i < mempoolTx.vout.length; i++) {
                const output = mempoolTx.vout[i];
                if (output.scriptpubkey_address && output.scriptpubkey_address.toLowerCase() === addressLower) {
                  cronLogger.info(`[findUtxoOutputIndex] ✅ mempool.space fallback: Found output index ${i} for ${address} in tx ${txHash}`);
                  return i;
                }
              }
              cronLogger.warn(`[findUtxoOutputIndex] mempool.space: Address ${address} not found in ${mempoolTx.vout.length} outputs of tx ${txHash}`);
            }
          } else {
            cronLogger.warn(`[findUtxoOutputIndex] mempool.space returned ${mempoolResponse.status} for tx ${txHash}`);
          }
        } catch (fallbackErr: unknown) {
          const fbErr = fallbackErr as { message?: string };
          cronLogger.warn(`[findUtxoOutputIndex] mempool.space fallback failed: ${fbErr.message}`);
        }

        // Fallback 2: blockstream.info (independent infrastructure from mempool.space)
        try {
          cronLogger.info(`[findUtxoOutputIndex] Attempting blockstream.info fallback for BTC tx ${txHash}`);
          const blockstreamResponse = await fetch(`https://blockstream.info/api/tx/${txHash}`);
          if (blockstreamResponse.ok) {
            const blockstreamTx = await blockstreamResponse.json() as {
              vout?: Array<{ value?: number; scriptpubkey_address?: string }>;
            };
            if (blockstreamTx?.vout) {
              const addressLower = address.toLowerCase();
              for (let i = 0; i < blockstreamTx.vout.length; i++) {
                const output = blockstreamTx.vout[i];
                if (output.scriptpubkey_address && output.scriptpubkey_address.toLowerCase() === addressLower) {
                  cronLogger.info(`[findUtxoOutputIndex] ✅ blockstream.info fallback: Found output index ${i} for ${address} in tx ${txHash}`);
                  return i;
                }
              }
              cronLogger.warn(`[findUtxoOutputIndex] blockstream.info: Address ${address} not found in outputs of tx ${txHash}`);
            }
          } else {
            cronLogger.warn(`[findUtxoOutputIndex] blockstream.info returned ${blockstreamResponse.status} for tx ${txHash}`);
          }
        } catch (fallbackErr: unknown) {
          const fbErr = fallbackErr as { message?: string };
          cronLogger.warn(`[findUtxoOutputIndex] blockstream.info fallback failed: ${fbErr.message}`);
        }
      }

      // Fallback for LTC: blockcypher.com
      if (currency === 'LTC') {
        try {
          cronLogger.info(`[findUtxoOutputIndex] Attempting blockcypher.com fallback for LTC tx ${txHash}`);
          const bcResponse = await fetch(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}`);
          if (bcResponse.ok) {
            const bcTx = await bcResponse.json() as {
              outputs?: Array<{ value?: number; addresses?: string[] }>;
            };
            if (bcTx?.outputs) {
              const addressLower = address.toLowerCase();
              for (let i = 0; i < bcTx.outputs.length; i++) {
                const output = bcTx.outputs[i];
                const matchesAddr = output.addresses?.some(
                  (a: string) => a.toLowerCase() === addressLower
                );
                if (matchesAddr) {
                  cronLogger.info(`[findUtxoOutputIndex] ✅ blockcypher.com fallback: Found output index ${i} for ${address} in LTC tx ${txHash}`);
                  return i;
                }
              }
            }
          }
        } catch (fallbackErr: unknown) {
          const fbErr = fallbackErr as { message?: string };
          cronLogger.warn(`[findUtxoOutputIndex] blockcypher.com LTC fallback failed: ${fbErr.message}`);
        }
      }

      // Fallback for DOGE: blockcypher.com
      if (currency === 'DOGE') {
        try {
          cronLogger.info(`[findUtxoOutputIndex] Attempting blockcypher.com fallback for DOGE tx ${txHash}`);
          const bcResponse = await fetch(`https://api.blockcypher.com/v1/doge/main/txs/${txHash}`);
          if (bcResponse.ok) {
            const bcTx = await bcResponse.json() as {
              outputs?: Array<{ value?: number; addresses?: string[] }>;
            };
            if (bcTx?.outputs) {
              const addressLower = address.toLowerCase();
              for (let i = 0; i < bcTx.outputs.length; i++) {
                const output = bcTx.outputs[i];
                const matchesAddr = output.addresses?.some(
                  (a: string) => a.toLowerCase() === addressLower
                );
                if (matchesAddr) {
                  cronLogger.info(`[findUtxoOutputIndex] ✅ blockcypher.com fallback: Found output index ${i} for ${address} in DOGE tx ${txHash}`);
                  return i;
                }
              }
            }
          }
        } catch (fallbackErr: unknown) {
          const fbErr = fallbackErr as { message?: string };
          cronLogger.warn(`[findUtxoOutputIndex] blockcypher.com DOGE fallback failed: ${fbErr.message}`);
        }
      }
    }

    // FIX BUG-9: Return -1 instead of 0 so callers can detect "not found" vs "index 0"
    // Callers should handle -1 by falling back to scanning all outputs or using index 0 cautiously
    return -1;
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[findUtxoOutputIndex] Failed to lookup UTXO index for ${txHash}: ${err.message}`);
    return -1;
  }
};

/**
 * Fetch actual on-chain gas cost for a confirmed transaction.
 * Returns gas cost in the native token (ETH for ERC20, TRX for TRC20, etc.)
 */
const getTransactionGasCost = async (
  txHash: string,
  currency: string
): Promise<{ gasCostNative: number; gasToken: string }> => {
  const tatumSdk = await getTatumSDK();

  try {
    if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD-ERC20") {
      const txData = await tatumSdk.blockchain.eth.ethGetTransaction(txHash) as Record<string, unknown>;
      const gasUsed = Number(txData?.gasUsed || 0);
      const gasPriceWei = Number(txData?.gasPrice || 0);
      const gasCostEth = (gasUsed * gasPriceWei) / 1e18;
      cronLogger.info(`[getTransactionGasCost] ETH TX ${txHash}: gasUsed=${gasUsed}, gasPrice=${gasPriceWei} wei, cost=${gasCostEth} ETH`);
      return { gasCostNative: gasCostEth, gasToken: "ETH" };
    }

    if (currency === "TRX" || currency === "USDT-TRC20") {
      const txData = await tatumSdk.blockchain.tron.tronGetTransaction(txHash) as Record<string, unknown>;
      const ret = (txData?.ret as Array<Record<string, unknown>>) || [];
      const feeSun = Number(ret[0]?.fee || 0);
      const gasCostTrx = feeSun / 1_000_000;
      cronLogger.info(`[getTransactionGasCost] TRX TX ${txHash}: fee=${feeSun} SUN, cost=${gasCostTrx} TRX`);
      return { gasCostNative: gasCostTrx, gasToken: "TRX" };
    }

    if (currency === "POLYGON" || currency === "USDT-POLYGON") {
      const txData = await tatumSdk.blockchain.polygon.polygonGetTransaction(txHash) as Record<string, unknown>;
      const gasUsed = Number(txData?.gasUsed || 0);
      const gasPriceWei = Number(txData?.gasPrice || 0);
      const gasCostPol = (gasUsed * gasPriceWei) / 1e18;
      cronLogger.info(`[getTransactionGasCost] POLYGON TX ${txHash}: gasUsed=${gasUsed}, gasPrice=${gasPriceWei} wei, cost=${gasCostPol} POL`);
      return { gasCostNative: gasCostPol, gasToken: "POLYGON" };
    }

    if (currency === "XRP" || currency === "RLUSD") {
      // XRP fees are typically 12 drops (0.000012 XRP) — fixed and minimal
      return { gasCostNative: 0.000012, gasToken: "XRP" };
    }

    if (currency === "SOL") {
      // Solana fees are typically 5000 lamports (0.000005 SOL) — fixed and minimal
      return { gasCostNative: 0.000005, gasToken: "SOL" };
    }

    cronLogger.info(`[getTransactionGasCost] Unsupported currency ${currency} for gas cost lookup`);
    return { gasCostNative: 0, gasToken: currency };
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[getTransactionGasCost] Failed to fetch gas cost for ${txHash}: ${err.message}`);
    return { gasCostNative: 0, gasToken: currency };
  }
};

// ============================================================
// XRPL Trust Line Helpers
// Primary: Tatum SDK xrpTrustLineBlockchain
// Fallback: Local signing (xrpl lib) + Tatum RPC gateway submit
// The Tatum SDK endpoint POST /v3/xrp/trust intermittently fails
// with "xrp.sign.failed: Unable to communicate with blockchain"
// when their internal XRP node is unreachable. The fallback signs
// locally and submits via Tatum's RPC gateway (ripple-mainnet),
// keeping everything within the Tatum infrastructure.
// ============================================================
import { Wallet as XrplWallet } from "xrpl";

const TATUM_XRP_RPC_CHAIN = isTestnet() ? "ripple-testnet" : "ripple-mainnet";

/**
 * Call Tatum RPC gateway for XRP Ledger JSON-RPC methods
 */
const tatumXrpRpc = async (method: string, params: any[] = [{}]): Promise<any> => {
  const tatumKey = await getTatumKey();
  const res = await axios.post(
    `https://api.tatum.io/v3/blockchain/node/${TATUM_XRP_RPC_CHAIN}`,
    { method, params },
    { headers: { "x-api-key": tatumKey, "Content-Type": "application/json" }, timeout: 15000 }
  );
  if (res.data?.result?.error) {
    throw new Error(`XRP RPC ${method}: ${res.data.result.error_message || res.data.result.error}`);
  }
  return res.data?.result;
};

/**
 * Check if an XRP account is activated on the ledger (has been funded with base reserve).
 * Uses Tatum SDK as primary, Tatum RPC as fallback.
 */
const verifyXrpAccountActivated = async (address: string): Promise<boolean> => {
  // Try Tatum SDK first
  try {
    const tatumSdk = await getTatumSDK();
    const res = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
    return res && Number(res.balance || 0) > 0;
  } catch (e: unknown) {
    const err = e as { message?: string; body?: { errorCode?: string; message?: string }; status?: number };
    const errMsg = (err.message || '').toLowerCase();
    const bodyMsg = (err.body?.message || '').toLowerCase();
    const errorCode = (err.body?.errorCode || '').toLowerCase();
    // Account not found / not activated — definitively not activated
    if (errMsg.includes('not.found') || errMsg.includes('account.not.found') ||
        errMsg.includes('account not found') || bodyMsg.includes('account not found') ||
        errorCode.includes('account.failed') || err.status === 403) {
      return false;
    }
    // SDK failed for non-obvious reason — try RPC fallback
  }

  // Fallback: Tatum RPC gateway
  try {
    const result = await tatumXrpRpc("account_info", [{ account: address, ledger_index: "validated" }]);
    const balance = Number(result?.account_data?.Balance || 0);
    return balance > 0;
  } catch (e: unknown) {
    const err = e as { message?: string };
    const errMsg = (err.message || '').toLowerCase();
    if (errMsg.includes('actnotfound') || errMsg.includes('account not found') || errMsg.includes('not found')) {
      return false;
    }
    // Both failed, but don't log loudly — caller should handle gracefully
    cronLogger.info(`[verifyXrpAccountActivated] SDK+RPC both failed for ${address.substring(0, 12)}... — treating as not activated`);
    return false;
  }
};

/**
 * Verify that an XRP trust line exists for a given token/issuer.
 * Uses Tatum SDK as primary, Tatum RPC account_lines as fallback.
 */
const verifyXrpTrustLine = async (address: string, issuerAccount: string, currencyHex: string): Promise<boolean> => {
  // Helper to check trust line in an array of line objects
  const matchesTrustLine = (lines: any[]): boolean => {
    for (const line of lines) {
      const curr = (line.currency || '').toUpperCase();
      if (curr.startsWith('524C5553') || curr === 'RLUSD') {
        return true;
      }
    }
    return false;
  };

  // Use unified SDK-to-RPC fallback pattern
  return withSdkFallback(
    async () => {
      const tatumSdk = await getTatumSDK();
      const res = await tatumSdk.blockchain.xrp.xrpGetAccountBalance(address);
      const resAny = res as any;
      if (resAny?.obligations && matchesTrustLine(resAny.obligations)) return true;
      if (resAny?.assets && matchesTrustLine(resAny.assets)) return true;
      return false;
    },
    async () => {
      const result = await tatumXrpRpc("account_lines", [{ account: address, ledger_index: "validated" }]);
      const lines = result?.lines || [];
      return matchesTrustLine(lines);
    },
    { operation: 'verifyTrustLine', chain: 'XRP', address }
  ).catch((e: unknown) => {
    const err = e as { message?: string };
    if ((err.message || '').includes('actNotFound')) return false;
    cronLogger.warn(`[verifyXrpTrustLine] Both SDK and RPC failed for ${address}:`, err.message);
    return false;
  });
};

/**
 * Set up XRP Trust Line for RLUSD token on a new XRP address.
 * Required before the address can receive RLUSD tokens.
 *
 * Strategy:
 *   1) Try Tatum SDK xrpTrustLineBlockchain (POST /v3/xrp/trust)
 *   2) If Tatum fails (xrp.sign.failed), fall back to:
 *      - Build TrustSet transaction JSON
 *      - Sign locally using xrpl Wallet
 *      - Submit via Tatum RPC gateway (ripple-mainnet)
 */
const setupXrpTrustLine = async (
  fromAccount: string,
  fromSecret: string,
  issuerAccount: string,
  token: string,
  limit: string = "999999999"
) => {
  // ---- Attempt 1: Tatum SDK ----
  try {
    const tatumSdk = await getTatumSDK();
    const result = await tatumSdk.blockchain.xrp.xrpTrustLineBlockchain({
      fromAccount,
      fromSecret,
      issuerAccount,
      token,
      limit,
    });
    cronLogger.info(`[setupXrpTrustLine] ✅ Trust line set via Tatum SDK for ${fromAccount} → ${issuerAccount} (${token})`);
    return result;
  } catch (sdkError: unknown) {
    const sdkErr = sdkError as { message?: string; body?: any };
    const errMsg = sdkErr?.message || JSON.stringify(sdkErr?.body) || String(sdkError);
    cronLogger.warn(`[setupXrpTrustLine] Tatum SDK failed: ${errMsg}. Falling back to Tatum RPC + local signing...`);
  }

  // ---- Attempt 2: Local sign + Tatum RPC gateway ----
  try {
    // 2a. Get account info from Tatum RPC (sequence number)
    const accountInfo = await tatumXrpRpc("account_info", [{ account: fromAccount, ledger_index: "current" }]);
    const sequence = accountInfo?.account_data?.Sequence;
    if (!sequence) {
      throw new Error(`Could not get sequence for ${fromAccount} — account may not be activated`);
    }

    // 2b. Get current fee from Tatum RPC
    const feeResult = await tatumXrpRpc("fee", [{}]);
    const baseFee = feeResult?.drops?.open_ledger_fee || feeResult?.drops?.minimum_fee || "12";

    // 2c. Get current validated ledger for LastLedgerSequence
    const serverInfo = await tatumXrpRpc("server_info", [{}]);
    const currentLedger = serverInfo?.info?.validated_ledger?.seq || 0;

    // 2d. Build the TrustSet transaction
    const trustSetTx: Record<string, any> = {
      TransactionType: "TrustSet",
      Account: fromAccount,
      LimitAmount: {
        currency: token,
        issuer: issuerAccount,
        value: limit,
      },
      Fee: String(Math.max(Number(baseFee), 12)),
      Sequence: sequence,
      LastLedgerSequence: currentLedger + 20,  // ~60-100 seconds to confirm
    };

    cronLogger.info(`[setupXrpTrustLine] Built TrustSet tx: Seq=${sequence}, Fee=${trustSetTx.Fee}, LastLedger=${trustSetTx.LastLedgerSequence}`);

    // 2e. Sign locally with xrpl Wallet
    const wallet = XrplWallet.fromSecret(fromSecret);
    if (wallet.address !== fromAccount) {
      cronLogger.warn(`[setupXrpTrustLine] Derived address ${wallet.address} differs from ${fromAccount}, using derived`);
      trustSetTx.Account = wallet.address;
    }

    // Encode, sign, and serialize
    const txBlob = wallet.sign(trustSetTx as any);

    // 2f. Submit via Tatum RPC gateway
    const submitResult = await tatumXrpRpc("submit", [{ tx_blob: txBlob.tx_blob }]);
    const engineResult = submitResult?.engine_result || "unknown";
    const txHash = submitResult?.tx_json?.hash || "unknown";

    if (engineResult === "tesSUCCESS" || engineResult === "terQUEUED") {
      cronLogger.info(`[setupXrpTrustLine] ✅ Trust line set via Tatum RPC for ${fromAccount} → ${issuerAccount} (${token}), engine=${engineResult}, hash=${txHash}`);
      return { txId: txHash, status: engineResult };
    } else {
      cronLogger.error(`[setupXrpTrustLine] ❌ TrustSet submit returned ${engineResult}: ${submitResult?.engine_result_message || ''}`);
      throw new Error(`TrustSet submit failed: ${engineResult} — ${submitResult?.engine_result_message || 'no message'}`);
    }
  } catch (rpcError: unknown) {
    const rpcErr = rpcError as { message?: string };
    cronLogger.error(`[setupXrpTrustLine] ❌ Tatum RPC fallback also failed:`, rpcErr?.message || rpcError);
    throw rpcError;
  }
};

/**
 * Get the destination tag from an XRP Ledger transaction.
 * Uses Tatum RPC gateway to fetch full transaction details.
 * 
 * The Tatum ADDRESS_EVENT webhook does NOT include the destination tag,
 * so we must fetch the full transaction to extract it.
 */
const getXrpDestinationTag = async (txId: string): Promise<number | null> => {
  try {
    const result = await tatumXrpRpc("tx", [{ transaction: txId, binary: false }]);
    const tag = result?.DestinationTag;
    if (tag !== undefined && tag !== null) {
      return Number(tag);
    }
    return null;
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[getXrpDestinationTag] Failed to fetch tx ${txId}:`, err?.message || error);
    return null;
  }
};

export default {
  generateWallet,
  createVirtualAccount,
  getAllAccounts,
  generateUserAddress,
  createSubscription,
  createSubscriptionWithUrl,
  createSubscriptionBlockBeeStyle,
  getBitcoinAddress,
  deleteUserAddress,
  sendFeeToAdmin,
  deleteSubscription,
  listAllSubscriptions,
  feeEstimation,
  batchFeeEstimation,
  generatePrivatekey,
  assetToOtherAddress,
  assetBatchAddressesToOtherAddress,
  testingFunction,
  getAddressBalance,
  validateTronAddress,
  getCurrentPaymentStatus,
  getIncomingTransactions,
  getTransactionConfirmations,
  encryptSymmetric,
  decryptSymmetric,
  waitForTransactionConfirmation,
  getTransactionGasCost,
  findUtxoOutputIndex,
  setupXrpTrustLine,
  verifyXrpAccountActivated,
  verifyXrpTrustLine,
  getXrpDestinationTag,
  tatumXrpRpc,
  getTatumHeaders,
};
