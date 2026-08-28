import sequelize from '../../utils/dbInstance';

/**
 * Adds nullable customer_email / customer_name to tbl_subscription so
 * subscription lifecycle emails (created / cancelled) can reach the subscriber.
 * Idempotent + non-destructive.
 */
async function addSubscriptionCustomerColumns() {
  try {
    await sequelize.query(`
      ALTER TABLE tbl_subscription
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_name  VARCHAR(255)
    `);
    console.log('✅ tbl_subscription.customer_email / customer_name ready');
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

addSubscriptionCustomerColumns();
