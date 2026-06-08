/**
 * Model de autenticação — acesso a dados de login dos técnicos.
 * Responsabilidades: busca por username, verificação e definição de senha.
 */
import { pool } from '../../lib/db.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// ─── Tipos ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  region_name: string | null;
  role: 'admin' | 'technician';
  password_hash: string | null;
  must_change_password: boolean;
}

// ─── Queries ──────────────────────────────────────────────────────────

/** Busca um técnico ativo pelo username (para login) */
export const findByUsername = async (username: string): Promise<AuthUser | null> => {
  const result = await pool.query(
    `SELECT id, name, username, region_name, role, password_hash, must_change_password
     FROM technicians WHERE username = $1 AND active = true`,
    [username]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

/** Verifica se a senha informada corresponde ao hash armazenado */
export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

/** Define (ou redefine) a senha de um técnico — usado via middleware autenticado (change-password) */
export const setPassword = async (technicianId: string, newPassword: string): Promise<void> => {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(
    `UPDATE technicians SET password_hash = $1, must_change_password = false, updated_at = NOW()
     WHERE id = $2`,
    [hash, technicianId]
  );
};

/**
 * Define a senha de um usuário pelo ID — usado no fluxo de primeiro acesso.
 * Não requer JWT: o usuário ainda não tem token ao definir a senha pela primeira vez.
 * Retorna false se o usuário não existir ou já tiver senha definida.
 */
export const setPasswordById = async (
  userId: string,
  newPassword: string
): Promise<boolean> => {
  // Garante que o usuário existe e ainda não tem senha (segurança extra)
  const check = await pool.query(
    `SELECT id FROM technicians WHERE id = $1 AND active = true AND password_hash IS NULL`,
    [userId]
  );
  if (check.rows.length === 0) return false;

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(
    `UPDATE technicians
     SET password_hash = $1, must_change_password = false, updated_at = NOW()
     WHERE id = $2`,
    [hash, userId]
  );
  return true;
};
