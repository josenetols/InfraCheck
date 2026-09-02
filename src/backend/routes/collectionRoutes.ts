import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import * as col from '../controllers/collectionController.js';

const router = Router();

// Upload e listagem de lojas (CSV)
router.post('/upload-csv', requireAuth, col.upload.single('file'), col.uploadCSV);
router.get('/stores', requireAuth, col.listStores);

// Estados de cobrança
router.get('/states', requireAuth, col.getStates);
router.get('/preview/:storeName', requireAuth, col.getPreview);
router.post('/fire/:storeName', requireAuth, col.fire);
router.post('/reset/:storeName', requireAuth, col.reset);
router.post('/resolve/:storeName', requireAuth, col.resolve);

// Supervisores de TI — gestão restrita a administradores
router.get('/supervisors', requireAuth, col.getSupervisors);
router.post('/supervisors', requireAuth, requireAdmin, col.createSupervisor);
router.delete('/supervisors/:id', requireAuth, requireAdmin, col.deleteSupervisor);

export default router;
