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
  
  console.log('Verificando loja:', storeName);
  const locRes = await pool.query('SELECT * FROM locations WHERE name = $1', [storeName]);
  if (locRes.rows.length > 0) {
      console.log('Loja SAGA TESTE encontrada no banco. Vinculo atual: ', locRes.rows[0].store_contact_name);
  } else {
      console.log('A loja SAGA TESTE não existe no banco! Criando...');
      await pool.query('INSERT INTO locations (name, region_name) VALUES ($1, $2)', [storeName, 'DF']);
  }

  // Deletar checklists recentes para que o nosso fake seja o último
  await pool.query('DELETE FROM checklists WHERE location_name = $1', [storeName]);

  // Create a fake checklist from 35 days ago
  const fakeDate = new Date();
  fakeDate.setDate(fakeDate.getDate() - 35);
  const month = fakeDate.toISOString().slice(0, 7);
  
  const fakeData = {
    cableCondition: 'Desorganizado',
    cableNotes: 'Teste Automático de Cobrança (Favor Ignorar)'
  };

  console.log('Inserindo checklist fake para ' + storeName + ' com data de ' + fakeDate.toISOString());
  
  await pool.query(
    'INSERT INTO checklists (id, location_name, visit_date, technician_name, data) VALUES ($1, $2, $3, $4, $5)',
    ['00000000-0000-0000-0000-000000000000', storeName, fakeDate, 'Admin', fakeData]
  );
  
  console.log('Executando autoCollectionJob.mjs...');
  
  // import the job dynamically to run it
  await import('./autoCollectionJob.mjs');
  
  // Wait a few seconds for async email tasks in the job to complete
  setTimeout(async () => {
    console.log('Limpando dados de teste...');
    await pool.query('DELETE FROM checklists WHERE id = $1', ['00000000-0000-0000-0000-000000000000']);
    await pool.query('DELETE FROM collection_state WHERE store_name = $1 AND month = $2', [storeName, month]);
    console.log('Concluído. Pode verificar a caixa de entrada!');
    process.exit(0);
  }, 15000);
}
run();
