import { Router } from 'express';
import * as assignmentController from '../controllers/assignmentController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, assignmentController.getAssignments);
router.post('/regenerate', requireAuth, requireAdmin, assignmentController.regenerateAssignments);

export default router;
