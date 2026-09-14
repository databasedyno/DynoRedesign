import * as sweep from './services/merchantPool/merchantPoolSweep';

console.log('Module loaded successfully');
console.log('Exports:', Object.keys(sweep));
const hasAll = !!(sweep.sweepPoolAddress && sweep.sweepByThreshold && sweep.performScheduledSweeps);
console.log('Has all required exports:', hasAll);
process.exit(hasAll ? 0 : 1);
