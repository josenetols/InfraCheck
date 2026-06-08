import { Router } from 'express';
import * as emailController from '../controllers/emailController.js';

const router = Router();

router.post('/send-report', emailController.sendReportEmail);

export default router;
