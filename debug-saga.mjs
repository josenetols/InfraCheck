import pg from 'pg';
import fs from 'fs';
import { extractPendingItems } from './autoCollectionJob.mjs';

const ENV_PATH = '/home/ubuntu/InfraCheck/.env.local';
const env = fs.readFileSync(ENV_PATH, 'utf8').split('\n').reduce((a,c)=>{
  const i = c.indexOf('=');
  if(i>0) a[c.slice(0,i).trim()] = c.slice(i+1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

async function run() {
    const checklistsResult = await pool.query(`
    SELECT DISTINCT ON (c.location_name)
      c.id AS checklist_id,
      c.location_name,
      c.visit_date,
      c.data,
      TO_CHAR(c.visit_date, 'YYYY-MM') AS month,
      cs.current_level,
      cs.last_sent_at,
      cs.resolved_at
    FROM checklists c
    LEFT JOIN collection_state cs
      ON LOWER(cs.store_name) = LOWER(c.location_name)
      AND cs.month = TO_CHAR(c.visit_date, 'YYYY-MM')
    WHERE
      c.visit_date >= NOW() - INTERVAL '6 months'
      AND (cs.resolved_at IS NULL OR cs.id IS NULL)
    ORDER BY c.location_name, c.visit_date DESC
  `);
  
  console.log('Retornados', checklistsResult.rows.length, 'checklists.');
  const saga = checklistsResult.rows.find(r => r.location_name === 'SAGA TESTE');
  
  if (saga) {
    console.log('SAGA TESTE Visit Date:', saga.visit_date);
    
    const now = new Date();
    const visitDate = new Date(saga.visit_date);
    const daysSince = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('Days since:', daysSince);
    console.log('Current level:', saga.current_level);
    
    const pendings = extractPendingItems(saga.data);
    console.log('Pendings length:', pendings.length);
  } else {
    console.log('SAGA TESTE NAO ENCONTRADA!');
  }
  
  pool.end();
}
run();
