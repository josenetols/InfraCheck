/**
 * migrate-locations.mjs
 * 
 * Este script migra a estrutura do sistema:
 * 1. Adiciona as colunas da régua de cobrança na tabela `locations`.
 * 2. Transfere os dados atuais de `store_contacts` para `locations`.
 * 3. Prepara a tabela para o novo fluxo do CSV.
 */
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const pool = new Pool({
  connectionString: env['DATABASE_URL'],
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Iniciando migração de Lojas e Contatos...');
  try {
    // 1. Adicionar novas colunas em locations
    console.log('Adicionando colunas em locations...');
    await pool.query(`
      ALTER TABLE locations
      ADD COLUMN IF NOT EXISTS uf VARCHAR(50),
      ADD COLUMN IF NOT EXISTS director_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS director_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS manager_sales_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS manager_sales_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS manager_aftersales_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS manager_aftersales_email VARCHAR(255)
    `);

    // 2. Migrar dados de store_contacts para locations
    console.log('Migrando dados de store_contacts para locations...');
    const contactsRes = await pool.query('SELECT * FROM store_contacts');
    const contacts = contactsRes.rows;

    let updated = 0;
    for (const contact of contacts) {
      // Atualiza a loja que tem o vinculo explícito ou o nome exato
      const updateRes = await pool.query(`
        UPDATE locations
        SET 
          uf = $1,
          director_name = $2,
          director_email = $3,
          manager_sales_name = $4,
          manager_sales_email = $5,
          manager_aftersales_name = $6,
          manager_aftersales_email = $7
        WHERE 
          store_contact_name = $8 OR LOWER(name) = LOWER($8)
      `, [
        contact.uf,
        contact.director_name,
        contact.director_email,
        contact.manager_sales_name,
        contact.manager_sales_email,
        contact.manager_aftersales_name,
        contact.manager_aftersales_email,
        contact.store_name
      ]);
      
      updated += updateRes.rowCount;
    }
    console.log(`Dados migrados para ${updated} lojas.`);

    // 3. Remover coluna antiga de vínculo
    console.log('Removendo a coluna legada store_contact_name...');
    await pool.query(`
      ALTER TABLE locations DROP COLUMN IF EXISTS store_contact_name
    `);

    console.log('✅ Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

main();
