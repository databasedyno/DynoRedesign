import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';
import { apiLogger } from '../../utils/loggers';

/**
 * Feedback for STATIC (non-DB) help-center articles, keyed by slug.
 *
 * DB-backed articles record feedback in tbl_kb_article_feedback (FK article_id).
 * Hand-authored / stub articles have no DB row, so QA (PUB-007 #5) could not
 * submit "Was this helpful?" on them. This additive table captures that feedback
 * by slug — creating it does not touch any existing table.
 */
interface KBStaticFeedbackAttributes {
  feedback_id: number;
  slug: string;
  is_helpful: boolean;
  feedback_text?: string | null;
  user_ip?: string | null;
  createdAt?: Date;
}

interface KBStaticFeedbackCreationAttributes
  extends Optional<KBStaticFeedbackAttributes, 'feedback_id' | 'createdAt'> {}

class KBStaticFeedback
  extends Model<KBStaticFeedbackAttributes, KBStaticFeedbackCreationAttributes>
  implements KBStaticFeedbackAttributes
{
  public feedback_id!: number;
  public slug!: string;
  public is_helpful!: boolean;
  public feedback_text?: string | null;
  public user_ip?: string | null;
  public readonly createdAt!: Date;
}

KBStaticFeedback.init(
  {
    feedback_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
    tableName: 'tbl_kb_static_feedback',
    timestamps: false,
    indexes: [{ fields: ['slug'] }],
  }
);

// Lazily create the table once (idempotent). alter:false → never mutates schema.
let ensurePromise: Promise<void> | null = null;
export function ensureKbStaticFeedbackTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await KBStaticFeedback.sync({ alter: false });
      apiLogger.info('[KB] static-feedback table ensured (tbl_kb_static_feedback)');
    })().catch((e) => {
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

export default KBStaticFeedback;
