import { Router } from 'express';
import * as locationController from '../controllers/locationController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, locationController.getAllLocations);
router.post('/', requireAuth, requireAdmin, locationController.addLocation);
router.patch('/:name/link', requireAuth, requireAdmin, locationController.linkStoreContact);
router.delete('/:name', requireAuth, requireAdmin, locationController.removeLocation);

export default router;
