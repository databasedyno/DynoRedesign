import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

/**
 * Records merchant onboarding-checklist engagement events so we can measure
 * where new merchants drop off during setup.
 *
 * event_type: checklist_shown | step_clicked | step_completed | dismissed | collapsed | expanded
 * step_key:   company | wallet | link  (for step_* events)
 */
const onboardingEventModel = sequelize.define(
  "OnboardingEvent",
  {
    id: {
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
    event_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    step_key: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    completed_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_onboarding_event",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["user_id"] },
      { fields: ["event_type"] },
      { fields: ["created_at"] },
    ],
  }
);

export default onboardingEventModel;
