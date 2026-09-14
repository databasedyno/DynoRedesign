// Test A2: Check module exports
const dotenv = require('dotenv');
dotenv.config();

// Suppress Winston logger output for cleaner test output
process.env.LOG_LEVEL = 'error';

const service = require('./services/tronEnergyService');

const requiredExports = [
  'isRecipientActivatedForToken',
  'markRecipientActivated',
  'calculateOptimalFeeLimit',
  'calculateDynamicTRC20Fee'
];

const missing = requiredExports.filter(e => typeof service[e] !== 'function');
if (missing.length > 0) {
  console.log('MISSING_EXPORTS:', missing.join(','));
  process.exit(1);
}

console.log('ALL_EXPORTS_PRESENT');
process.exit(0);
