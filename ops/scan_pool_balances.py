#!/usr/bin/env python3
"""
DynoPay Pool Wallet Balance Scanner
Scans ALL temporary/pool wallet addresses and reports those with balance > $2.
Uses Tatum REST API v3 directly for balance checks.
"""

import psycopg2
import requests
import time
import json
import sys
from datetime import datetime

# ========================
# Configuration
# ========================
DB_CONFIG = {
    "dbname": "db_bozzwallet",
    "user": "postgres",
    "password": "oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV",
    "host": "tramway.proxy.rlwy.net",
    "port": 57376,
    "sslmode": "require"
}

TATUM_KEY = "REDACTED_TATUM_KEY"
TATUM_BASE = "https://api.tatum.io/v3"
TATUM_HEADERS = {"x-api-key": TATUM_KEY}

# Contract addresses
TRX_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"  # USDT on TRC20
ETH_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7"  # USDT on ERC20
USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"  # USDC on ERC20
RLUSD_ERC20_CONTRACT = "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD"
USDT_POLYGON_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"

# Approximate prices (will fetch live if possible)
PRICES = {}

THRESHOLD_USD = 2.0

# Rate limiting
REQUEST_DELAY = 0.35  # seconds between API calls (to avoid Tatum rate limits)
api_call_count = 0

def fetch_prices():
    """Fetch live crypto prices from CoinGecko (free, no key needed)."""
    global PRICES
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={
                "ids": "bitcoin,ethereum,litecoin,dogecoin,tether,usd-coin,tron,solana,ripple,matic-network,bitcoin-cash",
                "vs_currencies": "usd"
            },
            timeout=15
        )
        data = resp.json()
        PRICES = {
            "BTC": data.get("bitcoin", {}).get("usd", 0),
            "ETH": data.get("ethereum", {}).get("usd", 0),
            "LTC": data.get("litecoin", {}).get("usd", 0),
            "DOGE": data.get("dogecoin", {}).get("usd", 0),
            "TRX": data.get("tron", {}).get("usd", 0),
            "SOL": data.get("solana", {}).get("usd", 0),
            "XRP": data.get("ripple", {}).get("usd", 0),
            "POLYGON": data.get("matic-network", {}).get("usd", 0),
            "BCH": data.get("bitcoin-cash", {}).get("usd", 0),
            # Stablecoins
            "USDT-TRC20": 1.0,
            "USDT-ERC20": 1.0,
            "USDC-ERC20": 1.0,
            "RLUSD": 1.0,
            "RLUSD-ERC20": 1.0,
            "USDT-POLYGON": 1.0,
        }
        print(f"[OK] Live prices fetched: BTC=${PRICES['BTC']}, ETH=${PRICES['ETH']}, TRX=${PRICES['TRX']}, SOL=${PRICES['SOL']}, XRP=${PRICES['XRP']}")
    except Exception as e:
        print(f"[WARN] Could not fetch live prices: {e}, using fallback")
        PRICES = {
            "BTC": 85000, "ETH": 1900, "LTC": 90, "DOGE": 0.17,
            "TRX": 0.24, "SOL": 130, "XRP": 2.1, "POLYGON": 0.40, "BCH": 350,
            "USDT-TRC20": 1.0, "USDT-ERC20": 1.0, "USDC-ERC20": 1.0,
            "RLUSD": 1.0, "RLUSD-ERC20": 1.0, "USDT-POLYGON": 1.0,
        }


def get_price_usd(wallet_type):
    """Get USD price for a given wallet type."""
    # Map token types to their price key
    if wallet_type in PRICES:
        return PRICES[wallet_type]
    return 0


def tatum_get(url, params=None, retries=2):
    """Make a Tatum API GET request with retry logic."""
    global api_call_count
    for attempt in range(retries + 1):
        try:
            time.sleep(REQUEST_DELAY)
            api_call_count += 1
            resp = requests.get(url, headers=TATUM_HEADERS, params=params, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  [RATE LIMIT] 429 received, waiting {wait}s...")
                time.sleep(wait)
                continue
            elif resp.status_code == 403:
                # Account not found (common for unused addresses)
                return None
            else:
                print(f"  [API] HTTP {resp.status_code} for {url}: {resp.text[:200]}")
                return None
        except requests.exceptions.Timeout:
            print(f"  [TIMEOUT] {url} (attempt {attempt+1})")
            if attempt < retries:
                time.sleep(2)
            continue
        except Exception as e:
            print(f"  [ERROR] {url}: {e}")
            return None
    return None


def get_balance(address, wallet_type):
    """
    Get the balance of a wallet address using Tatum v3 REST API.
    Returns balance as float in the native unit.
    """
    try:
        if wallet_type == "BTC":
            data = tatum_get(f"{TATUM_BASE}/bitcoin/address/balance/{address}")
            if data:
                incoming = float(data.get("incoming", 0))
                outgoing = float(data.get("outgoing", 0))
                return incoming - outgoing
            return 0.0

        elif wallet_type == "ETH":
            data = tatum_get(f"{TATUM_BASE}/ethereum/account/balance/{address}")
            if data:
                return float(data.get("balance", 0))
            return 0.0

        elif wallet_type == "USDT-ERC20":
            data = tatum_get(f"{TATUM_BASE}/ethereum/account/balance/erc20/{address}", 
                           params={"contractAddress": ETH_CONTRACT})
            if data:
                return float(data.get("balance", 0)) / 1000000
            return 0.0

        elif wallet_type == "USDC-ERC20":
            data = tatum_get(f"{TATUM_BASE}/ethereum/account/balance/erc20/{address}",
                           params={"contractAddress": USDC_CONTRACT})
            if data:
                return float(data.get("balance", 0)) / 1000000
            return 0.0

        elif wallet_type == "RLUSD-ERC20":
            data = tatum_get(f"{TATUM_BASE}/ethereum/account/balance/erc20/{address}",
                           params={"contractAddress": RLUSD_ERC20_CONTRACT})
            if data:
                return float(data.get("balance", 0)) / 1000000
            return 0.0

        elif wallet_type == "TRX":
            data = tatum_get(f"{TATUM_BASE}/tron/account/{address}")
            if data:
                return float(data.get("balance", 0)) / 1000000  # SUN -> TRX
            return 0.0

        elif wallet_type == "USDT-TRC20":
            data = tatum_get(f"{TATUM_BASE}/tron/account/{address}")
            if data and data.get("trc20"):
                for token_entry in data["trc20"]:
                    if isinstance(token_entry, dict) and TRX_CONTRACT in token_entry:
                        return float(token_entry[TRX_CONTRACT]) / 1000000
            return 0.0

        elif wallet_type == "LTC":
            data = tatum_get(f"{TATUM_BASE}/litecoin/address/balance/{address}")
            if data:
                incoming = float(data.get("incoming", 0))
                outgoing = float(data.get("outgoing", 0))
                return incoming - outgoing
            return 0.0

        elif wallet_type == "DOGE":
            data = tatum_get(f"{TATUM_BASE}/dogecoin/address/balance/{address}")
            if data:
                incoming = float(data.get("incoming", 0))
                outgoing = float(data.get("outgoing", 0))
                return incoming - outgoing
            return 0.0

        elif wallet_type == "BCH":
            # BCH: use transaction-based approach
            data = tatum_get(f"{TATUM_BASE}/bcash/transaction/address/{address}",
                           params={"pageSize": 50, "skip": 0})
            if data and isinstance(data, list):
                balance = 0.0
                for tx in data:
                    for output in tx.get("outputs", []):
                        if output.get("address") == address:
                            balance += float(output.get("value", 0))
                return balance
            return 0.0

        elif wallet_type == "SOL":
            data = tatum_get(f"{TATUM_BASE}/solana/account/balance/{address}")
            if data:
                return float(data.get("balance", 0))
            return 0.0

        elif wallet_type == "XRP":
            data = tatum_get(f"{TATUM_BASE}/xrp/account/{address}/balance")
            if data:
                # XRP balance returned in drops
                return float(data.get("balance", 0)) / 1000000
            return 0.0

        elif wallet_type == "RLUSD":
            data = tatum_get(f"{TATUM_BASE}/xrp/account/{address}/balance")
            if data:
                # Check obligations/assets for RLUSD
                obligations = data.get("obligations", [])
                for ob in obligations:
                    if (ob.get("currency", "").upper() == "RLUSD" or
                        ob.get("currency", "").upper().startswith("524C5553")):
                        return float(ob.get("value", 0))
                assets = data.get("assets", [])
                for asset in assets:
                    if (asset.get("currency", "").upper() == "RLUSD" or
                        asset.get("currency", "").upper().startswith("524C5553")):
                        return float(asset.get("value", 0))
            return 0.0

        elif wallet_type == "POLYGON":
            data = tatum_get(f"{TATUM_BASE}/polygon/account/balance/{address}")
            if data:
                return float(data.get("balance", 0))
            return 0.0

        elif wallet_type == "USDT-POLYGON":
            data = tatum_get(f"{TATUM_BASE}/polygon/account/balance/erc20/{address}",
                           params={"contractAddress": USDT_POLYGON_CONTRACT})
            if data:
                return float(data.get("balance", 0)) / 1000000
            return 0.0

        else:
            print(f"  [SKIP] Unsupported wallet_type: {wallet_type}")
            return 0.0

    except Exception as e:
        print(f"  [ERROR] Balance check failed for {wallet_type} {address}: {e}")
        return 0.0


def get_trx_native_balance(address):
    """Get TRX native balance for a TRC20 address (for gas balance)."""
    data = tatum_get(f"{TATUM_BASE}/tron/account/{address}")
    if data:
        return float(data.get("balance", 0)) / 1000000
    return 0.0


def main():
    print("=" * 90)
    print("  DynoPay Pool Wallet Balance Scanner")
    print(f"  Threshold: >${THRESHOLD_USD} USD")
    print(f"  Scan started: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 90)
    print()

    # Fetch live prices
    fetch_prices()
    print()

    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # ==========================================
    # 1. Scan Merchant Temp Addresses
    # ==========================================
    cur.execute("""
        SELECT temp_address_id, owner_user_id, wallet_type, wallet_address, status,
               admin_fee_balance, gas_balance, current_payment_id, expected_amount,
               received_amount, total_transactions, destination_tag
        FROM tbl_merchant_temp_address
        ORDER BY wallet_type, temp_address_id
    """)
    merchant_addrs = cur.fetchall()
    print(f"[DB] Found {len(merchant_addrs)} merchant temp addresses")

    # ==========================================
    # 2. Scan USDT Pool Addresses (legacy)
    # ==========================================
    cur.execute("""
        SELECT pool_address_id, wallet_type, wallet_address, status,
               admin_fee_balance, gas_balance, current_payment_id, expected_amount,
               received_amount, total_transactions
        FROM tbl_usdt_pool_address
        ORDER BY wallet_type, pool_address_id
    """)
    usdt_addrs = cur.fetchall()
    print(f"[DB] Found {len(usdt_addrs)} USDT pool addresses")
    print()

    # Group merchant addresses by type for efficient scanning
    type_groups = {}
    for row in merchant_addrs:
        wt = row[2]
        if wt not in type_groups:
            type_groups[wt] = []
        type_groups[wt].append(row)

    results_above_threshold = []
    all_results = []
    total_scanned = 0
    total_value_usd = 0.0

    # Track TRC20 addresses to also check native TRX balance
    trc20_addresses_for_trx_check = []

    for wt in sorted(type_groups.keys()):
        addrs = type_groups[wt]
        price = get_price_usd(wt)
        print(f"--- Scanning {len(addrs)} {wt} addresses (price: ${price}) ---")

        for row in addrs:
            addr_id, owner_id, wallet_type, wallet_address, status, \
                admin_fee_db, gas_balance_db, current_payment_id, expected_amount, \
                received_amount, total_txns, dest_tag = row

            total_scanned += 1
            short_addr = wallet_address[:10] + "..." + wallet_address[-6:]

            balance = get_balance(wallet_address, wallet_type)
            usd_value = balance * price

            entry = {
                "table": "merchant_temp_address",
                "id": addr_id,
                "owner_user_id": owner_id,
                "wallet_type": wallet_type,
                "address": wallet_address,
                "dest_tag": dest_tag,
                "status": status,
                "balance": balance,
                "usd_value": usd_value,
                "price": price,
                "admin_fee_db": float(admin_fee_db) if admin_fee_db else 0,
                "gas_balance_db": float(gas_balance_db) if gas_balance_db else 0,
                "total_txns": total_txns,
                "current_payment_id": current_payment_id,
            }
            all_results.append(entry)

            if usd_value > THRESHOLD_USD:
                results_above_threshold.append(entry)
                print(f"  ★ ID={addr_id} {short_addr} status={status} balance={balance:.8f} {wallet_type} = ${usd_value:.2f} [owner={owner_id}, txns={total_txns}]")
            elif balance > 0:
                sys.stdout.write(f"  · ID={addr_id} {short_addr} bal={balance:.8f} = ${usd_value:.4f}\n")
            
            total_value_usd += usd_value

            # Track TRC20 addresses to also check their native TRX
            if wallet_type == "USDT-TRC20":
                trc20_addresses_for_trx_check.append(row)

        print()

    # ==========================================
    # 3. Check native TRX balance on USDT-TRC20 addresses
    # ==========================================
    if trc20_addresses_for_trx_check:
        trx_price = get_price_usd("TRX")
        print(f"--- Checking native TRX balance on {len(trc20_addresses_for_trx_check)} USDT-TRC20 addresses (price: ${trx_price}) ---")
        for row in trc20_addresses_for_trx_check:
            addr_id, owner_id, wallet_type, wallet_address, status, \
                admin_fee_db, gas_balance_db, current_payment_id, expected_amount, \
                received_amount, total_txns, dest_tag = row

            trx_balance = get_trx_native_balance(wallet_address)
            trx_usd = trx_balance * trx_price
            short_addr = wallet_address[:10] + "..." + wallet_address[-6:]

            if trx_usd > THRESHOLD_USD:
                entry = {
                    "table": "merchant_temp_address",
                    "id": addr_id,
                    "owner_user_id": owner_id,
                    "wallet_type": "TRX (on USDT-TRC20 addr)",
                    "address": wallet_address,
                    "dest_tag": None,
                    "status": status,
                    "balance": trx_balance,
                    "usd_value": trx_usd,
                    "price": trx_price,
                    "admin_fee_db": float(admin_fee_db) if admin_fee_db else 0,
                    "gas_balance_db": float(gas_balance_db) if gas_balance_db else 0,
                    "total_txns": total_txns,
                    "current_payment_id": current_payment_id,
                }
                results_above_threshold.append(entry)
                total_value_usd += trx_usd
                print(f"  ★ ID={addr_id} {short_addr} status={status} TRX_native={trx_balance:.6f} = ${trx_usd:.2f}")
            elif trx_balance > 0:
                total_value_usd += trx_usd
                sys.stdout.write(f"  · ID={addr_id} {short_addr} TRX_native={trx_balance:.6f} = ${trx_usd:.4f}\n")
        print()

    # ==========================================
    # 4. USDT Pool addresses (legacy table)
    # ==========================================
    if usdt_addrs:
        print(f"--- Scanning {len(usdt_addrs)} USDT pool addresses (legacy) ---")
        for row in usdt_addrs:
            pool_id, wallet_type, wallet_address, status, \
                admin_fee_db, gas_balance_db, current_payment_id, expected_amount, \
                received_amount, total_txns = row

            total_scanned += 1
            balance = get_balance(wallet_address, wallet_type)
            price = get_price_usd(wallet_type)
            usd_value = balance * price
            short_addr = wallet_address[:10] + "..." + wallet_address[-6:]

            entry = {
                "table": "usdt_pool_address",
                "id": pool_id,
                "owner_user_id": None,
                "wallet_type": wallet_type,
                "address": wallet_address,
                "dest_tag": None,
                "status": status,
                "balance": balance,
                "usd_value": usd_value,
                "price": price,
                "admin_fee_db": float(admin_fee_db) if admin_fee_db else 0,
                "gas_balance_db": float(gas_balance_db) if gas_balance_db else 0,
                "total_txns": total_txns,
                "current_payment_id": current_payment_id,
            }
            all_results.append(entry)
            total_value_usd += usd_value

            if usd_value > THRESHOLD_USD:
                results_above_threshold.append(entry)
                print(f"  ★ ID={pool_id} {short_addr} status={status} balance={balance:.8f} = ${usd_value:.2f}")
        print()

    conn.close()

    # ==========================================
    # REPORT
    # ==========================================
    print()
    print("=" * 90)
    print("  SCAN COMPLETE — RESULTS SUMMARY")
    print("=" * 90)
    print(f"  Total addresses scanned:       {total_scanned}")
    print(f"  Total API calls:               {api_call_count}")
    print(f"  Total value found:             ${total_value_usd:.2f}")
    print(f"  Addresses with >${THRESHOLD_USD} USD:    {len(results_above_threshold)}")
    print()

    if results_above_threshold:
        # Sort by USD value descending
        results_above_threshold.sort(key=lambda x: x["usd_value"], reverse=True)

        print("  ┌─────┬─────────┬──────────────────────────┬────────────────────────────────────────────────┬────────────┬──────────────┬────────┬──────────────────┐")
        print("  │  #  │  ID     │  Type                    │  Address                                       │  Status    │  Balance     │  USD   │  Owner/Info      │")
        print("  ├─────┼─────────┼──────────────────────────┼────────────────────────────────────────────────┼────────────┼──────────────┼────────┼──────────────────┤")
        for i, r in enumerate(results_above_threshold):
            addr_display = r["address"][:20] + "..." + r["address"][-8:]
            tag_info = f" tag={r['dest_tag']}" if r.get("dest_tag") else ""
            owner_info = f"user={r['owner_user_id']}" if r.get("owner_user_id") else "global"
            print(f"  │ {i+1:3d} │ {r['id']:7d} │ {r['wallet_type']:24s} │ {addr_display:46s} │ {r['status']:10s} │ {r['balance']:>12.8f} │ ${r['usd_value']:>5.2f} │ {owner_info:16s} │")
        print("  └─────┴─────────┴──────────────────────────┴────────────────────────────────────────────────┴────────────┴──────────────┴────────┴──────────────────┘")
        print()

        # Detailed breakdown
        print("  DETAILED BREAKDOWN:")
        print("  " + "-" * 80)
        for i, r in enumerate(results_above_threshold):
            tag_str = f" (dest_tag: {r['dest_tag']})" if r.get("dest_tag") else ""
            print(f"  {i+1}. ID={r['id']} | {r['wallet_type']}")
            print(f"     Address: {r['address']}{tag_str}")
            print(f"     Status: {r['status']} | Balance: {r['balance']:.8f} | USD: ${r['usd_value']:.2f}")
            print(f"     Owner user_id: {r.get('owner_user_id', 'N/A')} | Total txns: {r['total_txns']}")
            print(f"     DB admin_fee_balance: {r['admin_fee_db']:.8f} | DB gas_balance: {r['gas_balance_db']:.8f}")
            if r.get('current_payment_id'):
                print(f"     ⚠ ACTIVE payment_id: {r['current_payment_id']}")
            print()
    else:
        print("  ✅ No addresses found with balance > $2.00")
        print()

    # Also list all non-zero balances for completeness
    nonzero = [r for r in all_results if r["balance"] > 0 and r["usd_value"] <= THRESHOLD_USD]
    if nonzero:
        print(f"  BELOW-THRESHOLD NON-ZERO BALANCES ({len(nonzero)} addresses):")
        print("  " + "-" * 80)
        for r in sorted(nonzero, key=lambda x: x["usd_value"], reverse=True):
            print(f"    ID={r['id']:4d} | {r['wallet_type']:15s} | bal={r['balance']:.8f} = ${r['usd_value']:.4f} | status={r['status']}")

    print()
    print(f"  Scan completed at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 90)

    # Save results to JSON
    output = {
        "scan_date": datetime.utcnow().isoformat(),
        "threshold_usd": THRESHOLD_USD,
        "total_scanned": total_scanned,
        "total_api_calls": api_call_count,
        "total_value_usd": round(total_value_usd, 2),
        "above_threshold": results_above_threshold,
        "all_nonzero": [r for r in all_results if r["balance"] > 0],
    }
    with open("/app/scripts/pool_balance_scan_results.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  Full results saved to /app/scripts/pool_balance_scan_results.json")


if __name__ == "__main__":
    main()
