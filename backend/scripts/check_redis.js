const Redis = require('ioredis');
const redis = new Redis('redis://default:nGRWpSIBrXftcfgRCQDxtAJGowmXlgUg@turntable.proxy.rlwy.net:21752', {
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

async function main() {
  console.log('Connecting to Redis...');
  
  const keys = [
    'crypto-TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf',
    'payment-1bbf0a66-c0be-4006-a6a1-b59fc20518b2',
  ];
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const parsed = JSON.parse(data);
      console.log('\nFound key:', key);
      console.log('Has privateKey:', !!(parsed.privateKey || parsed.private_key));
      console.log('Status:', parsed.status);
      console.log('Currency:', parsed.currency);
      console.log('hasTxId:', parsed.hasTxId);
      console.log('receivedAmount:', parsed.receivedAmount);
      console.log('Data keys:', Object.keys(parsed).join(', '));
      
      // Print privateKey existence but NOT the value
      if (parsed.privateKey) console.log('privateKey length:', parsed.privateKey.length);
      if (parsed.private_key) console.log('private_key length:', parsed.private_key.length);
    } else {
      console.log('Key not found:', key);
    }
  }
  
  // Scan for any keys matching the address
  const scanKeys = await redis.keys('*TPyhJAKj*');
  console.log('\nScan for TPyhJAKj:', scanKeys);
  
  // Also check merchant pool keys
  const poolKeys = await redis.keys('*pool*address*');
  console.log('Pool address keys count:', poolKeys.length);
  
  redis.disconnect();
}

main().catch(e => { console.error(e.message); redis.disconnect(); process.exit(1); });
