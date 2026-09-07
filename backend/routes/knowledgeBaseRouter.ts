import express from 'express';
import knowledgeBaseController from '../controller/knowledgeBaseController';
import knowledgeBaseFeedbackController from '../controller/knowledgeBaseFeedbackController';
import { authMiddleware } from '../middleware';

const kbRouter = express.Router();

// Public routes
kbRouter.get('/categories', knowledgeBaseController.getCategories);
kbRouter.get('/articles', knowledgeBaseController.getArticles);
kbRouter.get('/articles/:slug', knowledgeBaseController.getArticleBySlug);
kbRouter.get('/search', knowledgeBaseController.searchArticles);
kbRouter.get('/popular', knowledgeBaseController.getPopularArticles);

// Protected routes
kbRouter.post('/articles/:id/feedback', knowledgeBaseController.submitArticleFeedback);
// Feedback for static (non-DB) articles, keyed by slug (QA PUB-007 #5)
kbRouter.post('/articles/by-slug/:slug/feedback', knowledgeBaseFeedbackController.submitStaticArticleFeedback);

// Admin routes (require authentication and admin check)
kbRouter.post('/admin/articles', authMiddleware, knowledgeBaseController.createArticle);
kbRouter.put('/admin/articles/:id', authMiddleware, knowledgeBaseController.updateArticle);
kbRouter.delete('/admin/articles/:id', authMiddleware, knowledgeBaseController.deleteArticle);

export default kbRouter;
