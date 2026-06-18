/**
 * Model de Usuários (Técnicos/Admins) — CRUD com suporte a username, role e senha.
 */
import { pool } from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 12;

// ─── Tipos ────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  username: string;
  active: boolean;
  region_name: string | null;
  role: 'admin' | 'technician';
  email: string | null;
  smtp_password: string | null;
}

export interface CreateUserData {
  id?: string;
  name: string;
  username: string;
  region_name?: string;
  role: 'admin' | 'technician';
  password?: string;
  email?: string;
  smtp_password?: string;
}

export interface UpdateUserData {
  name: string;
  username: string;
  region_name?: string;
  role: 'admin' | 'technician';
  email?: string;
  smtp_password?: string;
}

// ─── Queries ──────────────────────────────────────────────────────────

export const getUsers = async (): Promise<UserRow[]> => {
  const result = await pool.query(
    'SELECT id, name, username, active, region_name, role, email, smtp_password FROM technicians WHERE active = true ORDER BY name'
  );
  return result.rows;
};

export const getUserByUsername = async (username: string): Promise<UserRow | null> => {
  const result = await pool.query(
    'SELECT id, name, username, active, region_name, role, email, smtp_password FROM technicians WHERE username = $1 AND active = true',
    [username]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const createUser = async (data: CreateUserData): Promise<string> => {
  const id = data.id || randomUUID();
  let hash = null;
  
  if (data.password) {
    hash = await bcrypt.hash(data.password, SALT_ROUNDS);
  }

  await pool.query(
    `INSERT INTO technicians (id, name, username, active, region_name, role, password_hash, must_change_password, email, smtp_password)
     VALUES ($1, $2, $3, true, $4, $5, $6, true, $7, $8)`,
    [id, data.name, data.username, data.region_name || null, data.role, hash, data.email || null, data.smtp_password || null]
  );

  return id;
};

export const updateUser = async (id: string, data: UpdateUserData): Promise<void> => {
  await pool.query(
    `UPDATE technicians SET 
       name = $1, 
       username = $2, 
       region_name = $3, 
       role = $4, 
       email = $5,
       smtp_password = $6,
       updated_at = NOW() 
     WHERE id = $7`,
    [data.name, data.username, data.region_name || null, data.role, data.email || null, data.smtp_password || null, id]
  );
};

export const updatePassword = async (id: string, password: string): Promise<void> => {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    `UPDATE technicians SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [hash, id]
  );
};

export const deleteUser = async (id: string): Promise<void> => {
  await pool.query(
    `UPDATE technicians 
     SET active = false, 
         username = username || '-deleted-' || extract(epoch from now())::int, 
         updated_at = NOW() 
     WHERE id = $1`, 
    [id]
  );
};
