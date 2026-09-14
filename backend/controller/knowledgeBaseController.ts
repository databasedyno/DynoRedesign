import { Request, Response } from 'express';
import { apiLogger } from "../utils/loggers";
import KBCategory from '../models/knowledgeBaseModels/kbCategoryModel';
import KBArticle from '../models/knowledgeBaseModels/kbArticleModel';
import KBArticleFeedback from '../models/knowledgeBaseModels/kbArticleFeedbackModel';
import User from '../models/userModels/userModel';
import { Op } from 'sequelize';

// Set up associations if not already done
if (!(KBArticle as unknown as { associations?: Record<string, unknown> }).associations?.category) {
  KBArticle.belongsTo(KBCategory, { foreignKey: 'category_id', as: 'category' });
  KBArticle.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
  KBCategory.hasMany(KBArticle, { foreignKey: 'category_id', as: 'articles' });
  KBArticleFeedback.belongsTo(KBArticle, { foreignKey: 'article_id', as: 'article' });
  KBArticle.hasMany(KBArticleFeedback, { foreignKey: 'article_id', as: 'feedbacks' });
}

/**
 * Get all KB categories
 * GET /api/kb/categories
 */
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await KBCategory.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']],
      attributes: [
        'category_id',
        'category_name',
        'category_slug',
        'category_icon',
        'description',
        'article_count',
      ],
    });

    return res.status(200).json({
      message: "Categories retrieved successfully",
      data: { categories },
    });
  } catch (error) {
    apiLogger.error("Error in getCategories:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get articles by category
 * GET /api/kb/articles?category_id=1
 */
export const getArticles = async (req: Request, res: Response) => {
  try {
    const { category_id, page = 1, limit = 10, published_only = 'true' } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: Record<string, unknown> = {};

    if (category_id) {
      whereClause.category_id = Number(category_id);
    }

    if (published_only === 'true') {
      whereClause.is_published = true;
    }

    const { count, rows } = await KBArticle.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['category_name', 'category_slug', 'category_icon'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['name', 'email'],
        },
      ],
      order: [['published_at', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return res.status(200).json({
      message: "Articles retrieved successfully",
      data: {
        articles: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in getArticles:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get single article by slug
 * GET /api/kb/articles/:slug
 */
export const getArticleBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const article = await KBArticle.findOne({
      where: { slug, is_published: true },
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['category_name', 'category_slug', 'category_icon'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (!article) {
      return res.status(404).json({
        message: "Article not found",
      });
    }

    // Increment view count
    await article.increment('views_count');

    return res.status(200).json({
      message: "Article retrieved successfully",
      data: { article },
    });
  } catch (error) {
    apiLogger.error("Error in getArticleBySlug:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Search articles
 * GET /api/kb/search?q=payment
 */
export const searchArticles = async (req: Request, res: Response) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || (q as string).trim().length < 2) {
      return res.status(400).json({
        message: "Search query must be at least 2 characters",
      });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const searchTerm = `%${(q as string).trim()}%`;

    const { count, rows } = await KBArticle.findAndCountAll({
      where: {
        is_published: true,
        [Op.or]: [
          { title: { [Op.iLike]: searchTerm } },
          { content: { [Op.iLike]: searchTerm } },
          { excerpt: { [Op.iLike]: searchTerm } },
          { meta_keywords: { [Op.iLike]: searchTerm } },
        ],
      },
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['category_name', 'category_slug'],
        },
      ],
      order: [
        ['views_count', 'DESC'],
        ['published_at', 'DESC'],
      ],
      limit: Number(limit),
      offset,
    });

    return res.status(200).json({
      message: "Search results retrieved successfully",
      data: {
        query: q,
        articles: rows,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error) {
    apiLogger.error("Error in searchArticles:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get popular articles
 * GET /api/kb/popular
 */
export const getPopularArticles = async (req: Request, res: Response) => {
  try {
    const { limit = 5 } = req.query;

    const articles = await KBArticle.findAll({
      where: { is_published: true },
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['category_name', 'category_slug', 'category_icon'],
        },
      ],
      order: [['views_count', 'DESC']],
      limit: Number(limit),
      attributes: ['article_id', 'title', 'slug', 'excerpt', 'views_count', 'reading_time_minutes'],
    });

    return res.status(200).json({
      message: "Popular articles retrieved successfully",
      data: { articles },
    });
  } catch (error) {
    apiLogger.error("Error in getPopularArticles:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Submit article feedback
 * POST /api/kb/articles/:id/feedback
 */
export const submitArticleFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_helpful, feedback_text } = req.body;
    const userId = (req as { user?: { user_id: number } }).user?.user_id;
    const userIp = req.ip || req.socket.remoteAddress;

    if (typeof is_helpful !== 'boolean') {
      return res.status(400).json({
        message: "is_helpful must be a boolean value",
      });
    }

    const article = await KBArticle.findByPk(id);
    if (!article) {
      return res.status(404).json({
        message: "Article not found",
      });
    }

    // Create feedback
    await KBArticleFeedback.create({
      article_id: Number(id),
      user_id: userId || null,
      is_helpful,
      feedback_text,
      user_ip: userIp,
    } as unknown);

    // Update article counts
    if (is_helpful) {
      await article.increment('helpful_count');
    } else {
      await article.increment('not_helpful_count');
    }

    return res.status(200).json({
      message: "Thank you for your feedback!",
      data: {
        helpful_count: article.helpful_count + (is_helpful ? 1 : 0),
        not_helpful_count: article.not_helpful_count + (!is_helpful ? 1 : 0),
      },
    });
  } catch (error) {
    apiLogger.error("Error in submitArticleFeedback:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Create new article (Admin only)
 * POST /api/admin/kb/articles
 */
export const createArticle = async (req: Request, res: Response) => {
  try {
    const {
      category_id,
      title,
      slug,
      excerpt,
      content,
      content_html,
      featured_image_url,
      meta_title,
      meta_description,
      meta_keywords,
      is_published,
    } = req.body;

    const authorId = (req as { user?: { user_id: number } }).user?.user_id;

    if (!title || !slug || !content) {
      return res.status(400).json({
        message: "Title, slug, and content are required",
      });
    }

    // Calculate reading time (approximate: 200 words per minute)
    const wordCount = content.split(/\s+/).length;
    const reading_time_minutes = Math.ceil(wordCount / 200);

    const article = await KBArticle.create({
      category_id,
      title,
      slug,
      excerpt,
      content,
      content_html: content_html || content,
      author_id: authorId,
      featured_image_url,
      meta_title: meta_title || title,
      meta_description: meta_description || excerpt,
      meta_keywords,
      is_published: is_published || false,
      published_at: is_published ? new Date() : null,
      reading_time_minutes,
    } as unknown);

    return res.status(201).json({
      message: "Article created successfully",
      data: { article },
    });
  } catch (error) {
    apiLogger.error("Error in createArticle:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        message: "Article slug already exists",
      });
    }
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Update article (Admin only)
 * PUT /api/admin/kb/articles/:id
 */
export const updateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const article = await KBArticle.findByPk(id);
    if (!article) {
      return res.status(404).json({
        message: "Article not found",
      });
    }

    // If publishing for first time, set published_at
    if (updateData.is_published && !article.is_published) {
      updateData.published_at = new Date();
    }

    // Recalculate reading time if content changed
    if (updateData.content) {
      const wordCount = updateData.content.split(/\s+/).length;
      updateData.reading_time_minutes = Math.ceil(wordCount / 200);
    }

    await article.update(updateData);

    return res.status(200).json({
      message: "Article updated successfully",
      data: { article },
    });
  } catch (error) {
    apiLogger.error("Error in updateArticle:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Delete article (Admin only)
 * DELETE /api/admin/kb/articles/:id
 */
export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const article = await KBArticle.findByPk(id);
    if (!article) {
      return res.status(404).json({
        message: "Article not found",
      });
    }

    await article.destroy();

    return res.status(200).json({
      message: "Article deleted successfully",
    });
  } catch (error) {
    apiLogger.error("Error in deleteArticle:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  getCategories,
  getArticles,
  getArticleBySlug,
  searchArticles,
  getPopularArticles,
  submitArticleFeedback,
  createArticle,
  updateArticle,
  deleteArticle,
};
