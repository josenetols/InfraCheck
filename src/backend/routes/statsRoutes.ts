import { Router } from 'express';
import * as statsController from '../controllers/statsController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, statsController.getStats);
router.get('/status-distribution', requireAuth, statsController.getStatusDistribution);
router.get('/admin-summary', requireAuth, requireAdmin, statsController.getAdminSummary);

export default router;
