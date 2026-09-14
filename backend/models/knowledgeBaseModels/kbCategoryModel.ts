import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface KBCategoryAttributes {
  category_id: number;
  category_name: string;
  category_slug: string;
  category_icon?: string;
  description?: string;
  parent_category_id?: number;
  display_order: number;
  is_active: boolean;
  article_count: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface KBCategoryCreationAttributes extends Optional<KBCategoryAttributes, 'category_id' | 'display_order' | 'is_active' | 'article_count' | 'createdAt' | 'updatedAt'> {}

class KBCategory extends Model<KBCategoryAttributes, KBCategoryCreationAttributes> implements KBCategoryAttributes {
  public category_id!: number;
  public category_name!: string;
  public category_slug!: string;
  public category_icon?: string;
  public description?: string;
  public parent_category_id?: number;
  public display_order!: number;
  public is_active!: boolean;
  public article_count!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

KBCategory.init(
  {
    category_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    category_slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    category_icon: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_kb_category',
        key: 'category_id',
      },
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    article_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_kb_category',
    timestamps: true,
  }
);

export default KBCategory;
