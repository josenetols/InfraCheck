import fs from 'fs';
import pg from 'pg';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'] });

async function run() {
  const r1 = await pool.query("SELECT id, name FROM locations WHERE name LIKE '%Teste%'");
  console.log('Loja Teste count:', r1.rows.length);
  console.table(r1.rows);
  const locIds = r1.rows.map(r => r.id);
  if (locIds.length > 0) {
    await pool.query('DELETE FROM checklists WHERE location_id = ANY($1)', [locIds]);
    await pool.query('DELETE FROM assignments WHERE location_id = ANY($1)', [locIds]);
    await pool.query('DELETE FROM locations WHERE id = ANY($1)', [locIds]);
    console.log('Deleted');
  }
  process.exit(0);
}

run();
