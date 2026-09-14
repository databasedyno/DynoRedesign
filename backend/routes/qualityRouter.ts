import express, { Request, Response, NextFunction } from "express";
import {
  qaCommentModel,
  qaCustomItemModel,
  qaItemMetaModel,
  ensureQaTables,
  QA_STATUSES,
} from "../models/qaModels";
import { apiLogger } from "../utils/loggers";

const router = express.Router();

// Shared QA passcode. Overridable via env; falls back to the agreed value so the
// page works in every environment without needing a vault reseal.
const QA_PASSCODE = process.env.QA_PASSCODE || "Dynopay123@";

/** Reject any request that doesn't present the correct passcode. */
function requirePasscode(req: Request, res: Response, next: NextFunction) {
  const provided =
    (req.headers["x-qa-passcode"] as string) ||
    (req.body && req.body.passcode) ||
    (req.query && (req.query.passcode as string)) ||
    "";
  if (provided !== QA_PASSCODE) {
    return res.status(401).json({ ok: false, error: "Invalid passcode" });
  }
  return next();
}

/** Ensure the QA tables exist before touching them. */
async function withTables(res: Response, fn: () => Promise<void>) {
  try {
    await ensureQaTables();
    await fn();
  } catch (err: any) {
    apiLogger.error("[QA] quality endpoint error", { error: err?.message });
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: "Server error" });
    }
  }
}

// ── Auth: validate passcode ────────────────────────────────────────────────
router.post("/auth", requirePasscode, (_req, res) => {
  res.json({ ok: true });
});

// ── Read everything: all comments (grouped by item) + custom items + meta ──
router.get("/data", requirePasscode, (_req, res) =>
  withTables(res, async () => {
    const [comments, customItems, metas] = await Promise.all([
      qaCommentModel.findAll({ order: [["created_at", "ASC"]], raw: true }),
      qaCustomItemModel.findAll({ order: [["created_at", "ASC"]], raw: true }),
      qaItemMetaModel.findAll({ raw: true }),
    ]);

    // Group comments by item_key for the UI.
    const byItem: Record<string, any[]> = {};
    for (const c of comments as any[]) {
      (byItem[c.item_key] = byItem[c.item_key] || []).push(c);
    }
    // Key meta by item_key too.
    const metaByItem: Record<string, any> = {};
    for (const m of metas as any[]) {
      metaByItem[m.item_key] = m;
    }
    res.json({ ok: true, commentsByItem: byItem, customItems, metaByItem });
  })
);

// ── Upsert item meta (assignee / release sign-off) ─────────────────────────
router.put("/meta", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const { item_key, section_id, section_title, case_title, assignee, signed_off, signed_off_by } =
      req.body || {};
    if (!item_key || typeof item_key !== "string") {
      res.status(400).json({ ok: false, error: "item_key is required" });
      return;
    }
    const key = String(item_key).slice(0, 255);
    const [row] = await qaItemMetaModel.findOrCreate({
      where: { item_key: key },
      defaults: { item_key: key },
    });
    const patch: Record<string, any> = { updated_at: new Date() };
    if (section_id !== undefined) patch.section_id = section_id ? String(section_id).slice(0, 120) : null;
    if (section_title !== undefined) patch.section_title = section_title ? String(section_title).slice(0, 255) : null;
    if (case_title !== undefined) patch.case_title = case_title ? String(case_title).slice(0, 500) : null;
    if (assignee !== undefined) patch.assignee = assignee ? String(assignee).slice(0, 160) : null;
    if (signed_off !== undefined) {
      patch.signed_off = !!signed_off;
      patch.signed_off_by = signed_off ? (signed_off_by ? String(signed_off_by).slice(0, 160) : null) : null;
      patch.signed_off_at = signed_off ? new Date() : null;
    }
    await row.update(patch);
    res.json({ ok: true, meta: row });
  })
);

// ── Add a note/comment to a test item ──────────────────────────────────────
router.post("/comment", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const { item_key, section_id, section_title, case_title, tester, status, note } =
      req.body || {};

    if (!item_key || typeof item_key !== "string") {
      res.status(400).json({ ok: false, error: "item_key is required" });
      return;
    }
    const safeStatus = QA_STATUSES.includes(status) ? status : "not_tested";
    if (!note && safeStatus === "not_tested") {
      res.status(400).json({ ok: false, error: "Provide a note or a status" });
      return;
    }

    const created = await qaCommentModel.create({
      item_key: String(item_key).slice(0, 255),
      section_id: section_id ? String(section_id).slice(0, 120) : null,
      section_title: section_title ? String(section_title).slice(0, 255) : null,
      case_title: case_title ? String(case_title).slice(0, 500) : null,
      tester: tester ? String(tester).slice(0, 160) : null,
      status: safeStatus,
      note: note ? String(note) : null,
    });
    res.json({ ok: true, comment: created });
  })
);

// ── Delete a single comment ────────────────────────────────────────────────
router.delete("/comment/:id", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ ok: false, error: "Invalid id" });
      return;
    }
    const n = await qaCommentModel.destroy({ where: { id } });
    res.json({ ok: true, deleted: n });
  })
);

// ── Add a QA-authored custom test item ─────────────────────────────────────
router.post("/custom", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const { area, title, description, created_by } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ ok: false, error: "title is required" });
      return;
    }
    const created: any = await qaCustomItemModel.create({
      item_key: "pending", // replaced below with a stable key
      area: area ? String(area).slice(0, 255) : "Custom Tests",
      title: String(title).slice(0, 500),
      description: description ? String(description) : null,
      created_by: created_by ? String(created_by).slice(0, 160) : null,
    });
    created.item_key = `custom::${created.id}`;
    await created.save();
    res.json({ ok: true, item: created });
  })
);

// ── Delete a custom test item (and its comments) ───────────────────────────
router.delete("/custom/:id", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ ok: false, error: "Invalid id" });
      return;
    }
    await qaCommentModel.destroy({ where: { item_key: `custom::${id}` } });
    const n = await qaCustomItemModel.destroy({ where: { id } });
    res.json({ ok: true, deleted: n });
  })
);

// ── Export all notes as JSON or CSV ────────────────────────────────────────
router.get("/export", requirePasscode, (req, res) =>
  withTables(res, async () => {
    const format = (req.query.format as string) || "json";
    const comments = (await qaCommentModel.findAll({
      order: [["item_key", "ASC"], ["created_at", "ASC"]],
      raw: true,
    })) as any[];

    if (format === "csv") {
      const headers = [
        "id",
        "item_key",
        "section_title",
        "case_title",
        "status",
        "tester",
        "note",
        "created_at",
      ];
      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const rows = comments.map((c) =>
        headers.map((h) => esc(c[h])).join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dynopay-qa-notes-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`
      );
      res.send(csv);
      return;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dynopay-qa-notes-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`
    );
    res.send(JSON.stringify({ exported_at: new Date().toISOString(), comments }, null, 2));
  })
);

export default router;
