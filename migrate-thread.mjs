import pg from './node_modules/pg/lib/index.js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  await pool.query(`
    ALTER TABLE collection_state 
    ADD COLUMN IF NOT EXISTS thread_message_id TEXT;
  `);
  console.log('✅ Coluna thread_message_id adicionada à collection_state');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
