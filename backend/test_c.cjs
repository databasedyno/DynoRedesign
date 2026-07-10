// Test C: calculateOptimalFeeLimit with activated recipient
const dotenv = require('dotenv');
dotenv.config();

const { calculateOptimalFeeLimit } = require('./services/tronEnergyService');

const SENDER = "TMHECc7emykw5XwX2njp5Y2K4FXLwsTZtC";
const BINANCE_HOT_WALLET = "TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

(async () => {
  try {
    const result = await calculateOptimalFeeLimit(
      SENDER,
      BINANCE_HOT_WALLET,
      USDT_CONTRACT
    );
    console.log('RESULT:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
