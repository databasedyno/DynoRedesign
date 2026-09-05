import { DataTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";

/**
 * QA / Quality Center models.
 *
 * Two additive Postgres tables backing the passcode-gated /quality page:
 *   - tbl_qa_comment       one row per saved note (running thread per test item)
 *   - tbl_qa_custom_item   QA-authored custom test items (not in the static catalog)
 *
 * These are brand-new tables; creating them does not touch any existing data.
 */

export const QA_STATUSES = ["pass", "fail", "blocked", "not_tested"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];

const qaCommentModel = sequelize.define(
  "tbl_qa_comment",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    // Stable key that identifies the test item this note belongs to.
    // Catalog items: `${sectionId}::${caseId}`. Custom items: `custom::${id}`.
    item_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    section_id: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    section_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    case_title: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    tester: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "not_tested",
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_qa_comment",
    timestamps: false,
    indexes: [{ fields: ["item_key"] }],
  }
);

const qaCustomItemModel = sequelize.define(
  "tbl_qa_custom_item",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    item_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    area: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "tbl_qa_custom_item",
    timestamps: false,
  }
);

// Lazily create the tables once (idempotent). Guarded so concurrent requests
// only trigger a single sync. alter:false → never mutates existing schema.
let ensurePromise: Promise<void> | null = null;
export function ensureQaTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await qaCommentModel.sync({ alter: false });
      await qaCustomItemModel.sync({ alter: false });
      apiLogger.info("[QA] quality-center tables ensured (tbl_qa_comment, tbl_qa_custom_item)");
    })().catch((e) => {
      // Reset so a later request can retry if the first attempt failed.
      ensurePromise = null;
      throw e;
    });
  }
  return ensurePromise;
}

export { qaCommentModel, qaCustomItemModel };
export default qaCommentModel;
