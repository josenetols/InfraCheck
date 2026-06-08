/**
 * Controller de autenticação — login, definição de senha e troca de senha.
 */
import { Request, Response } from 'express';
import * as authModel from '../models/authModel.js';
import { pool } from '../../lib/db.js';
import { generateToken } from '../middleware/authMiddleware.js';

/**
 * POST /api/auth/login
 *
 * Fluxo:
 * 1. Busca usuário pelo username
 * 2. Se password_hash é NULL → primeiro acesso, retorna { firstLogin: true, userId }
 *    (sem JWT — o usuário precisa definir a senha antes de receber um token)
 * 3. Se password_hash existe → verifica senha e retorna JWT
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username é obrigatório.' });
      return;
    }

    const user = await authModel.findByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Usuário Incorreto/Inativo.' });
      return;
    }

    // ── Primeiro acesso: sem senha definida ──────────────────────────────────
    // Não emite JWT. O frontend redireciona para a tela de definição de senha.
    if (!user.password_hash) {
      res.json({
        firstLogin: true,
        userId: user.id,
        name: user.name,
      });
      return;
    }

    // ── Login normal: exige senha ────────────────────────────────────────────
    if (!password) {
      res.status(400).json({ error: 'Senha é obrigatória.' });
      return;
    }

    const valid = await authModel.verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      region_name: user.region_name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        region_name: user.region_name || '',
        role: user.role,
      },
      mustChangePassword: user.must_change_password,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};

/**
 * POST /api/auth/set-password
 *
 * Rota PÚBLICA — usada no fluxo de primeiro acesso (sem JWT).
 * Recebe { userId, password }, define a senha e retorna JWT para autenticação imediata.
 *
 * Segurança: só funciona se o usuário ainda não tem senha (password_hash IS NULL).
 */
export const setPasswordFirstLogin = async (req: Request, res: Response) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      res.status(400).json({ error: 'userId e password são obrigatórios.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    // Define a senha. Retorna false se o usuário não existir ou já tiver senha.
    const ok = await authModel.setPasswordById(userId, password);
    if (!ok) {
      res.status(400).json({
        error: 'Usuário inválido ou senha já definida. Utilize o fluxo de login normal.',
      });
      return;
    }

    // Busca dados completos para montar o token
    const result = await pool.query(
      `SELECT id, name, username, region_name, role
       FROM technicians WHERE id = $1 AND active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(500).json({ error: 'Erro ao carregar usuário após definir senha.' });
      return;
    }

    const user = result.rows[0];

    const token = generateToken({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      region_name: user.region_name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        region_name: user.region_name || '',
        role: user.role,
      },
      message: 'Senha definida com sucesso! Bem-vindo ao sistema.',
    });
  } catch (err) {
    console.error('Erro ao definir senha (primeiro acesso):', err);
    res.status(500).json({ error: 'Erro ao definir a senha.' });
  }
};

/**
 * POST /api/auth/change-password — requer autenticação (requireAuth)
 * Permite ao usuário autenticado alterar a própria senha.
 * O admin também pode redefinir senha de qualquer usuário via PUT /api/users/:id/password.
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    await authModel.setPassword(req.user!.id, newPassword);

    const token = generateToken({
      id: req.user!.id,
      name: req.user!.name,
      username: req.user!.username,
      region_name: req.user!.region_name,
      role: req.user!.role,
    });

    res.json({ token, message: 'Senha definida com sucesso.' });
  } catch (err) {
    console.error('Erro ao alterar senha:', err);
    res.status(500).json({ error: 'Erro ao definir nova senha.' });
  }
};
