import { Router } from 'express';
import * as checklistController from '../controllers/checklistController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/history/:locationName',          requireAuth, checklistController.getChecklistHistory);
router.get('/location-history/:locationName', requireAuth, checklistController.getLocationHistoryController);
router.get('/',    requireAuth, checklistController.getAllChecklists);
router.get('/:id', requireAuth, checklistController.getChecklistById);
router.post('/',   requireAuth, checklistController.createOrUpdateChecklist);
router.delete('/:id', requireAuth, requireAdmin, checklistController.removeChecklist);

export default router;
