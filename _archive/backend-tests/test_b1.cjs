// Test B1: Check if Binance hot wallet is activated for USDT
const dotenv = require('dotenv');
dotenv.config();

const { isRecipientActivatedForToken } = require('./services/tronEnergyService');

const BINANCE_HOT_WALLET = "TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

(async () => {
  try {
    const result = await isRecipientActivatedForToken(
      BINANCE_HOT_WALLET,
      USDT_CONTRACT
    );
    console.log('RESULT:', result);
    console.log('TYPE:', typeof result);
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
