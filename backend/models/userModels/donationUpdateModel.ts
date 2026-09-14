/**
 * DonationUpdate — organizer-authored progress post on a crowdfunding campaign.
 *
 * Belongs to a parent `tbl_payment_link` row where link_type='donation'.
 * Rendered as a chronological feed on the public campaign page. When
 * `notify_contributors=true` the update is emailed to everyone who has
 * contributed to date (heavy fan-out — used sparingly).
 */
import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const donationUpdateModel = sequelize.define(
  "Donation_Update",
  {
    update_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    campaign_link_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "tbl_payment_link", key: "link_id" },
      onDelete: "CASCADE",
    },
    /** Which team member posted the update (owner or co-organizer). */
    author_user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    /** Markdown body — rendered via the same safe renderer used for the campaign story. */
    body_md: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    /** Owner can save an update as a draft (is_published=false) — hidden from the public feed. */
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    /** When true, email everyone who has contributed so far. Sent once (idempotent). */
    notify_contributors: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_donation_update",
    timestamps: true,
  }
);

export default donationUpdateModel;
