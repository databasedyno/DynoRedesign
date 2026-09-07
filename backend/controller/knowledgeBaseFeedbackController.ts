import { Request, Response } from 'express';
import { apiLogger } from '../utils/loggers';
import KBArticle from '../models/knowledgeBaseModels/kbArticleModel';
import KBArticleFeedback from '../models/knowledgeBaseModels/kbArticleFeedbackModel';
import KBStaticFeedback, {
  ensureKbStaticFeedbackTable,
} from '../models/knowledgeBaseModels/kbStaticFeedbackModel';

/**
 * Submit feedback for a STATIC (non-DB) help article, keyed by slug.
 * POST /api/kb/articles/by-slug/:slug/feedback
 *
 * Static / hand-authored articles have no DB row, so the id-based feedback
 * endpoint cannot record their feedback (QA PUB-007 #5). This stores the vote in
 * the additive tbl_kb_static_feedback table. If the slug happens to also exist
 * as a published DB article, we defer to that article's counters instead.
 *
 * Kept in its own module (not knowledgeBaseController.ts) to respect the R2
 * 500-line budget — see backend/scripts/check-file-size.mjs.
 */
export const submitStaticArticleFeedback = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { is_helpful, feedback_text } = req.body;
    const userIp = req.ip || req.socket.remoteAddress;

    if (typeof is_helpful !== 'boolean') {
      return res.status(400).json({ message: 'is_helpful must be a boolean value' });
    }
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ message: 'slug is required' });
    }

    // If a published DB article owns this slug, record against it (single source of truth).
    const dbArticle = await KBArticle.findOne({ where: { slug } });
    if (dbArticle) {
      await KBArticleFeedback.create({
        article_id: (dbArticle as unknown as { article_id: number }).article_id,
        user_id: null,
        is_helpful,
        feedback_text,
        user_ip: userIp,
      } as unknown as never);
      if (is_helpful) {
        await dbArticle.increment('helpful_count');
      } else {
        await dbArticle.increment('not_helpful_count');
      }
      return res.status(200).json({ message: 'Thank you for your feedback!' });
    }

    // Otherwise store it in the static-feedback table (created on first use).
    await ensureKbStaticFeedbackTable();
    await KBStaticFeedback.create({
      slug: String(slug).slice(0, 255),
      is_helpful,
      feedback_text: feedback_text ? String(feedback_text) : null,
      user_ip: userIp ? String(userIp).slice(0, 50) : null,
    });

    return res.status(200).json({ message: 'Thank you for your feedback!' });
  } catch (error) {
    apiLogger.error('Error in submitStaticArticleFeedback:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: (error as Error).message,
    });
  }
};

export default { submitStaticArticleFeedback };
