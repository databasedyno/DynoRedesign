import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface KBArticleAttributes {
  article_id: number;
  category_id?: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  content_html?: string;
  author_id?: number;
  featured_image_url?: string;
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  is_published: boolean;
  published_at?: Date;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  reading_time_minutes?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface KBArticleCreationAttributes extends Optional<KBArticleAttributes, 'article_id' | 'views_count' | 'helpful_count' | 'not_helpful_count' | 'is_published' | 'createdAt' | 'updatedAt'> {}

class KBArticle extends Model<KBArticleAttributes, KBArticleCreationAttributes> implements KBArticleAttributes {
  public article_id!: number;
  public category_id?: number;
  public title!: string;
  public slug!: string;
  public excerpt?: string;
  public content!: string;
  public content_html?: string;
  public author_id?: number;
  public featured_image_url?: string;
  public views_count!: number;
  public helpful_count!: number;
  public not_helpful_count!: number;
  public is_published!: boolean;
  public published_at?: Date;
  public meta_title?: string;
  public meta_description?: string;
  public meta_keywords?: string;
  public reading_time_minutes?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

KBArticle.init(
  {
    article_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_kb_category',
        key: 'category_id',
      },
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    featured_image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    views_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    helpful_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    not_helpful_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    meta_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    meta_keywords: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reading_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    tableName: 'tbl_kb_article',
    timestamps: true,
  }
);

export default KBArticle;
