import pg from './node_modules/pg/lib/index.js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => { 
  const i = b.indexOf('='); 
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim(); 
  return a; 
}, {});

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const res = await pool.query("SELECT * FROM collection_state WHERE LOWER(store_name) = 'saga teste'");
  console.log("Collection State:", res.rows);
  const ch = await pool.query("SELECT id, visit_date, data FROM checklists WHERE LOWER(location_name) = 'saga teste' ORDER BY visit_date DESC LIMIT 1");
  console.log("Latest Checklist:", JSON.stringify(ch.rows, null, 2));
  await pool.end();
}

check();
