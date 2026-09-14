import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const feesModel = sequelize.define(
  "Fee_Model",
  {
    fee_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    feeType: {
      type: DataTypes.STRING,
    },
    fee: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    tableName: "tbl_fees",
  }
);

// feesModel.sync({ alter: false }).then(() => console.log("tbl_fees created"));
export default feesModel;
