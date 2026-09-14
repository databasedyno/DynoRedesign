// Recovery script: Send 19 USDT-TRC20 from stuck temp address to admin wallet
// Uses: PostgreSQL (DB) → KMS decrypt → Tatum API → TRON transfer

require('dotenv').config({ path: '/app/backend/.env' });
const { Sequelize, DataTypes } = require('sequelize');

// DB connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
      keepAlive: true,
    },
    logging: false,
  }
);

async function main() {
  console.log('=== STUCK PAYMENT RECOVERY ===');
  console.log('Temp Address: TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf');
  console.log('Target: TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR (admin wallet)');
  console.log('Amount: 19 USDT-TRC20');
  console.log('');

  // Step 1: Connect to DB
  await sequelize.authenticate();
  console.log('✅ Database connected');

  // Step 2: Find the merchant pool address record
  const [results] = await sequelize.query(
    `SELECT id, wallet_type, wallet_address, private_key, status, derivation_index, subscription_id
     FROM tbl_merchant_pool_addresses 
     WHERE wallet_address = 'TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf'`
  );

  if (!results || results.length === 0) {
    console.log('❌ Address not found in merchant pool table');
    
    // Try customer wallets
    const [custResults] = await sequelize.query(
      `SELECT id, wallet_type, wallet_address, private_key
       FROM tbl_customer_wallets 
       WHERE wallet_address = 'TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf'`
    );
    
    if (custResults && custResults.length > 0) {
      console.log('Found in customer wallets:', custResults[0]);
    } else {
      console.log('❌ Not found in customer wallets either');
      
      // Search all tables for this address
      const [tables] = await sequelize.query(`
        SELECT table_name FROM information_schema.columns 
        WHERE column_name = 'wallet_address' AND table_schema = 'public'
      `);
      console.log('\nTables with wallet_address column:', tables.map(t => t.table_name));
      
      for (const table of tables) {
        const [rows] = await sequelize.query(
          `SELECT * FROM "${table.table_name}" WHERE wallet_address = 'TPyhJAKj8zQGcqWm6qtKZGkjJ9yLcCigJf' LIMIT 1`
        );
        if (rows && rows.length > 0) {
          console.log(`\n✅ Found in ${table.table_name}:`);
          console.log('  Keys:', Object.keys(rows[0]).join(', '));
          console.log('  Has private_key:', !!rows[0].private_key);
          console.log('  private_key length:', rows[0].private_key ? rows[0].private_key.length : 0);
          console.log('  status:', rows[0].status);
          console.log('  wallet_type:', rows[0].wallet_type);
        }
      }
    }
    
    await sequelize.close();
    return;
  }

  const record = results[0];
  console.log('✅ Found merchant pool address:');
  console.log('  ID:', record.id);
  console.log('  Type:', record.wallet_type);
  console.log('  Status:', record.status);
  console.log('  Has encrypted private_key:', !!record.private_key);
  console.log('  Private key length:', record.private_key ? record.private_key.length : 0);
  console.log('  Private key preview:', record.private_key ? record.private_key.substring(0, 20) + '...' : 'N/A');

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
