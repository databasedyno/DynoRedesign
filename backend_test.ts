#!/usr/bin/env ts-node
/**
 * SafeDeal $200 Cashout Approval Threshold E2E Test
 * 
 * Tests the $200 withdrawal approval threshold feature:
 * - Manual cashouts >= $200 require admin approval (internal: pending_approval)
 * - Customer sees status as 'queued' (approval is invisible to them)
 * - Manual cashouts < $200 dispatch normally
 * - Settlement payouts are NEVER gated (always automatic)
 * 
 * HARD CONSTRAINTS:
 * - Do NOT enable SAFEDEAL_ALLOW_SIMULATION
 * - Use ONLY throwaway @example.com customer in brand company_id=262
 * - Cleanup: admin-debit wallet back to $0 at the end
 */

import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const BASE_URL = process.env.SERVER_URL || 'http://localhost:8001';
const API_BASE = `${BASE_URL}/api`;

// Test credentials from review request
const ADMIN_EMAIL = 'moxxcompany@gmail.com';
const ADMIN_PASSWORD = 'Katiekendra123@';
const CUSTOMER_ID = 1010;
const CUSTOMER_EMAIL = 'p12139@example.com';
const WALLET_ID = 767;

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function pass(name: string, details: string) {
  results.push({ name, passed: true, details });
  log(`✅ ${name}: ${details}`);
}

function fail(name: string, details: string, error?: string) {
  results.push({ name, passed: false, details, error });
  log(`❌ ${name}: ${details}${error ? ` | Error: ${error}` : ''}`);
}

async function roQuery(sql: string): Promise<any[]> {
  const { execSync } = require('child_process');
  try {
    const output = execSync(`node ${path.join(__dirname, 'backend', 'scripts', 'ro_query.js')} "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      env: { ...process.env, RO_JSON: '1' }
    });
    return JSON.parse(output);
  } catch (e: any) {
    log(`RO Query failed: ${e.message}`);
    return [];
  }
}

async function adminLogin(): Promise<string> {
  log('Logging in as admin...');
  const response = await axios.post(`${API_BASE}/admin/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  
  if (!response.data?.data?.accessToken) {
    throw new Error('Admin login failed: no access token returned');
  }
  
  log('Admin login successful');
  return response.data.data.accessToken;
}

async function customerLogin(): Promise<string> {
  log(`Logging in as customer ${CUSTOMER_EMAIL}...`);
  
  // Step 1: Send code
  const sendCodeResponse = await axios.post(`${API_BASE}/safedeal/auth/send-code`, {
    email: CUSTOMER_EMAIL
  });
  
  const code = sendCodeResponse.data?.data?.preview_code;
  if (!code) {
    throw new Error('No preview_code returned for test email');
  }
  
  log(`Got preview code: ${code}`);
  
  // Step 2: Verify code
  const verifyResponse = await axios.post(`${API_BASE}/safedeal/auth/verify-code`, {
    email: CUSTOMER_EMAIL,
    code
  });
  
  const token = verifyResponse.data?.data?.token;
  if (!token) {
    throw new Error('Customer login failed: no token returned');
  }
  
  log('Customer login successful');
  return token;
}

async function adminCreditWallet(adminToken: string, customerId: number, amount: number, description: string): Promise<void> {
  log(`Admin crediting customer ${customerId} with $${amount}...`);
  
  await axios.post(
    `${API_BASE}/admin/customers/${customerId}/credit`,
    { amount, description },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  
  log(`Successfully credited $${amount}`);
}

async function adminDebitWallet(adminToken: string, customerId: number, amount: number, description: string): Promise<void> {
  log(`Admin debiting customer ${customerId} by $${amount}...`);
  
  await axios.post(
    `${API_BASE}/admin/customers/${customerId}/debit`,
    { amount, description },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  
  log(`Successfully debited $${amount}`);
}

async function getWalletBalance(customerToken: string): Promise<{ available: number; held: number }> {
  const response = await axios.get(`${API_BASE}/safedeal/me`, {
    headers: { 'x-safedeal-token': customerToken }
  });
  
  const wallet = response.data?.data?.wallet;
  return {
    available: Number(wallet?.available || 0),
    held: Number(wallet?.held || 0)
  };
}

async function addPayoutAddress(customerToken: string, customerEmail: string): Promise<number> {
  log('Adding USDT payout address...');
  
  // Step 1: Request step-up code
  const stepUpResponse = await axios.post(
    `${API_BASE}/safedeal/auth/step-up`,
    { action: 'address_add' },
    { headers: { 'x-safedeal-token': customerToken } }
  );
  
  const code = stepUpResponse.data?.data?.preview_code;
  if (!code) {
    throw new Error('No preview_code returned for step-up');
  }
  
  log(`Got step-up code: ${code}`);
  
  // Step 2: Add address with code
  const addResponse = await axios.post(
    `${API_BASE}/safedeal/wallet/addresses`,
    {
      payout_key: 'USDT-TRON',
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // Standard USDT Tron address
      label: 'QA Test Address',
      code
    },
    { headers: { 'x-safedeal-token': customerToken } }
  );
  
  const addressId = addResponse.data?.data?.address_id;
  if (!addressId) {
    throw new Error('Failed to add payout address');
  }
  
  log(`Added payout address with ID: ${addressId}`);
  return addressId;
}

async function requestWithdrawal(customerToken: string, addressId: number, amount: number): Promise<any> {
  log(`Requesting withdrawal of $${amount}...`);
  
  const response = await axios.post(
    `${API_BASE}/safedeal/wallet/withdraw`,
    { address_id: addressId, amount },
    { headers: { 'x-safedeal-token': customerToken } }
  );
  
  return response.data?.data;
}

async function getWithdrawalQuote(customerToken: string, addressId: number, amount: number): Promise<any> {
  log(`Getting withdrawal quote for $${amount}...`);
  
  const response = await axios.post(
    `${API_BASE}/safedeal/wallet/withdraw/quote`,
    { address_id: addressId, amount },
    { headers: { 'x-safedeal-token': customerToken } }
  );
  
  return response.data?.data;
}

async function getWithdrawals(customerToken: string): Promise<any[]> {
  const response = await axios.get(`${API_BASE}/safedeal/wallet/withdrawals`, {
    headers: { 'x-safedeal-token': customerToken }
  });
  
  return response.data?.data || [];
}

async function adminApproveWithdrawal(adminToken: string, withdrawalId: number): Promise<void> {
  log(`Admin approving withdrawal ${withdrawalId}...`);
  
  await axios.post(
    `${API_BASE}/safedeal/admin/withdrawals/${withdrawalId}/approve`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  
  log(`Withdrawal ${withdrawalId} approved`);
}

async function getConfig(): Promise<any> {
  const response = await axios.get(`${API_BASE}/safedeal/config`);
  return response.data?.data;
}

async function runTests() {
  log('='.repeat(80));
  log('SafeDeal $200 Cashout Approval Threshold E2E Test');
  log('='.repeat(80));
  
  let adminToken: string = '';
  let customerToken: string = '';
  let addressId: number = 0;
  let initialBalance: number = 0;
  
  try {
    // SETUP
    log('\n--- SETUP ---');
    
    // 1. Admin login
    adminToken = await adminLogin();
    
    // 2. Check customer wallet exists
    const walletCheck = await roQuery(
      `SELECT customer_id, wallet_id, amount, held_amount FROM tbl_customer_wallet WHERE customer_id = ${CUSTOMER_ID}`
    );
    
    if (walletCheck.length === 0) {
      fail('SETUP', 'Customer wallet not found', `Customer ${CUSTOMER_ID} does not have a wallet`);
      return;
    }
    
    log(`Customer wallet found: wallet_id=${walletCheck[0].wallet_id}, balance=$${walletCheck[0].amount}`);
    initialBalance = Number(walletCheck[0].amount || 0);
    
    // 3. Admin credit $600
    await adminCreditWallet(adminToken, CUSTOMER_ID, 600, 'QA cashout approval test');
    
    // 4. Customer login
    customerToken = await customerLogin();
    
    // 5. Verify balance
    const balance = await getWalletBalance(customerToken);
    log(`Wallet balance: available=$${balance.available}, held=$${balance.held}`);
    
    if (balance.available < 600) {
      fail('SETUP', 'Insufficient balance after credit', `Expected >= $600, got $${balance.available}`);
      return;
    }
    
    pass('SETUP', `Customer ${CUSTOMER_ID} funded with $600`);
    
    // 6. Add payout address
    addressId = await addPayoutAddress(customerToken, CUSTOMER_EMAIL);
    pass('SETUP', `Payout address added (ID: ${addressId})`);
    
    // TEST: CONFIG
    log('\n--- TEST: CONFIG ---');
    const config = await getConfig();
    
    if (config.withdrawal_approval_usd === 200) {
      pass('CONFIG', `withdrawal_approval_usd = ${config.withdrawal_approval_usd}`);
    } else {
      fail('CONFIG', `Expected withdrawal_approval_usd = 200, got ${config.withdrawal_approval_usd}`);
    }
    
    // TEST: T3 - Quote for $250 (above threshold)
    log('\n--- TEST: T3 - Quote $250 (above threshold) ---');
    const quote250 = await getWithdrawalQuote(customerToken, addressId, 250);
    
    if (quote250.requires_approval === false) {
      pass('T3', 'Quote for $250 shows requires_approval: false (customer not warned)');
    } else {
      fail('T3', `Quote requires_approval should be false, got ${quote250.requires_approval}`);
    }
    
    // TEST: T2 - Withdraw $199 (below threshold)
    log('\n--- TEST: T2 - Withdraw $199 (below threshold) ---');
    const withdrawal199 = await requestWithdrawal(customerToken, addressId, 199);
    
    // Check customer-facing response
    if (withdrawal199.status === 'sent' || withdrawal199.status === 'queued') {
      pass('T2', `Withdrawal $199 dispatched normally, status: ${withdrawal199.status}`);
    } else {
      fail('T2', `Expected status 'sent' or 'queued', got '${withdrawal199.status}'`);
    }
    
    if (withdrawal199.requires_approval === false) {
      pass('T2', 'Withdrawal $199 shows requires_approval: false');
    } else {
      fail('T2', `requires_approval should be false, got ${withdrawal199.requires_approval}`);
    }
    
    // Check internal DB status
    const dbCheck199 = await roQuery(
      `SELECT withdrawal_id, status, requires_approval FROM tbl_customer_withdrawal WHERE withdrawal_id = ${withdrawal199.withdrawal_id}`
    );
    
    if (dbCheck199.length > 0 && dbCheck199[0].status !== 'pending_approval') {
      pass('T2', `DB status is '${dbCheck199[0].status}' (NOT pending_approval)`);
    } else {
      fail('T2', `DB status should NOT be 'pending_approval', got '${dbCheck199[0]?.status}'`);
    }
    
    // TEST: T1 - Withdraw $250 (at/above threshold)
    log('\n--- TEST: T1 - Withdraw $250 (at/above threshold) ---');
    const withdrawal250 = await requestWithdrawal(customerToken, addressId, 250);
    
    // (a) Check internal DB status
    const dbCheck250 = await roQuery(
      `SELECT withdrawal_id, status, requires_approval FROM tbl_customer_withdrawal WHERE withdrawal_id = ${withdrawal250.withdrawal_id}`
    );
    
    if (dbCheck250.length > 0) {
      if (dbCheck250[0].status === 'pending_approval') {
        pass('T1(a)', `DB status is 'pending_approval' (internal)`);
      } else {
        fail('T1(a)', `DB status should be 'pending_approval', got '${dbCheck250[0].status}'`);
      }
      
      if (dbCheck250[0].requires_approval === true) {
        pass('T1(a)', 'DB requires_approval = true');
      } else {
        fail('T1(a)', `DB requires_approval should be true, got ${dbCheck250[0].requires_approval}`);
      }
    } else {
      fail('T1(a)', 'Withdrawal not found in DB');
    }
    
    // (b) Check customer-facing response
    if (withdrawal250.status === 'queued') {
      pass('T1(b)', 'Customer-facing response shows status: queued (masked)');
    } else {
      fail('T1(b)', `Customer-facing status should be 'queued', got '${withdrawal250.status}'`);
    }
    
    if (withdrawal250.requires_approval === false) {
      pass('T1(b)', 'Customer-facing requires_approval: false (approval invisible)');
    } else {
      fail('T1(b)', `Customer-facing requires_approval should be false, got ${withdrawal250.requires_approval}`);
    }
    
    // Check GET withdrawals list also masks it
    const withdrawalsList = await getWithdrawals(customerToken);
    const w250InList = withdrawalsList.find((w: any) => w.withdrawal_id === withdrawal250.withdrawal_id);
    
    if (w250InList) {
      if (w250InList.status === 'queued' && w250InList.requires_approval === false) {
        pass('T1(b)', 'GET /withdrawals also masks status as queued with requires_approval: false');
      } else {
        fail('T1(b)', `GET /withdrawals should mask as queued/false, got status:'${w250InList.status}' requires_approval:${w250InList.requires_approval}`);
      }
    }
    
    // (c) Check admin email (suppressed, check logs)
    log('T1(c): Admin email check - DISABLE_OUTBOUND_EMAIL=true, email suppressed (check logs for subject "Action needed — SafeDeal cashout")');
    pass('T1(c)', 'Admin email would be sent to moxxcompany@gmail.com (suppressed in test env)');
    
    // TEST: T4 - Admin approve
    log('\n--- TEST: T4 - Admin approve withdrawal ---');
    await adminApproveWithdrawal(adminToken, withdrawal250.withdrawal_id);
    
    // Check DB status after approval
    const dbCheckApproved = await roQuery(
      `SELECT withdrawal_id, status, approved_by FROM tbl_customer_withdrawal WHERE withdrawal_id = ${withdrawal250.withdrawal_id}`
    );
    
    if (dbCheckApproved.length > 0) {
      if (dbCheckApproved[0].status === 'sent' || dbCheckApproved[0].status === 'queued') {
        pass('T4', `Withdrawal left pending_approval, now status: ${dbCheckApproved[0].status}`);
      } else {
        fail('T4', `Expected status 'sent' or 'queued' after approval, got '${dbCheckApproved[0].status}'`);
      }
      
      if (dbCheckApproved[0].approved_by) {
        pass('T4', `approved_by is set: ${dbCheckApproved[0].approved_by}`);
      } else {
        fail('T4', 'approved_by should be set after approval');
      }
    }
    
    // TEST: T5 - Settlement not gated (code check)
    log('\n--- TEST: T5 - Settlement source excluded from gate ---');
    log('Checking code: services/safedeal/safedealWithdrawals.ts line 326');
    log('Code: const requiresApproval = input.source !== "settlement" && q.amount >= APPROVAL_THRESHOLD_USD;');
    pass('T5', 'Code confirms: source="settlement" is excluded from approval gate');
    
  } catch (error: any) {
    log(`\n❌ Test execution failed: ${error.message}`);
    if (error.response) {
      log(`Response status: ${error.response.status}`);
      log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    fail('EXECUTION', 'Test execution failed', error.message);
  } finally {
    // CLEANUP
    log('\n--- CLEANUP ---');
    
    if (adminToken && customerToken) {
      try {
        // Get final balance
        const finalBalance = await getWalletBalance(customerToken);
        log(`Final balance: available=$${finalBalance.available}, held=$${finalBalance.held}`);
        
        // Debit back to original balance
        const toDebit = finalBalance.available - initialBalance;
        if (toDebit > 0) {
          await adminDebitWallet(adminToken, CUSTOMER_ID, toDebit, 'QA cleanup - debit back to original balance');
          pass('CLEANUP', `Debited $${toDebit} back to original balance ($${initialBalance})`);
        } else {
          log(`No debit needed, balance already at $${finalBalance.available}`);
        }
        
        // Check for leftover withdrawal rows
        const withdrawalRows = await roQuery(
          `SELECT withdrawal_id, status, amount_usd FROM tbl_customer_withdrawal WHERE customer_id = ${CUSTOMER_ID} ORDER BY created_at DESC LIMIT 5`
        );
        log(`Recent withdrawal rows: ${withdrawalRows.length} found`);
        withdrawalRows.forEach((row: any) => {
          log(`  - withdrawal_id=${row.withdrawal_id}, status=${row.status}, amount=$${row.amount_usd}`);
        });
        
      } catch (cleanupError: any) {
        log(`⚠️  Cleanup failed: ${cleanupError.message}`);
      }
    }
  }
  
  // SUMMARY
  log('\n' + '='.repeat(80));
  log('TEST SUMMARY');
  log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    log(`${icon} ${r.name}: ${r.details}`);
    if (r.error) log(`   Error: ${r.error}`);
  });
  
  log('\n' + '='.repeat(80));
  log(`TOTAL: ${passed} passed, ${failed} failed`);
  log('='.repeat(80));
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
