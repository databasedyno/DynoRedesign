// One-off, reversible: set tbl_user.name for a given email. Prints old + new.
// Usage: node scripts/set_user_name.js "onarrival21@gmail.com" "John Davis"
require("dotenv").config();
const { Client } = require("pg");

(async () => {
  const email = process.argv[2];
  const newName = process.argv[3];
  if (!email || !newName) {
    console.error("Usage: node set_user_name.js <email> <name>");
    process.exit(1);
  }
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const before = await client.query(
      "SELECT user_id, name, email FROM tbl_user WHERE lower(email)=lower($1)",
      [email]
    );
    if (before.rowCount === 0) {
      console.log("NOT FOUND for email:", email);
      return;
    }
    console.log("BEFORE:", JSON.stringify(before.rows[0]));
    const res = await client.query(
      "UPDATE tbl_user SET name=$1, \"updatedAt\"=NOW() WHERE lower(email)=lower($2) RETURNING user_id, name, email",
      [newName, email]
    );
    console.log("AFTER :", JSON.stringify(res.rows[0]), "| rows:", res.rowCount);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
