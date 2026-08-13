import pg from './node_modules/pg/lib/index.js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => { 
  const i = b.indexOf('='); 
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim(); 
  return a; 
}, {});

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function reset() {
  await pool.query("DELETE FROM collection_state WHERE LOWER(store_name) = 'saga teste'");
  console.log("State reset for Saga Teste");
  await pool.end();
}

reset();
