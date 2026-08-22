import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const subscriptionModel = sequelize.define(
  "Subscription",
  {
    subscription_id: {
      type: DataTypes.STRING,
    },
    flw_subscription_id: {
      type: DataTypes.STRING,
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_plan",
        key: "plan_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.STRING,
    },
    // Customer contact captured at creation so cancellation / lifecycle emails
    // can reach the subscriber (the Flutterwave id alone doesn't carry it).
    customer_email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    customer_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_subscription",
  }
);

// subscriptionModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_subscription created"));

export default subscriptionModel;
