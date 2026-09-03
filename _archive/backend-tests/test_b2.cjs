// Test B2: Check if admin fee wallet is NOT activated for USDT (0 balance)
const dotenv = require('dotenv');
dotenv.config();

const { isRecipientActivatedForToken } = require('./services/tronEnergyService');

const ADMIN_FEE_WALLET = "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR";
const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

(async () => {
  try {
    const result = await isRecipientActivatedForToken(
      ADMIN_FEE_WALLET,
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
