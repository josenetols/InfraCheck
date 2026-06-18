import { Router } from 'express';
import * as emailController from '../controllers/emailController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/send-report', requireAuth, emailController.sendReportEmail);

export default router;
