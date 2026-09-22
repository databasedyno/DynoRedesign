/**
 * Live ETH fee-path test: send a tiny amount from the ETH fee wallet to ITSELF through the
 * production payout path (feeEstimation → assetToOtherAddress → ethers.js EIP-1559) and
 * report the gas actually paid.
 *   npx ts-node --transpile-only scripts/eth_live_fee_test.ts            # estimate only
 *   npx ts-node --transpile-only scripts/eth_live_fee_test.ts --send     # broadcast 0.0001 ETH
 */
import "dotenv/config";
import { ethers } from "ethers";
import sequelize from "../utils/dbInstance";
import { connectRedis } from "../utils/redisInstance";
import { raw as envRaw } from "../utils/config";
import tatumApi from "../apis/tatumApi";
import * as keyCustody from "../services/keyCustody/keyCustodyService";
import { adminFeeModel } from "../models";
import { getRpcUrls } from "../services/merchantPool/directEvmTransfer";

const SEND = process.argv.includes("--send");
const AMOUNT = 0.0001;

(async () => {
  await connectRedis();
  const feeWalletAddress = envRaw("ETH_FEE_WALLET");
  const feeWallet = await adminFeeModel.findOne({ where: { wallet_type: "ETH" } });
  if (!feeWallet || !feeWalletAddress) throw new Error("ETH fee wallet not configured");

  const provider = new ethers.JsonRpcProvider(getRpcUrls("ETH")[0], 1, { staticNetwork: ethers.Network.from(1) });
  const before = await provider.getBalance(feeWalletAddress);
  console.log(`fee wallet ${feeWalletAddress} balance ${ethers.formatEther(before)} ETH`);

  const fees = await tatumApi.feeEstimation("ETH", feeWalletAddress, feeWalletAddress, AMOUNT);
  console.log("quote:", JSON.stringify(fees));
  if (!SEND) { console.log("estimate only (pass --send to broadcast)"); await sequelize.close(); process.exit(0); }

  const tx = await keyCustody.withPrivateKey(
    feeWallet.dataValues.privateKey,
    envRaw("TEMP_KEY_ID"),
    { purpose: "gas_funding", actor: "admin", walletType: "ETH", walletAddress: feeWalletAddress },
    (privateKey) => tatumApi.assetToOtherAddress({
      currency: "ETH", fromAddress: feeWalletAddress, toAddress: feeWalletAddress, privateKey, amount: AMOUNT, fee: fees,
    })
  );
  console.log("broadcast:", JSON.stringify(tx));

  const receipt = await provider.waitForTransaction(tx.txId, 1, 300000);
  const effective = receipt?.gasPrice ?? 0n;
  const paidWei = effective * (receipt?.gasUsed ?? 0n);
  const after = await provider.getBalance(feeWalletAddress);
  console.log(JSON.stringify({
    txHash: tx.txId,
    block: receipt?.blockNumber,
    status: receipt?.status,
    gasUsed: receipt?.gasUsed?.toString(),
    effectiveGasPriceGwei: ethers.formatUnits(effective, "gwei"),
    paidEth: ethers.formatEther(paidWei),
    quotedEth: fees.fast,
    balanceDeltaEth: ethers.formatEther(before - after),
    explorer: `https://etherscan.io/tx/${tx.txId}`,
  }, null, 2));
  await sequelize.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
