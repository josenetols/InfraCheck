/**
 * test-all-levels.mjs
 * Simula os 4 níveis da Régua de Cobrança para SAGA TESTE em sequência.
 * Manipula o banco localmente e dispara o job remotamente via SSH.
 */

import { execSync } from 'child_process';
import pg from './node_modules/pg/lib/index.js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const SSH_KEY  = 'C:\\Users\\jose.osilva\\Documents\\infracheck-br\\infracheck-key.pem';
const SSH_HOST = 'ubuntu@18.119.23.16';
const JOB_CMD  = 'node /home/ubuntu/InfraCheck/autoCollectionJob.mjs';

function ssh(cmd) {
  return execSync(
    `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${SSH_HOST} "${cmd}"`,
    { encoding: 'utf8', timeout: 60000 }
  ).trim();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runLevel(targetLevel) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🚀 DISPARANDO NÍVEL ${targetLevel} DE 4`);
  console.log(`${'═'.repeat(60)}`);

  if (targetLevel === 1) {
    await pool.query("DELETE FROM collection_state WHERE LOWER(store_name) = 'saga teste'");
    console.log('  ✅ Estado resetado (início do ciclo)');
  } else {
    // Simula que já passou 31 dias desde o nível anterior, mantendo o thread_message_id
    await pool.query(`
      UPDATE collection_state 
      SET current_level = $1,
          last_sent_at  = NOW() - INTERVAL '31 days'
      WHERE LOWER(store_name) = 'saga teste'
    `, [targetLevel - 1]);
    console.log(`  ✅ Simulado: nível ${targetLevel - 1} enviado há 31 dias`);
  }

  await sleep(1500);

  console.log('  ▶ Executando job no servidor AWS...\n');
  try {
    const output = ssh(JOB_CMD);
    console.log(output.split('\n').map(l => '  ' + l).join('\n'));
  } catch (err) {
    console.error('  ❌ Erro ao executar job:', err.message);
  }
}

async function main() {
  console.log('\n🧪 TESTE COMPLETO — 4 NÍVEIS DA RÉGUA DE COBRANÇA — SAGA TESTE');

  try {
    // Verifica contatos
    const contacts = await pool.query(`
      SELECT sc.store_name, sc.manager_sales_email, sc.manager_aftersales_email, sc.director_email
      FROM store_contacts sc
      WHERE LOWER(sc.store_name) = 'saga teste'
      UNION
      SELECT sc.store_name, sc.manager_sales_email, sc.manager_aftersales_email, sc.director_email
      FROM store_contacts sc
      INNER JOIN locations l ON LOWER(l.store_contact_name) = LOWER(sc.store_name)
      WHERE LOWER(l.name) = 'saga teste'
      LIMIT 1
    `);

    if (contacts.rows.length === 0) {
      console.error('\n❌ Nenhum contato para SAGA TESTE. Verifique o vínculo na planilha.');
      await pool.end();
      process.exit(1);
    }

    const c = contacts.rows[0];
    console.log('\n📋 Contatos encontrados para SAGA TESTE:');
    console.log(`   Gerente Vendas:    ${c.manager_sales_email || '(não cadastrado)'}`);
    console.log(`   Gerente Pós-Venda: ${c.manager_aftersales_email || '(não cadastrado)'}`);
    console.log(`   Diretor:           ${c.director_email || '(não cadastrado)'}`);

    // Nível 1
    await runLevel(1);
    console.log('\n  ⏳ Aguardando 5s antes do próximo nível...');
    await sleep(5000);

    // Nível 2
    await runLevel(2);
    console.log('\n  ⏳ Aguardando 5s antes do próximo nível...');
    await sleep(5000);

    // Nível 3
    await runLevel(3);
    console.log('\n  ⏳ Aguardando 5s antes do próximo nível...');
    await sleep(5000);

    // Nível 4
    await runLevel(4);

    console.log(`\n${'═'.repeat(60)}`);
    console.log('  ✅ TESTE COMPLETO! Verifique as caixas de entrada.');
    console.log(`${'═'.repeat(60)}\n`);

  } catch (err) {
    console.error('Erro durante o teste:', err.message);
  } finally {
    await pool.end();
  }
}

main();
