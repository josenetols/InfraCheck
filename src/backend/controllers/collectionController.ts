/**
 * collectionController.ts
 * Endpoints REST para a Régua de Cobrança.
 */

import { Request, Response } from 'express';
import multer from 'multer';
import {
  syncStoreContacts,
  listStoreContacts,
} from '../services/csvSyncService.js';
import {
  previewCollection,
  fireCollection,
  resetCollectionState,
  listCollectionStates,
  listSupervisors,
  addSupervisor,
  removeSupervisor,
  getCurrentMonth,
  resolveCollection,
} from '../services/collectionService.js';
import { pool } from '../../lib/db.js';

// Multer em memória (sem salvar em disco)
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Contatos de Lojas ────────────────────────────────────────────────────────

/** POST /api/collection/upload-csv — faz upload e sincroniza o CSV */
export const uploadCSV = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo CSV não enviado.' });
    }
    const result = await syncStoreContacts(req.file.buffer);
    res.json({ message: `Sincronização concluída. ${result.synced} lojas processadas.`, ...result });
  } catch (err) {
    console.error('[Collection] Erro no upload CSV:', err);
    res.status(500).json({ error: 'Falha ao processar o CSV.', details: String(err) });
  }
};

/** GET /api/collection/stores — lista lojas sincronizadas */
export const listStores = async (_req: Request, res: Response) => {
  try {
    const stores = await listStoreContacts();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar lojas.', details: String(err) });
  }
};

// ─── Estados de Cobrança ──────────────────────────────────────────────────────

/** GET /api/collection/states?month=2026-07 — lista estados do mês */
export const getStates = async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || getCurrentMonth();
    const states = await listCollectionStates(month);
    res.json(states);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar estados.', details: String(err) });
  }
};

/** GET /api/collection/preview/:storeName — preview antes do disparo */
export const getPreview = async (req: Request, res: Response) => {
  try {
    const storeName = decodeURIComponent(req.params.storeName as string);
    const month = (req.query.month as string) || getCurrentMonth();
    const preview = await previewCollection(storeName, month);
    res.json(preview);
  } catch (err) {
    console.error('[Collection] Erro no preview:', err);
    res.status(500).json({ error: 'Erro ao gerar preview.', details: String(err) });
  }
};

/** POST /api/collection/fire/:storeName — dispara o próximo nível */
export const fire = async (req: Request, res: Response) => {
  try {
    const storeName = decodeURIComponent(req.params.storeName as string);
    const month = (req.body.month as string) || getCurrentMonth();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    // Busca credenciais SMTP do técnico logado
    const userResult = await pool.query(
      'SELECT name, email, smtp_password FROM technicians WHERE id = $1 AND active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const { name: techName, email: smtpUser, smtp_password: smtpPass } = userResult.rows[0];

    if (!smtpUser || !smtpPass) {
      return res.status(403).json({
        error: 'Seu e-mail corporativo ou senha de aplicativo não está configurado. Solicite ao administrador.'
      });
    }

    const result = await fireCollection({
      storeName,
      month,
      technicianName: techName,
      smtpUser,
      smtpPass,
    });

    res.json({ message: `Cobrança Nível ${result.level} disparada com sucesso!`, ...result });
  } catch (err) {
    console.error('[Collection] Erro no disparo:', err);
    res.status(500).json({ error: String(err) });
  }
};

/** POST /api/collection/reset/:storeName — reseta estado (admin only) */
export const reset = async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem resetar o estado.' });
    }
    const storeName = decodeURIComponent(req.params.storeName as string);
    const month = (req.body.month as string) || getCurrentMonth();
    await resetCollectionState(storeName, month);
    res.json({ message: 'Estado resetado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};

/** POST /api/collection/resolve/:storeName — marca cobrança como resolvida */
export const resolve = async (req: Request, res: Response) => {
  try {
    const storeName = decodeURIComponent(req.params.storeName as string);
    const month = (req.body.month as string) || getCurrentMonth();
    const resolvedBy = req.user?.name || 'Administrador';
    await resolveCollection(storeName, month, resolvedBy);
    res.json({ message: `Cobrança de "${storeName}" marcada como resolvida.` });
  } catch (err) {
    console.error('[Collection] Erro ao resolver:', err);
    res.status(500).json({ error: String(err) });
  }
};

// ─── Supervisores TI ──────────────────────────────────────────────────────────

/** GET /api/collection/supervisors */
export const getSupervisors = async (_req: Request, res: Response) => {
  try {
    const sups = await listSupervisors();
    res.json(sups);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar supervisores.', details: String(err) });
  }
};

/** POST /api/collection/supervisors */
export const createSupervisor = async (req: Request, res: Response) => {
  try {
    const { name, email, ti_role } = req.body;
    if (!name || !email || !ti_role) {
      return res.status(400).json({ error: 'name, email e ti_role são obrigatórios.' });
    }
    if (!['coordinator', 'manager', 'director'].includes(ti_role)) {
      return res.status(400).json({ error: 'ti_role deve ser coordinator, manager ou director.' });
    }
    const sup = await addSupervisor({ name, email, ti_role });
    res.status(201).json(sup);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar supervisor.', details: String(err) });
  }
};

/** DELETE /api/collection/supervisors/:id */
export const deleteSupervisor = async (req: Request, res: Response) => {
  try {
    await removeSupervisor(req.params.id as string);
    res.json({ message: 'Supervisor removido.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover supervisor.', details: String(err) });
  }
};
