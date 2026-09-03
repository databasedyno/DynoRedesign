/**
 * Direct test of BTC fee estimation to trigger mempool.space guard
 */

const tatumApi = require('./backend/apis/tatumApi');

async function testBTCFeeEstimation() {
    console.log('='.repeat(80));
    console.log('Testing BTC Fee Estimation with mempool.space guard');
    console.log('='.repeat(80));
    console.log('');
    
    try {
        // Test BTC fee estimation
        console.log('1. Testing BTC fee estimation...');
        const btcFees = await tatumApi.feeEstimation(
            'BTC',
            '1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7',  // from address
            '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',  // to address (Satoshi's address)
            0.001  // amount
        );
        
        console.log('✅ BTC fee estimation completed');
        console.log('   Fast:', btcFees.fast, 'BTC');
        console.log('   Medium:', btcFees.medium, 'BTC');
        console.log('   Slow:', btcFees.slow, 'BTC');
        console.log('');
        
        // Test ETH fee estimation (should NOT trigger mempool.space)
        console.log('2. Testing ETH fee estimation (should NOT use mempool.space)...');
        const ethFees = await tatumApi.feeEstimation(
            'ETH',
            '0x9a7221b5e32d5f99e8da95585835442e29afb38f',
            '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            0.01
        );
        
        console.log('✅ ETH fee estimation completed');
        console.log('   Gas price:', ethFees.gasPrice, 'wei');
        console.log('   Gas limit:', ethFees.gasLimit);
        console.log('');
        
        // Test USDT-ERC20 fee estimation (should NOT trigger mempool.space)
        console.log('3. Testing USDT-ERC20 fee estimation (should NOT use mempool.space)...');
        const usdtFees = await tatumApi.feeEstimation(
            'USDT-ERC20',
            '0x9a7221b5e32d5f99e8da95585835442e29afb38f',
            '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            10,
            process.env.ETH_CONTRACT
        );
        
        console.log('✅ USDT-ERC20 fee estimation completed');
        console.log('   Gas price:', usdtFees.gasPrice, 'wei');
        console.log('   Gas limit:', usdtFees.gasLimit);
        console.log('');
        
        console.log('='.repeat(80));
        console.log('All fee estimations completed successfully!');
        console.log('Check backend logs for [feeEstimation] messages with mempool.space');
        console.log('Expected: BTC should show mempool.space logs, ETH/USDT should NOT');
        console.log('='.repeat(80));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during fee estimation:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testBTCFeeEstimation();
