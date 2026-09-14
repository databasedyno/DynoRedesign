/**
 * Session 42 test cleanup — deletes tip contribution rows created during
 * the Inline Tip Checkout functional testing. Merchant-pool addresses that
 * were RESERVED during tests auto-release after RESERVATION_TIMEOUT_MINUTES.
 * Idempotent: safe to run multiple times.
 */
import { paymentLinkModel } from "../models";
import sequelize from "../utils/dbInstance";
import { Op } from "sequelize";

(async () => {
  try {
    const testDonorNames = [
      "CurlTest", "Curl2", "Curl3", "Curl4", "Curl5",
      "QA Tipper", "QA Tester", "InlineQA", "InlineOK",
    ];
    const testChildren = await paymentLinkModel.findAll({
      where: {
        link_type: "contribution",
        donor_name: { [Op.in]: testDonorNames },
        createdAt: { [Op.gt]: new Date(Date.now() - 4 * 60 * 60 * 1000) }, // last 4h
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Found ${testChildren.length} test contribution rows to delete`);
    for (const c of testChildren) {
      const linkId = (c.dataValues as any).link_id;
      const donor = (c.dataValues as any).donor_name;
      // eslint-disable-next-line no-console
      console.log(` - Deleting link_id=${linkId} donor=${donor}`);
      await paymentLinkModel.destroy({ where: { link_id: linkId } });
    }

    const tipJar = await paymentLinkModel.findOne({ where: { is_tip_jar: true } });
    if (tipJar) {
      // eslint-disable-next-line no-console
      console.log(
        `\nTip-jar parent kept (correct): link_id=${(tipJar.dataValues as any).link_id} user_id=${(tipJar.dataValues as any).user_id}`,
      );
    }

    // eslint-disable-next-line no-console
    console.log("\nCleanup done. Merchant-pool RESERVED addresses auto-release in ~2h.");
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Cleanup failed:", e);
    process.exit(1);
  }
})();
