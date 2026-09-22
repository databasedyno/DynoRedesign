// Quick test of renderMoneyPath for same-wallet mode
import { renderMoneyPath } from './services/email/paymentSettled';

const testCases = [
  {
    name: "Same-wallet mode (deducted)",
    input: {
      grossCrypto: "263.6",
      netCrypto: "250",
      feeCrypto: "10",
      networkFeeCrypto: "3.6",
      networkFeeNative: "13.0285 TRX",
      asset: "USDT-TRC20",
      sameWallet: true,
      destinationAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      forwardTxHash: "abc123",
      detectedAt: new Date().toISOString(),
    }
  },
  {
    name: "Normal mode (deducted)",
    input: {
      grossCrypto: "263.6",
      netCrypto: "250",
      feeCrypto: "10",
      networkFeeCrypto: "3.6",
      networkFeeNative: "13.0285 TRX",
      asset: "USDT-TRC20",
      sameWallet: false,
      destinationAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      forwardTxHash: "abc123",
      detectedAt: new Date().toISOString(),
    }
  },
  {
    name: "Covered by Dynopay",
    input: {
      grossCrypto: "263.6",
      netCrypto: "263.6",
      feeCrypto: "0",
      networkFeeCrypto: null,
      networkFeeCovered: true,
      asset: "USDT-TRC20",
      sameWallet: false,
      destinationAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      forwardTxHash: "abc123",
      detectedAt: new Date().toISOString(),
    }
  },
];

console.log("Testing renderMoneyPath...\n");

for (const tc of testCases) {
  console.log(`\n=== ${tc.name} ===`);
  try {
    const html = renderMoneyPath("en", tc.input as any);
    
    // Check for key phrases
    const checks = [
      { phrase: "Forwarded to you", expected: tc.input.sameWallet },
      { phrase: "Includes the", expected: tc.input.sameWallet },
      { phrase: "covered by Dynopay", expected: tc.input.networkFeeCovered === true },
      { phrase: "on-chain", expected: !!tc.input.networkFeeNative },
    ];
    
    for (const check of checks) {
      const found = html.includes(check.phrase);
      const status = found === check.expected ? "✅" : "❌";
      console.log(`${status} "${check.phrase}": found=${found}, expected=${check.expected}`);
    }
    
    // Show a snippet
    console.log("\nHTML snippet:");
    console.log(html.slice(0, 500) + "...");
  } catch (err) {
    console.error(`❌ Error: ${(err as Error).message}`);
  }
}
