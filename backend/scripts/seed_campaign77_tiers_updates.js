require("dotenv").config({ path: "/app/backend/.env" });
const { Sequelize } = require("sequelize");
const s = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST, port: process.env.DB_PORT, dialect: "postgres",
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false,
});
(async () => {
  // Clear existing seed rows to keep the migration idempotent for reruns.
  await s.query("DELETE FROM tbl_donation_tier WHERE parent_link_id = 77");
  await s.query("DELETE FROM tbl_donation_update WHERE campaign_link_id = 77");

  // Seed 4 tiers
  const tiers = [
    { min: 5,    title: "Coffee tier",    desc: "Buy the team a virtual coffee. We'll shout you out in the next update." },
    { min: 25,   title: "Backer",         desc: "Your name on our public wall of supporters + early access to the beta." },
    { min: 100,  title: "Sponsor",        desc: "Everything in Backer + a signed Dynopay sticker pack shipped anywhere." },
    { min: 500,  title: "Partner",        desc: "Everything in Sponsor + a 1-on-1 call with the founding team + your logo on our thank-you page." },
  ];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    await s.query(
      `INSERT INTO tbl_donation_tier (parent_link_id, min_amount, title, description, "order", is_active, "createdAt", "updatedAt")
       VALUES (77, :min, :title, :desc, :ord, TRUE, NOW(), NOW())`,
      { replacements: { min: t.min, title: t.title, desc: t.desc, ord: i } }
    );
  }
  console.log(`Seeded ${tiers.length} tiers`);

  // Seed 3 updates (newest first)
  const updates = [
    {
      title: "Day 5: We hit $2,000 — thank you!",
      body: "## Milestone unlocked 🎉\n\nWe hit **$2,000** in the first 5 days thanks to 41 amazing contributors.\n\n### What's next\n\n- Ship the merchant edit UI for tiers and updates (this week)\n- Publish the campaign directory next week\n- Start filming the launch video\n\nMore soon — you're all incredible.",
    },
    {
      title: "Community call this Friday",
      body: "We're hosting an **open community call this Friday at 3pm UTC** to talk through the roadmap and answer any questions.\n\n[Join the call](https://meet.example.com/dynopay-community) — no signup, just show up. Bring questions, bring memes.",
    },
    {
      title: "Welcome — here's how we'll spend the money",
      body: "Thanks for stopping by. Here's the plan in one sentence:\n\n> **50% dev bounties, 30% infra, 20% free tier for non-profits.**\n\nWe post updates every 3-4 days. If you'd rather not get emails, you can mute them in your Dynopay profile settings.",
    },
  ];
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    // Post them with staggered createdAt so the feed ordering is realistic
    const created = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);
    await s.query(
      `INSERT INTO tbl_donation_update (campaign_link_id, author_user_id, title, body_md, is_published, notify_contributors, "createdAt", "updatedAt")
       VALUES (77, 1, :title, :body, TRUE, FALSE, :created, :created)`,
      { replacements: { title: u.title, body: u.body, created } }
    );
  }
  console.log(`Seeded ${updates.length} updates`);

  await s.close();
})();
