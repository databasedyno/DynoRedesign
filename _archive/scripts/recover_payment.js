/**
 * Manual Payment Recovery Script
 * Recovers stuck payment 13a02388-f14e-4d03-b1dd-5e40cd4de2fb
 */

const mongoose = require('mongoose');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'db_bozzwallet';
const PAYMENT_ID = '13a02388-f14e-4d03-b1dd-5e40cd4de2fb';

async function recoverPayment() {
  try {
    console.log('🔧 Connecting to database...');
    await mongoose.connect(`${MONGO_URL}/${DB_NAME}`);
    
    const db = mongoose.connection.db;
    
    // Find the stuck payment
    console.log(`\n🔍 Finding payment ${PAYMENT_ID}...`);
    const payment = await db.collection('tbl_merchant_temp_address').findOne({
      payment_id: PAYMENT_ID
    });
    
    if (!payment) {
      console.log('❌ Payment not found');
      process.exit(1);
    }
    
    console.log(`\n📊 Current Status:`);
    console.log(`   Payment ID: ${payment.payment_id}`);
    console.log(`   Address: ${payment.address}`);
    console.log(`   Amount: ${payment.received_amount} USDT-TRC20`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Currency: ${payment.currency}`);
    
    // Reset status to allow retry
    console.log(`\n🔄 Resetting payment status to trigger retry...`);
    
    const result = await db.collection('tbl_merchant_temp_address').updateOne(
      { payment_id: PAYMENT_ID },
      {
        $set: {
          status: 'cryptoVerification_pass',  // Reset to pass verification stage
          updatedAt: new Date(),
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Payment status reset successfully');
      console.log('\n📝 Next Steps:');
      console.log('   1. Payment will be picked up by next webhook/cron cycle');
      console.log('   2. SmartGas will fund TRX from fee wallet (143.98 TRX available)');
      console.log('   3. Settlement should complete within 5-15 minutes');
      console.log('\n⏰ Monitor logs with:');
      console.log('   tail -f /var/log/supervisor/backend.out.log | grep "13a02388"');
    } else {
      console.log('⚠️ No changes made - payment may already be processed');
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recoverPayment();
