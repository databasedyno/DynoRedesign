import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const customerWalletModel = sequelize.define(
  "Customer_Wallet",
  {
    id: {
      type: DataTypes.STRING,
      unique: true,
    },
    wallet_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_customer",
        key: "customer_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    wallet_type: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
  },
  {
    tableName: "tbl_customer_wallet",
  }
);

// customerWalletModel.sync({ alter: false }).then(() => console.log("tbl_customer_wallet created"));

export default customerWalletModel;
