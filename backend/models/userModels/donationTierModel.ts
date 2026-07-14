/**
 * DonationTier — milestone reward tier for a crowdfunding campaign.
 *
 * Belongs to a parent `tbl_payment_link` row where link_type='donation'.
 * Contributors donating at or above `min_amount` unlock the tier's reward.
 * Multiple tiers per campaign are supported and rendered in `order` sequence.
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const donationTierModel = sequelize.define(
  "Donation_Tier",
  {
    tier_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    parent_link_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_payment_link", key: "link_id" },
      onDelete: "CASCADE",
    },
    /** Contributions ≥ this amount (in the campaign's base currency) qualify for this tier. */
    min_amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    /** Display order — lower first. Ties break by tier_id. */
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "tbl_donation_tier",
    timestamps: true,
  }
);

export default donationTierModel;
