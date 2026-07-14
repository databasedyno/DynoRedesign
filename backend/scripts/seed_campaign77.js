require("dotenv").config({ path: "/app/backend/.env" });
const { Sequelize } = require("sequelize");
const s = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST, port: process.env.DB_PORT, dialect: "postgres",
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false,
});
(async () => {
  const story = [
    "## Why we're raising \\$10,000",
    "",
    "We're building an **open-source** platform to help creators, merchants, and community organizers accept crypto payments without giving up custody of their funds.",
    "",
    "### Where your contribution goes",
    "",
    "- **50%** goes toward developer bounties for feature requests from real users",
    "- **30%** covers hosting, monitoring, and security audits",
    "- **20%** funds a free tier for non-profits",
    "",
    "### Timeline",
    "",
    "1. **Week 1-2:** Ship crowdfunding v2 (rich stories, donor wall, tiers)",
    "2. **Week 3-4:** Ship inline drawers for merchant workflows",
    "3. **Month 2:** Launch the public campaign directory at [/campaigns](/campaigns)",
    "",
    "> Every contribution helps us keep this free and open for everyone. Thank you.",
    "",
    "If you'd rather send us a message than contribute, reach out at hi@dynopay.com.",
  ].join("\n").replace(/\\\$/g, "$"); // unescape shell-safe dollars

  await s.query(
    "UPDATE tbl_payment_link SET donation_story_md = :story WHERE link_id = 77",
    { replacements: { story } }
  );
  const [r] = await s.query("SELECT SUBSTRING(donation_story_md, 1, 60) as s FROM tbl_payment_link WHERE link_id = 77");
  console.log("Seed OK:", r[0].s);
  await s.close();
})();
