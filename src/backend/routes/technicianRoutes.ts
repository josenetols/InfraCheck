import { Router } from 'express';
import * as technicianController from '../controllers/technicianController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, technicianController.getAllTechnicians);
router.post('/', requireAuth, requireAdmin, technicianController.createOrUpdateTechnician);
router.delete('/:id', requireAuth, requireAdmin, technicianController.removeTechnician);

export default router;
