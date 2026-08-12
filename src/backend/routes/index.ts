import { Router } from 'express';
import userRoutes from './userRoutes.js';
import regionRoutes from './regionRoutes.js';
import locationRoutes from './locationRoutes.js';
import checklistRoutes from './checklistRoutes.js';
import statsRoutes from './statsRoutes.js';
import emailRoutes from './emailRoutes.js';
import authRoutes from './authRoutes.js';
import assignmentRoutes from './assignmentRoutes.js';
import collectionRoutes from './collectionRoutes.js';
import { pool } from '../../lib/db.js';

const router = Router();

// Debug middleware
router.use((req, _res, next) => {
  console.log(`[API Debug] ${req.method} ${req.url} - Base: ${req.baseUrl}`);
  next();
});

// Rota de Saúde (Health) - Mantida no index por ser simples
router.get('/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS ts');
    res.json({ status: 'ok', db: 'conectado', timestamp: result.rows[0].ts });
  } catch (err) {
    res.status(500).json({ status: 'erro', db: 'desconectado', details: String(err) });
  }
});

// Registrar domínios
router.use('/users', userRoutes);
router.use('/regions', regionRoutes);
router.use('/locations', locationRoutes);
router.use('/checklists', checklistRoutes);
router.use('/stats', statsRoutes);
router.use('/email', emailRoutes);
router.use('/auth', authRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/collection', collectionRoutes);

export default router;
