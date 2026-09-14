import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const kycModel = sequelize.define(
  "KYC",
  {
    kyc_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    company_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      // Status values: pending, submitted, approved, resubmission_requested, declined, abandoned
    },
    documents: {
      type: DataTypes.JSONB,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    volume_threshold: {
      type: DataTypes.DECIMAL(18, 2),
    },
    submitted_at: {
      type: DataTypes.DATE,
    },
    reviewed_at: {
      type: DataTypes.DATE,
    },
    // Veriff integration fields
    veriff_session_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    veriff_session_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    veriff_verification_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    veriff_decision: {
      type: DataTypes.STRING(50),
      allowNull: true,
      // Decision values: approved, declined, resubmission_requested, expired, abandoned
    },
    veriff_decision_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    veriff_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_kyc",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

export default kycModel;
