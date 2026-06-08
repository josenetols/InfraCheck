import { pool } from '../../lib/db.js';

export const getRegions = async () => {
  const result = await pool.query('SELECT name FROM regions ORDER BY name');
  return result.rows.map(r => r.name);
};

export const createRegion = async (name: string) => {
  await pool.query('INSERT INTO regions (name) VALUES ($1) ON CONFLICT DO NOTHING', [name.toUpperCase()]);
};

export const deleteRegion = async (name: string) => {
  await pool.query('DELETE FROM regions WHERE name = $1', [name]);
};
