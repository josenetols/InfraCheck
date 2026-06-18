/**
 * Model de técnicos — CRUD com suporte a role e senha.
 */
import { pool } from '../../lib/db.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 12;

// ─── Tipos ────────────────────────────────────────────────────────────

export interface TechnicianRow {
  id: string;
  name: string;
  email: string | null;
  active: boolean;
  region_name: string | null;
  role: 'admin' | 'technician';
}

export interface CreateTechnicianData {
  id?: string;
  name: string;
  email?: string;
  region_name?: string;
  role?: 'admin' | 'technician';
  password?: string;
}

// ─── Queries ──────────────────────────────────────────────────────────

export const getTechnicians = async (): Promise<TechnicianRow[]> => {
  const result = await pool.query(
    'SELECT id, name, email, active, region_name, role FROM technicians WHERE active = true ORDER BY name'
  );
  return result.rows;
};

export const upsertTechnician = async (data: CreateTechnicianData): Promise<string> => {
  const techId = data.id || randomUUID();
  const role = data.role || 'technician';

  if (data.password) {
    const hash = await bcrypt.hash(data.password, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO technicians (id, name, email, active, region_name, role, password_hash, must_change_password)
       VALUES ($1, $2, $3, true, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         region_name = EXCLUDED.region_name,
         role = EXCLUDED.role`,
      [techId, data.name, data.email || null, data.region_name || null, role, hash]
    );
  } else {
    await pool.query(
      `INSERT INTO technicians (id, name, email, active, region_name, role, must_change_password)
       VALUES ($1, $2, $3, true, $4, $5, true)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         region_name = EXCLUDED.region_name,
         role = EXCLUDED.role`,
      [techId, data.name, data.email || null, data.region_name || null, role]
    );
  }

  return techId;
};

export const deleteTechnician = async (id: string): Promise<void> => {
  await pool.query('UPDATE technicians SET active = false, updated_at = NOW() WHERE id = $1', [id]);
};
