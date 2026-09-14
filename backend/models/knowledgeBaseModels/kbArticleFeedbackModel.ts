import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface KBArticleFeedbackAttributes {
  feedback_id: number;
  article_id: number;
  user_id?: number;
  is_helpful: boolean;
  feedback_text?: string;
  user_ip?: string;
  createdAt?: Date;
}

interface KBArticleFeedbackCreationAttributes extends Optional<KBArticleFeedbackAttributes, 'feedback_id' | 'createdAt'> {}

class KBArticleFeedback extends Model<KBArticleFeedbackAttributes, KBArticleFeedbackCreationAttributes> implements KBArticleFeedbackAttributes {
  public feedback_id!: number;
  public article_id!: number;
  public user_id?: number;
  public is_helpful!: boolean;
  public feedback_text?: string;
  public user_ip?: string;
  public readonly createdAt!: Date;
}

KBArticleFeedback.init(
  {
    feedback_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    article_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_kb_article',
        key: 'article_id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    is_helpful: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    feedback_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    user_ip: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_kb_article_feedback',
    timestamps: false,
  }
);

export default KBArticleFeedback;
