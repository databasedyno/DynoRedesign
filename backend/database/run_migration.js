const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  host: process.env.HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    const migrationSQL = fs.readFileSync('./database/migrations/add_company_id_to_payment_links.sql', 'utf8');
    
    console.log('Running migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was added
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_payment_link' 
      AND column_name = 'company_id'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: company_id column exists');
      console.log('Column details:', result.rows[0]);
    } else {
      console.log('⚠️  Warning: company_id column not found after migration');
    }
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'tbl_payment_link' 
      AND indexname LIKE '%company%'
    `);
    
    console.log('\n✅ Indexes created:', indexResult.rows.length);
    indexResult.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
