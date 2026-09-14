import { describeAutoConvertPayout, buildAutoConvertInfo } from "../utils/autoConvertPayout";

describe("autoConvertPayout.describeAutoConvertPayout", () => {
  it("returns the on-chain hash for a completed TRC20 withdrawal", () => {
    const r = describeAutoConvertPayout({ status: "COMPLETED", withdrawal_tx_hash: "e4fb264d284fcd8294cf8bbb6ae87d1340d97342d2752c61d90ce11e4e20c32f" });
    expect(r).toEqual({ payout_tx_hash: "e4fb264d284fcd8294cf8bbb6ae87d1340d97342d2752c61d90ce11e4e20c32f", payout_offchain: false, payout_ref: null });
  });

  it("accepts 0x-prefixed EVM hashes", () => {
    const r = describeAutoConvertPayout({ status: "COMPLETED", withdrawal_tx_hash: "0x" + "ab".repeat(32) });
    expect(r.payout_tx_hash).toBe("0x" + "ab".repeat(32));
    expect(r.payout_offchain).toBe(false);
  });

  it("flags Binance internal transfers as off-chain with the marker as reference", () => {
    const r = describeAutoConvertPayout({ status: "COMPLETED", withdrawal_tx_hash: "Off-chain transfer 410062742674", withdrawal_id: "09e1c89af8" });
    expect(r).toEqual({ payout_tx_hash: null, payout_offchain: true, payout_ref: "Off-chain transfer 410062742674" });
  });

  it("returns nothing while the conversion is still pending (never leaks the deposit hash)", () => {
    const r = describeAutoConvertPayout({ status: "PENDING_DEPOSIT", withdrawal_tx_hash: null });
    expect(r).toEqual({ payout_tx_hash: null, payout_offchain: false, payout_ref: null });
  });
});

describe("autoConvertPayout.buildAutoConvertInfo", () => {
  it("is null for non-converted rows", () => {
    expect(buildAutoConvertInfo({ auto_convert_id: null })).toBeNull();
  });

  it("maps the joined row and merges the payout description", () => {
    const info = buildAutoConvertInfo({
      auto_convert_id: 7, auto_convert_status: "COMPLETED", auto_convert_source_currency: "ETH", auto_convert_source_amount: "0.02068630",
      auto_convert_target_currency: "USDT", auto_convert_target_amount: "50.41190800", auto_convert_settlement_chain: "TRC20",
      auto_convert_settlement_wallet: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR", auto_convert_withdrawal_tx_hash: "Off-chain transfer 410062742674",
      auto_convert_withdrawal_id: "09e1c89af8124dccb3f24c5c0d1b51b1", auto_convert_merchant_payout_usd: "48.91", auto_convert_withdrawal_fee: "1.5",
    })!;
    expect(info.conversion_id).toBe(7);
    expect(info.source_amount).toBe(0.0206863);
    expect(info.merchant_payout_usd).toBe(48.91);
    expect(info.settlement_wallet_address).toBe("TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR");
    expect(info.payout_offchain).toBe(true);
    expect(info.payout_tx_hash).toBeNull();
    expect(info.payout_ref).toBe("Off-chain transfer 410062742674");
  });
});
