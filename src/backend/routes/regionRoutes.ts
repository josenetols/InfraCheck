import { Router } from 'express';
import * as regionController from '../controllers/regionController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, regionController.getAllRegions);
router.post('/', requireAuth, requireAdmin, regionController.addRegion);
router.delete('/:name', requireAuth, requireAdmin, regionController.removeRegion);

export default router;
