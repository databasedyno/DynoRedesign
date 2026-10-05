// T2 SafeDeal address 102 verify via signed message
const { Wallet } = require('ethers');

const BASE = 'https://vault-setup-17.preview.emergentagent.com';
const SD_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJraW5kIjoic2FmZWRlYWwiLCJjaWQiOjk1NiwiY29pZCI6MjYyLCJlbWFpbCI6InNkLXdhbGxldC1zbW9rZS0xNzkwMTgwNDU0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzkwMTgxNDU5LCJleHAiOjE3OTA3ODYyNTl9.A3GjzhIRtlXrI2rYU-5pPpbxtCZ6jfqIua9kNEfJYw4';
const PRIV = '0x908178c7bdfbef96c0823cb4ebee85d8994f7e4724b4e4194ac042ef3a587260';

(async () => {
  try {
    // 1. CSRF token
    const csrfRes = await fetch(`${BASE}/api/csrf-token`, { headers: { origin: BASE } });
    const csrfSetCookie = csrfRes.headers.get('set-cookie') || '';
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken || csrfData.data?.csrfToken || csrfData.csrf_token || csrfData.data?.csrf_token;
    console.log('CSRF token:', csrfToken ? csrfToken.slice(0, 12) + '...' : 'MISSING');
    // Extract cookie value(s)
    const cookieHeader = csrfSetCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
    console.log('Cookie:', cookieHeader.slice(0, 80));

    const headers = {
      'content-type': 'application/json',
      'x-safedeal-token': SD_TOKEN,
      'x-csrf-token': csrfToken,
      'cookie': cookieHeader,
      'origin': BASE,
    };

    // 2. Nonce
    const nonceRes = await fetch(`${BASE}/api/safedeal/wallet/addresses/102/verify-nonce`, {
      method: 'POST', headers, body: JSON.stringify({}),
    });
    const nonceJson = await nonceRes.json();
    console.log('Nonce status:', nonceRes.status, JSON.stringify(nonceJson).slice(0, 300));
    if (!nonceRes.ok) process.exit(1);
    const { nonce, message } = nonceJson.data || nonceJson;

    // 3. Sign
    const wallet = new Wallet(PRIV);
    const signature = await wallet.signMessage(message);
    console.log('Signer:', wallet.address, 'sig:', signature.slice(0, 20) + '...');

    // 4. Verify
    const verifyRes = await fetch(`${BASE}/api/safedeal/wallet/addresses/102/verify`, {
      method: 'POST', headers,
      body: JSON.stringify({ nonce, signature, wallet_name: 'MetaMask' }),
    });
    const verifyJson = await verifyRes.json();
    console.log('Verify status:', verifyRes.status, JSON.stringify(verifyJson).slice(0, 300));
    process.exit(verifyRes.ok ? 0 : 2);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(3);
  }
})();
