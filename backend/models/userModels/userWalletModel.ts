import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userWalletModel = sequelize.define(
  "Wallet",
  {
    wallet_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    // Phase 1: Company scoping
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    // Phase 1: Wallet name
    wallet_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    wallet_type: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    // XRP/RLUSD destination tag for forwarded payments (exchanges require this)
    destination_tag: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null,
    },
    currency_type: {
      type: DataTypes.ENUM("FIAT", "CRYPTO"),
      defaultValue: "FIAT",
    },
  },
  {
    tableName: "tbl_user_wallet",
    timestamps: true,
    freezeTableName: true,
  }
);

// userWalletModel.sync({ alter: false }).then(() => console.log("tbl_user_wallet created"));

export default userWalletModel;
