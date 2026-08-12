import pg from 'pg';
import fs from 'fs';

const ENV_PATH = '/home/ubuntu/InfraCheck/.env.local';
const env = fs.readFileSync(ENV_PATH, 'utf8').split('\n').reduce((a,c)=>{
  const i = c.indexOf('=');
  if(i>0) a[c.slice(0,i).trim()] = c.slice(i+1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

async function run() {
  const storeName = 'SAGA TESTE';
  
  // Achar se existe uma loja com 'TESTE' na planilha (store_contacts)
  const scRes = await pool.query('SELECT store_name FROM store_contacts WHERE store_name ILIKE $1 LIMIT 1', ['%TESTE%']);
  
  if (scRes.rows.length > 0) {
      const realContact = scRes.rows[0].store_name;
      console.log('Restaurando o vinculo da SAGA TESTE para o contato da planilha:', realContact);
      await pool.query('UPDATE locations SET store_contact_name = $1 WHERE name = $2', [realContact, storeName]);
  } else {
      console.log('Não foi encontrado nenhum "TESTE" na planilha. Desfazendo o vinculo falso...');
      await pool.query('UPDATE locations SET store_contact_name = NULL WHERE name = $1', [storeName]);
  }
  
  pool.end();
}
run();
