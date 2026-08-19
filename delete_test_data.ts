import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from './src/lib/db.js';

async function run() {
  // Wipe all checklists attached to these test entities
  const locs = await pool.query(`
    SELECT name FROM locations 
    WHERE name NOT IN (
      'Volkswagen T7', 'Toyota T7', 'RAM Castelo Branco', 'Marketing Galpão',
      'Compliance', 'Primeira Mão T7', 'Primeira Mão Off Road T7', 'BYD Marista',
      'Tudo Chevrolet Mutirão', 'Nissan 85', 'Primeira Mão 85', 'BMW Carros',
      'CRT', 'Jeep / RAM BR', 'Triumph', 'BMW Motos', 'Seminovos Motos',
      'Tudo Chevrolet Buriti', 'Toyota Buriti', 'Primeira Mão Buriti', 'Hyundai T9',
      'Jeep T9', 'BYD Cidade Jardim', 'Hyundai Cidade Jardim', 'Primeira Mão Cidade Jardim',
      'Outlet Shopping', 'Primeira Mão Shopping', 'Toyota Anapolis', 'Hyundai Anapolis',
      'Primeira Mão Anapolis', 'Jeep / RAM Anapolis', 'Nissan Anapolis', 'Fazendinha',
      'Primeira Mão Galpão', 'Primeira Mão Digital Galpão', 'Corretora', 'Seguros',
      'CSC', 'DP', 'Contabilidade', 'Controladoria', 'Administrativo',
      'Diretoria', 'Auditoria Galpão', 'Compras Galpão', 'RH Galpão', 'Compras CRT',
      'CRT Galpão', 'Marketing BYD', 'CRM T.I', 'Compliance Galpão'
    )
  `);

  const techs = await pool.query(`
    SELECT id, name FROM technicians 
    WHERE username NOT IN ('joseneto', 'felipe', 'rone', 'matheus')
  `);

  console.log("Deletando locs não-oficiais:", locs.rows.map(l => l.name));
  console.log("Deletando techs não-oficiais:", techs.rows.map(t => t.name));

  if (locs.rows.length > 0) {
    const locNames = locs.rows.map(r => r.name);
    await pool.query(`DELETE FROM locations WHERE name = ANY($1::text[])`, [locNames]);
    console.log(`Deletadas ${locs.rowCount} lojas extras.`);
  }

  if (techs.rows.length > 0) {
    const techIds = techs.rows.map(r => r.id);
    await pool.query(`DELETE FROM technicians WHERE id = ANY($1::text[])`, [techIds]);
    console.log(`Deletados ${techs.rowCount} técnicos extras.`);
  }

}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
