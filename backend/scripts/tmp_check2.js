const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config({ path: '/app/backend/.env' });
const s = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST, port: process.env.DB_PORT, dialect: 'postgres', logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});
(async () => {
  const companies = await s.query(`SELECT company_id, company_name, user_id FROM tbl_company WHERE user_id=1`, { type: QueryTypes.SELECT });
  console.log('hostbay companies:', JSON.stringify(companies));
  await s.close();
})().catch(e => { console.error(e.message); process.exit(1); });
