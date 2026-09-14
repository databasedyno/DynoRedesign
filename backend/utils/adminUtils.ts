export const getAdminWalletAddress = (currency: string): string | null => {
    const mapping: { [key: string]: string } = {
        BTC: "BTC",
        LTC: "LTC",
        DOGE: "DOGE",
        ETH: "ETH",
        TRX: "TRX",
        "USDT-TRC20": "USDT_TRC20",
        "USDT-ERC20": "USDT_ERC20",
        "USDC-ERC20": "USDC_ERC20",
        BCH: "BCH",
        SOL: "SOL",
        XRP: "XRP",
        RLUSD: "RLUSD_ADMIN_WALLET",
        "RLUSD-ERC20": "RLUSD_ERC20",
        POLYGON: "POLYGON",
        "USDT-POLYGON": "USDT_POLYGON",
    };

    const envKey = mapping[currency];
    if (!envKey) {
        return null;
    }

    return process.env[envKey] || null;
};
