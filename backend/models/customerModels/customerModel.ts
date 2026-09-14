import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const customerModel = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.STRING,
      unique: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    customer_name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "tbl_customer",
  }
);

// customerModel.sync({ alter: false }).then(() => console.log("tbl_customer created"));

export default customerModel;
