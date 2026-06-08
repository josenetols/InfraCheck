import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, userController.getUsers);
router.post('/', requireAuth, requireAdmin, userController.createUser);
router.put('/:id', requireAuth, requireAdmin, userController.updateUser);
router.put('/:id/password', requireAuth, requireAdmin, userController.updatePassword);
router.delete('/:id', requireAuth, requireAdmin, userController.deleteUser);

export default router;
