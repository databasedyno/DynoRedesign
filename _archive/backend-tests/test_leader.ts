import * as le from './utils/leaderElection';

console.log('Module loaded successfully');
console.log('Exports:', Object.keys(le));
const hasAll = !!(le.startLeaderElection && le.stopLeaderElection && le.isLeader && le.getInstanceId);
console.log('Has all required exports:', hasAll);
const isLeaderVal = le.isLeader();
console.log('isLeader():', isLeaderVal);
const instanceId = le.getInstanceId();
console.log('getInstanceId():', instanceId);
const pass = hasAll && isLeaderVal === false && instanceId && instanceId.length > 0;
console.log('Test pass:', pass);
process.exit(pass ? 0 : 1);
