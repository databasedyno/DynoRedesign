const { Client } = require('pg');

async function getApiKey() {
  const client = new Client({
    user: 'postgres',
    password: 'oYLtGbXGKLFLWjoEbLjzxOzTXPLtJXQV',
    host: 'tramway.proxy.rlwy.net',
    port: 57376,
    database: 'db_bozzwallet',
    ssl: false
  });

  try {
    await client.connect();
    
    const result = await client.query(
      'SELECT "apiKey", base_currency, company_id FROM tbl_api LIMIT 5'
    );
    
    if (result.rows.length > 0) {
      console.log('Available API Keys:');
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. API Key: ${row.apiKey}`);
        console.log(`   Company ID: ${row.company_id}`);  
        console.log(`   Base Currency: ${row.base_currency}`);
        console.log('');
      });
      
      // Return the first API key for testing
      return result.rows[0].apiKey;
    } else {
      console.log('No API keys found');
      return null;
    }
  } catch (error) {
    console.error('Error:', error);
    return null;
  } finally {
    await client.end();
  }
}

getApiKey().then(apiKey => {
  if (apiKey) {
    process.stdout.write(apiKey);
  }
});