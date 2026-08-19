import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import * as goalController from '../controllers/goalController.js';

const router = Router();

router.get('/current', requireAuth, goalController.getCurrentCycleGoal);
router.get('/current/:technicianId', requireAuth, goalController.getCurrentCycleGoal);
router.get('/history', requireAuth, goalController.getHistory);
router.post('/close-cycle', requireAdmin, goalController.closeCycle);
router.post('/recalculate', requireAdmin, goalController.recalculate);

export default router;
