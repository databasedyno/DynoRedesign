import { raw as envRaw } from "./config";
export interface FeeTier {
    min: number;
    max: number | null;
    fixed: number;
}

export const getBlockchainThreshold = (blockchain: string): number => {
    const envKey = `${blockchain.replace(/-/g, '_').toUpperCase()}_THRESHOLD`;
    const val = Number(process.env[envKey]);
    return isNaN(val) ? 5 : val;
};

export const getTransactionFeePercent = (): number => {
    const val = Number(envRaw("TRANSACTION_FEE_PERCENT"));
    return isNaN(val) ? 1.5 : val;
};

export const getFeeTiers = (): FeeTier[] => {
    // Check for individual tier format
    if (envRaw("FEE_TIER_1_MIN")) {
        const tiers: FeeTier[] = [];
        let tierNum = 1;
        
        while (process.env[`FEE_TIER_${tierNum}_MIN`]) {
            const min = Number(process.env[`FEE_TIER_${tierNum}_MIN`]);
            const maxStr = process.env[`FEE_TIER_${tierNum}_MAX`];
            const max = (maxStr === '' || maxStr === undefined || maxStr === null || Number(maxStr) === 0) ? null : Number(maxStr);
            const fixed = Number(process.env[`FEE_TIER_${tierNum}_FIXED`]);
            
            tiers.push({ min, max, fixed });
            tierNum++;
        }
        
        if (tiers.length > 0) return tiers;
    }
    
    // Legacy format support: BLOCKCHAIN_FEE_TIERS
    const tierString = envRaw("BLOCKCHAIN_FEE_TIERS");
    if (tierString) {
        return tierString.split(',').map(tier => {
            const [range, fee] = tier.split(':');
            const fixed = parseFloat(fee);

            if (range.includes('+')) {
                const min = parseFloat(range.replace('+', ''));
                return { min, max: null, fixed };
            }

            const [min, max] = range.split('-').map(Number);
            return { min, max, fixed };
        });
    }
    
    // Default tiers
    return [
        { min: 1, max: 100, fixed: 1 },
        { min: 101, max: 500, fixed: 1 },
        { min: 501, max: 1000, fixed: 1 },
        { min: 1001, max: null, fixed: 1 }
    ];
};
