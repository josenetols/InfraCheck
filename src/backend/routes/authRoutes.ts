import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Limita tentativas de login/definição de senha por IP para dificultar brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// Rota pública — qualquer cliente pode tentar login
router.post('/login', authLimiter, authController.login);

// Rota pública — primeiro acesso, sem JWT (usuário ainda não tem token)
router.post('/set-password', authLimiter, authController.setPasswordFirstLogin);

// Rota autenticada — usuário troca a própria senha após login normal
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
