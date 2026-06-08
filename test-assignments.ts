import { pool } from './src/lib/db.js';
async function test() {
  const result = await pool.query('SELECT * FROM assignments LIMIT 10');
  console.log('Assignments:', result.rows);
  const result2 = await pool.query('SELECT id, name, username, active FROM technicians WHERE username = $1', ['rone']);
  console.log('Technician:', result2.rows);
  process.exit(0);
}
test();
