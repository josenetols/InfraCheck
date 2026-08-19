import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from './src/lib/db.js';

async function run() {
  console.log("Deletando checklists associados a tecnicos de teste...");
  await pool.query(`
    DELETE FROM checklists 
    WHERE technician_name IN ('Test Tech A', 'Test Tech B', 'Test Tech C', 'Test Tech D')
  `);

  console.log("Deletando cycle_goals associados a tecnicos de teste...");
  await pool.query(`
    DELETE FROM cycle_goals 
    WHERE technician_id IN (
      SELECT id FROM technicians WHERE name IN ('Test Tech A', 'Test Tech B', 'Test Tech C', 'Test Tech D')
    )
  `);

  console.log("Deletando monthly_goals associados a tecnicos de teste...");
  await pool.query(`
    DELETE FROM monthly_goals 
    WHERE technician_id IN (
      SELECT id FROM technicians WHERE name IN ('Test Tech A', 'Test Tech B', 'Test Tech C', 'Test Tech D')
    )
  `);

  console.log("Deletando assignments associados a tecnicos de teste...");
  await pool.query(`
    DELETE FROM assignments 
    WHERE technician_id IN (
      SELECT id FROM technicians WHERE name IN ('Test Tech A', 'Test Tech B', 'Test Tech C', 'Test Tech D')
    )
  `);

  console.log("Deletando tecnicos de teste...");
  await pool.query(`
    DELETE FROM technicians 
    WHERE name IN ('Test Tech A', 'Test Tech B', 'Test Tech C', 'Test Tech D')
  `);

  console.log("Lojas apagadas.");
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
