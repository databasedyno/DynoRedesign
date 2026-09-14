#!/usr/bin/env python3
"""
Deep scan: Check ALL USDT-TRC20 addresses from BOTH tables
using TronGrid API (direct blockchain, NOT Tatum) to find the $43 discrepancy.
Also checks USDT-ERC20 via Etherscan-compatible API.
"""

import psycopg2
import requests
import time
import json
from datetime import datetime

DB_CONFIG = {
    "dbname": "db_bozzwallet",
    "user": "postgres",
    "password": "REDACTED_USE_ENV_PGPASSWORD",
    "host": "tramway.proxy.rlwy.net",
    "port": 57376,
    "sslmode": "require"
}

TATUM_KEY = "REDACTED_TATUM_KEY"
TATUM_HEADERS = {"x-api-key": TATUM_KEY}
TATUM_BASE = "https://api.tatum.io/v3"

# USDT TRC20 contract on mainnet
USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
# USDT ERC20 contract
USDT_ERC20_CONTRACT = "0xdac17f958d2ee523a2206206994597c13d831ec7"

THRESHOLD_USD = 2.0

def check_trc20_trongrid(address):
    """Check USDT-TRC20 balance via TronGrid (direct blockchain)."""
    try:
        time.sleep(0.5)
        url = f"https://api.trongrid.io/v1/accounts/{address}"
        resp = requests.get(url, timeout=15, headers={"Accept": "application/json"})
        if resp.status_code == 200:
            data = resp.json()
            if data.get("success") and data.get("data") and len(data["data"]) > 0:
                account = data["data"][0]
                # Get TRX native balance
                trx_balance = account.get("balance", 0) / 1_000_000
                
                # Get TRC20 USDT balance
                usdt_balance = 0
                trc20_list = account.get("trc20", [])
                for token_entry in trc20_list:
                    if isinstance(token_entry, dict) and USDT_TRC20_CONTRACT in token_entry:
                        usdt_balance = int(token_entry[USDT_TRC20_CONTRACT]) / 1_000_000
                        break
                
                return {"usdt": usdt_balance, "trx": trx_balance, "source": "trongrid"}
            else:
                # Account not activated or empty
                return {"usdt": 0, "trx": 0, "source": "trongrid_empty"}
        elif resp.status_code == 404:
            return {"usdt": 0, "trx": 0, "source": "trongrid_404"}
        else:
            print(f"  [TronGrid] HTTP {resp.status_code} for {address}")
            return None
    except Exception as e:
        print(f"  [TronGrid ERROR] {address}: {e}")
        return None


def check_trc20_tatum(address):
    """Check USDT-TRC20 balance via Tatum API."""
    try:
        time.sleep(0.35)
        url = f"{TATUM_BASE}/tron/account/{address}"
        resp = requests.get(url, headers=TATUM_HEADERS, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            trx_balance = data.get("balance", 0) / 1_000_000
            usdt_balance = 0
            trc20_list = data.get("trc20", [])
            for token_entry in trc20_list:
                if isinstance(token_entry, dict) and USDT_TRC20_CONTRACT in token_entry:
                    usdt_balance = int(token_entry[USDT_TRC20_CONTRACT]) / 1_000_000
                    break
            return {"usdt": usdt_balance, "trx": trx_balance, "source": "tatum"}
        elif resp.status_code == 403:
            return {"usdt": 0, "trx": 0, "source": "tatum_403"}
        else:
            return {"usdt": 0, "trx": 0, "source": f"tatum_{resp.status_code}"}
    except Exception as e:
        print(f"  [Tatum ERROR] {address}: {e}")
        return None


def main():
    print("=" * 100)
    print("  DEEP SCAN: USDT-TRC20 — TronGrid vs Tatum Comparison")
    print(f"  Looking for the ~$43 discrepancy")
    print(f"  Scan started: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 100)
    print()

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    # ==========================================
    # Collect ALL USDT-TRC20 addresses from BOTH tables
    # ==========================================
    all_addresses = []

    # NEW table: tbl_merchant_temp_address
    cur.execute("""
        SELECT temp_address_id as id, owner_user_id as user_id, wallet_type, wallet_address, status, 
               admin_fee_balance, gas_balance, total_transactions, current_payment_id,
               'merchant_pool' as source_table
        FROM tbl_merchant_temp_address
        WHERE wallet_type IN ('USDT-TRC20', 'TRX')
        ORDER BY temp_address_id
    """)
    for row in cur.fetchall():
        all_addresses.append({
            "id": row[0], "user_id": row[1], "wallet_type": row[2], "address": row[3],
            "status": row[4], "admin_fee_db": float(row[5] or 0), "gas_db": float(row[6] or 0),
            "txns": row[7], "payment_id": row[8], "table": row[9]
        })

    # OLD table: tbl_user_temp_address
    cur.execute("""
        SELECT temp_id as id, user_id, wallet_type, wallet_address, status, amount,
               admin_status, 'legacy_temp' as source_table
        FROM tbl_user_temp_address
        WHERE wallet_type IN ('USDT-TRC20', 'USDT-ERC20', 'TRX')
        AND wallet_address NOT LIKE 'TMock%'
        ORDER BY temp_id
    """)
    for row in cur.fetchall():
        all_addresses.append({
            "id": row[0], "user_id": row[1], "wallet_type": row[2], "address": row[3],
            "status": row[4], "amount_db": float(row[5] or 0), "admin_status": row[6],
            "table": row[7]
        })

    conn.close()

    # Deduplicate by address (same address may appear in both tables)
    seen_addresses = {}
    unique_entries = []
    for entry in all_addresses:
        addr = entry["address"]
        if addr not in seen_addresses:
            seen_addresses[addr] = entry
            unique_entries.append(entry)
        else:
            # Keep track that it appears in both
            seen_addresses[addr]["also_in"] = entry["table"]

    print(f"Total unique addresses to scan: {len(unique_entries)}")
    print(f"  USDT-TRC20 from merchant_pool: {sum(1 for e in unique_entries if e['table']=='merchant_pool' and e['wallet_type']=='USDT-TRC20')}")
    print(f"  TRX from merchant_pool: {sum(1 for e in unique_entries if e['table']=='merchant_pool' and e['wallet_type']=='TRX')}")
    print(f"  USDT-TRC20 from legacy_temp: {sum(1 for e in unique_entries if e['table']=='legacy_temp' and e['wallet_type']=='USDT-TRC20')}")
    print(f"  USDT-ERC20 from legacy_temp: {sum(1 for e in unique_entries if e['table']=='legacy_temp' and e['wallet_type']=='USDT-ERC20')}")
    print(f"  TRX from legacy_temp: {sum(1 for e in unique_entries if e['table']=='legacy_temp' and e['wallet_type']=='TRX')}")
    print()

    # ==========================================
    # Scan each address on BOTH TronGrid and Tatum
    # ==========================================
    discrepancies = []
    above_threshold = []
    all_nonzero = []
    
    # Only scan TRC20/TRX addresses (not ERC20 - those need different API)
    tron_entries = [e for e in unique_entries if e["wallet_type"] in ("USDT-TRC20", "TRX")]
    erc20_entries = [e for e in unique_entries if e["wallet_type"] == "USDT-ERC20"]

    print(f"--- Scanning {len(tron_entries)} TRON addresses (TronGrid + Tatum comparison) ---")
    print()

    for i, entry in enumerate(tron_entries):
        addr = entry["address"]
        short = addr[:12] + "..." + addr[-6:]
        
        # Query TronGrid (direct blockchain)
        tg = check_trc20_trongrid(addr)
        
        # Query Tatum
        tt = check_trc20_tatum(addr)
        
        if tg is None and tt is None:
            print(f"  [{i+1}/{len(tron_entries)}] {short} — BOTH APIs FAILED")
            continue

        tg_usdt = tg["usdt"] if tg else 0
        tg_trx = tg["trx"] if tg else 0
        tt_usdt = tt["usdt"] if tt else 0
        tt_trx = tt["trx"] if tt else 0

        # Check for discrepancy
        usdt_diff = abs(tg_usdt - tt_usdt)
        trx_diff = abs(tg_trx - tt_trx)
        
        has_discrepancy = usdt_diff > 0.01 or trx_diff > 0.1
        has_value = tg_usdt > 0 or tg_trx > 0 or tt_usdt > 0 or tt_trx > 0
        usd_value = tg_usdt + (tg_trx * 0.317)  # rough TRX price

        if has_value:
            all_nonzero.append({**entry, "tg_usdt": tg_usdt, "tg_trx": tg_trx, "tt_usdt": tt_usdt, "tt_trx": tt_trx, "usd_est": usd_value})

        if usd_value > THRESHOLD_USD:
            above_threshold.append({**entry, "tg_usdt": tg_usdt, "tg_trx": tg_trx, "tt_usdt": tt_usdt, "tt_trx": tt_trx, "usd_est": usd_value})

        if has_discrepancy:
            discrepancies.append({
                **entry,
                "tg_usdt": tg_usdt, "tg_trx": tg_trx,
                "tt_usdt": tt_usdt, "tt_trx": tt_trx,
                "usdt_diff": usdt_diff, "trx_diff": trx_diff,
            })
            print(f"  ⚠️  [{i+1}] ID={entry['id']} {short} ({entry['table']}) status={entry['status']}")
            print(f"       TronGrid: USDT={tg_usdt:.6f}  TRX={tg_trx:.6f}")
            print(f"       Tatum:    USDT={tt_usdt:.6f}  TRX={tt_trx:.6f}")
            print(f"       DIFF:     USDT={usdt_diff:.6f}  TRX={trx_diff:.6f}")
        elif has_value:
            marker = "★" if usd_value > THRESHOLD_USD else "·"
            print(f"  {marker} [{i+1}] ID={entry['id']} {short} USDT={tg_usdt:.6f} TRX={tg_trx:.6f} (=${usd_value:.2f}) [{entry['table']}]")

    # ==========================================
    # Now scan USDT-ERC20 from legacy table
    # ==========================================
    if erc20_entries:
        print()
        print(f"--- Scanning {len(erc20_entries)} USDT-ERC20 legacy addresses via Tatum ---")
        for i, entry in enumerate(erc20_entries):
            addr = entry["address"]
            short = addr[:12] + "..." + addr[-6:]
            try:
                time.sleep(0.4)
                resp = requests.get(
                    f"{TATUM_BASE}/ethereum/account/balance/erc20/{addr}",
                    headers=TATUM_HEADERS,
                    params={"contractAddress": USDT_ERC20_CONTRACT},
                    timeout=15
                )
                if resp.status_code == 200:
                    data = resp.json()
                    bal = float(data.get("balance", 0)) / 1_000_000
                    if bal > THRESHOLD_USD:
                        print(f"  ★ [{i+1}] ID={entry['id']} {short} USDT-ERC20={bal:.6f} (=${bal:.2f})")
                        above_threshold.append({**entry, "tg_usdt": bal, "tg_trx": 0, "tt_usdt": bal, "tt_trx": 0, "usd_est": bal})
                    elif bal > 0:
                        print(f"  · [{i+1}] ID={entry['id']} {short} USDT-ERC20={bal:.6f}")
                        all_nonzero.append({**entry, "tg_usdt": bal, "tg_trx": 0, "tt_usdt": bal, "tt_trx": 0, "usd_est": bal})
                else:
                    pass  # skip errors silently for ERC20
            except Exception as e:
                print(f"  [ERROR] {short}: {e}")

    # ==========================================
    # REPORT
    # ==========================================
    print()
    print("=" * 100)
    print("  DEEP SCAN RESULTS")
    print("=" * 100)
    
    if discrepancies:
        print()
        print(f"  🚨 DISCREPANCIES FOUND: {len(discrepancies)} addresses where TronGrid ≠ Tatum")
        print("  " + "-" * 90)
        for d in discrepancies:
            print(f"    ID={d['id']} | {d['wallet_type']} | {d['address']}")
            print(f"      Table: {d['table']} | Status: {d['status']} | User: {d['user_id']}")
            print(f"      TronGrid: USDT={d['tg_usdt']:.6f} | TRX={d['tg_trx']:.6f}")
            print(f"      Tatum:    USDT={d['tt_usdt']:.6f} | TRX={d['tt_trx']:.6f}")
            print(f"      Δ USDT={d['usdt_diff']:.6f} | Δ TRX={d['trx_diff']:.6f}")
            tg_usd = d['tg_usdt'] + d['tg_trx'] * 0.317
            tt_usd = d['tt_usdt'] + d['tt_trx'] * 0.317
            print(f"      TronGrid USD≈${tg_usd:.2f} | Tatum USD≈${tt_usd:.2f}")
            print()
    else:
        print()
        print("  ✅ No discrepancies found between TronGrid and Tatum")

    print()
    if above_threshold:
        above_threshold.sort(key=lambda x: x["usd_est"], reverse=True)
        print(f"  ADDRESSES WITH >${THRESHOLD_USD} USD ({len(above_threshold)} found):")
        print("  " + "-" * 90)
        for r in above_threshold:
            print(f"    ID={r['id']:5d} | {r.get('wallet_type',''):15s} | {r['address'][:20]}...{r['address'][-8:]} | USDT={r['tg_usdt']:.6f} TRX={r['tg_trx']:.6f} | ≈${r['usd_est']:.2f} | {r['table']} | status={r['status']}")
    
    print()
    if all_nonzero:
        all_nonzero.sort(key=lambda x: x["usd_est"], reverse=True)
        print(f"  ALL NON-ZERO BALANCES ({len(all_nonzero)} found):")
        print("  " + "-" * 90)
        for r in all_nonzero:
            print(f"    ID={r['id']:5d} | {r.get('wallet_type',''):15s} | {r['address'][:20]}...{r['address'][-8:]} | USDT={r['tg_usdt']:.6f} TRX={r['tg_trx']:.6f} | ≈${r['usd_est']:.2f} | {r['table']} | status={r['status']}")

    print()
    print(f"  Scan completed at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 100)

    # Save full results
    output = {
        "scan_date": datetime.utcnow().isoformat(),
        "discrepancies": discrepancies,
        "above_threshold": above_threshold,
        "all_nonzero": all_nonzero,
    }
    with open("/app/scripts/deep_scan_results.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"  Full results saved to /app/scripts/deep_scan_results.json")


if __name__ == "__main__":
    main()
