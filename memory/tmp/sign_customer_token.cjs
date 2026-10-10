// Usage: node sign_customer_token.cjs <customer_id>  — test-only customer JWT (read-only checks).
require("/app/backend/node_modules/dotenv").config({ path: "/app/backend/.env" });
const jwt = require("/app/backend/node_modules/jsonwebtoken");
process.stdout.write(jwt.sign({ customer_id: Number(process.argv[2]) }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10m" }));
