import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const adminTransferFeeModel = sequelize.define(
  "Admin_Transfer",
  {
    transfer_speed_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wallet_type: {
      type: DataTypes.STRING,
    },
    speed: {
      type: DataTypes.STRING,
      defaultValue: "SLOW",
    },
  },
  {
    tableName: "tbl_admin_fee_transfer",
  }
);

// adminTransferFeeModel.sync({ alter: false }).then(() => console.log("tbl_admin_fee_transfer created"));

export default adminTransferFeeModel;
