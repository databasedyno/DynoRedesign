import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userExchangeModel = sequelize.define(
  "User",
  {
    exchange_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user1_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user2_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    transaction_id: {
      type: DataTypes.STRING,
    },
    req_currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    exchange_currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount_in_usd: {
      type: DataTypes.FLOAT,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    expiresAt: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "tbl_user_exchange",
  }
);

// userExchangeModel.sync({ alter: false }).then(() => console.log("tbl_user_exchange created"));

export default userExchangeModel;
