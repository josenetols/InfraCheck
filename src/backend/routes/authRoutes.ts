import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Rota pública — qualquer cliente pode tentar login
router.post('/login', authController.login);

// Rota pública — primeiro acesso, sem JWT (usuário ainda não tem token)
router.post('/set-password', authController.setPasswordFirstLogin);

// Rota autenticada — usuário troca a própria senha após login normal
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
