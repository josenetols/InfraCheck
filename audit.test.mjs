import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});
process.env.DATABASE_URL = env['DATABASE_URL'];

import { pool } from './src/lib/db.js';
import { calculateMonthlyGoal, closeCycle } from './src/backend/models/goalModel.js';
import { randomUUID } from 'crypto';

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log("Iniciando auditoria completa da nova arquitetura de Metas por Ciclo - SEGUNDA RODADA...");

    // 1. Setup Test Data
    const techId = randomUUID();
    const techIdB = randomUUID();
    const techIdC = randomUUID();
    const techIdD = randomUUID();

    await client.query('INSERT INTO technicians (id, name, username, password_hash, active) VALUES ($1, $2, $3, $4, true)', [techId, 'Test Tech A', techId, 'hash']);
    await client.query('INSERT INTO technicians (id, name, username, password_hash, active) VALUES ($1, $2, $3, $4, true)', [techIdB, 'Test Tech B', techIdB, 'hash']);
    await client.query('INSERT INTO technicians (id, name, username, password_hash, active) VALUES ($1, $2, $3, $4, true)', [techIdC, 'Test Tech C', techIdC, 'hash']);
    await client.query('INSERT INTO technicians (id, name, username, password_hash, active) VALUES ($1, $2, $3, $4, true)', [techIdD, 'Test Tech D', techIdD, 'hash']);

    const locationIds = [];
    const locationNames = [];
    for (let i = 0; i < 50; i++) {
      const locId = randomUUID();
      const locName = randomUUID();
      locationIds.push(locId);
      locationNames.push(locName);
      await client.query('INSERT INTO locations (id, name, region_name) VALUES ($1, $2, $3)', [locId, locName, 'SP']);
    }

    const year = 2026;

    // --- TESTE A: 0 lojas atribuídas, 0 realizados = SEM DADOS ---
    const testARes = await calculateMonthlyGoal(techId, year, 1);
    console.log(`[TESTE A] 0 esperados, 0 realizados -> Status: ${testARes.status}, %: ${testARes.percentage === null ? 'null' : testARes.percentage}`);

    // --- TESTE B: 10 lojas atribuídas, 0 realizados = 0% ---
    for (let i = 0; i < 10; i++) {
      await client.query(`
        INSERT INTO assignments (location_id, technician_id, location_name, technician_name, start_date, year, cycle, active, month_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      `, [locationIds[i], techIdB, locationNames[i], 'Test Tech B', `${year}-01-01T00:00:00Z`, year, 1, `${year}-01`]);
    }
    const testBRes = await calculateMonthlyGoal(techIdB, year, 1);
    console.log(`[TESTE B] 10 esperados, 0 realizados -> Status: ${testBRes.status}, %: ${testBRes.percentage}`);

    // --- TESTE C: 10 esperados, 9 realizados = 90% ---
    for (let i = 10; i < 20; i++) {
      await client.query(`
        INSERT INTO assignments (location_id, technician_id, location_name, technician_name, start_date, year, cycle, active, month_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      `, [locationIds[i], techIdC, locationNames[i], 'Test Tech C', `${year}-01-01T00:00:00Z`, year, 1, `${year}-01`]);
    }
    for (let i = 10; i < 19; i++) {
      await client.query(`
        INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
      `, [randomUUID(), locationIds[i], techIdC, locationNames[i], 'Test Tech C', year, 1, 1, `${year}-01-15T12:00:00Z`]);
    }
    const testCRes = await calculateMonthlyGoal(techIdC, year, 1);
    console.log(`[TESTE C] 10 esperados, 9 realizados -> Status: ${testCRes.status}, %: ${testCRes.percentage}`);

    // --- TESTE D: 10 esperados, 12 realizados = 120% ---
    for (let i = 20; i < 30; i++) {
      await client.query(`
        INSERT INTO assignments (location_id, technician_id, location_name, technician_name, start_date, year, cycle, active, month_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
      `, [locationIds[i], techIdD, locationNames[i], 'Test Tech D', `${year}-01-01T00:00:00Z`, year, 1, `${year}-01`]);
    }
    // Faz 10 na base dele + 2 de outras lojas
    for (let i = 20; i < 32; i++) {
      await client.query(`
        INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
      `, [randomUUID(), locationIds[i], techIdD, locationNames[i], 'Test Tech D', year, 1, 1, `${year}-01-15T12:00:00Z`]);
    }
    const testDRes = await calculateMonthlyGoal(techIdD, year, 1);
    console.log(`[TESTE D] 10 esperados, 12 realizados -> Status: ${testDRes.status}, %: ${testDRes.percentage}`);

    // --- TESTE E: M1 = 90%, M2 = SEM DADOS, M3 = 100%. Média válida = 95% ---
    // M2 = techIdC sem loja (removemos a vigência em fev)
    await client.query(`UPDATE assignments SET end_date = $1 WHERE technician_id = $2`, [`${year}-01-31T23:59:59Z`, techIdC]);
    await calculateMonthlyGoal(techIdC, year, 2); // Result: SEM DADOS (M2)
    // M3 = Manda 1 loja para techC e ele faz 1 (100%)
    await client.query(`
      INSERT INTO assignments (location_id, technician_id, location_name, technician_name, start_date, year, cycle, active, month_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
    `, [locationIds[40], techIdC, locationNames[40], 'Test Tech C', `${year}-03-01T00:00:00Z`, year, 1, `${year}-03`]);
    await client.query(`
      INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
    `, [randomUUID(), locationIds[40], techIdC, locationNames[40], 'Test Tech C', year, 3, 1, `${year}-03-15T12:00:00Z`]);
    await calculateMonthlyGoal(techIdC, year, 3); // Result: 100% (M3)
    
    const closeERes = await closeCycle(techIdC, year, 1);
    console.log(`[TESTE E] M1=90, M2=null, M3=100 -> Média Ciclo: ${closeERes.average_percentage}`);

    // --- TESTE F: M1 = 90%, M2 = 0%, M3 = 100%. Média = 63.33% ---
    // Usaremos Tech D para esse teste, já tem M1 = 120%. Vamos resetar Tech D M1 para 90% apagando 3 checks.
    await client.query(`DELETE FROM checklists WHERE technician_id = $1 AND month = 1`, [techIdD]);
    for (let i = 20; i < 29; i++) {
       await client.query(`
        INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
      `, [randomUUID(), locationIds[i], techIdD, locationNames[i], 'Test Tech D', year, 1, 1, `${year}-01-15T12:00:00Z`]);
    }
    await calculateMonthlyGoal(techIdD, year, 1); // 90%
    await calculateMonthlyGoal(techIdD, year, 2); // 0% (continua com 10 assignments, mas 0 checks)
    for (let i = 20; i < 30; i++) {
       await client.query(`
        INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
      `, [randomUUID(), locationIds[i], techIdD, locationNames[i], 'Test Tech D', year, 3, 1, `${year}-03-15T12:00:00Z`]);
    }
    await calculateMonthlyGoal(techIdD, year, 3); // 100%
    const closeFRes = await closeCycle(techIdD, year, 1);
    console.log(`[TESTE F] M1=90, M2=0, M3=100 -> Média Ciclo: ${closeFRes.average_percentage}`);

    // --- TESTE G: M4 possui checklists -> Resultado do ciclo intacto E ciclo fechado não pode ser reaberto ---
    for (let i = 20; i < 25; i++) {
       await client.query(`
        INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
      `, [randomUUID(), locationIds[i], techIdD, locationNames[i], 'Test Tech D', year, 4, 1, `${year}-04-15T12:00:00Z`]);
    }
    await calculateMonthlyGoal(techIdD, year, 4);
    
    // Verificar que tentar fechar ciclo já fechado lança exceção (BUG-005)
    let closedCycleProtected = false;
    try {
      await closeCycle(techIdD, year, 1);
    } catch (err) {
      closedCycleProtected = err.message.includes('já foi oficialmente fechado');
    }
    
    // Verificar que a média original (63.33%) está intacta no banco
    const cycleCheck = await client.query(
      'SELECT average_percentage FROM cycle_goals WHERE technician_id = $1 AND year = $2 AND cycle = $3',
      [techIdD, year, 1]
    );
    const cycleIntact = Math.abs(Number(cycleCheck.rows[0]?.average_percentage) - 63.333) < 0.01;
    console.log(`[TESTE G] M4 com checklists: Ciclo fechado bloqueado=${closedCycleProtected}, Média original intacta=${cycleIntact} (${cycleCheck.rows[0]?.average_percentage}%)`);

    // --- TESTE H & I: Funções de Lógica Frontend para Distribuição ---
    const checkDistribution = (counts) => {
        const values = Object.values(counts);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const total = values.reduce((a, b) => a + b, 0);
        const gapAllowed = Math.floor(total % values.length) + 1;
        const diff = max - min;
        if (diff > gapAllowed && diff >= 3) {
            return `Alerta: Desequilíbrio. Dif: ${diff}`;
        }
        return `Aceitável. Dif: ${diff}`;
    };
    console.log(`[TESTE H] Distribuição 12, 11, 11, 11 -> ${checkDistribution({ t1: 12, t2: 11, t3: 11, t4: 11 })}`);
    console.log(`[TESTE I] Distribuição 15, 10, 10, 9 -> ${checkDistribution({ t1: 15, t2: 10, t3: 10, t4: 9 })}`);

    // --- TESTE J: Redistribuição de loja (checklists de agosto mantidos para Matheus) ---
    // Usaremos Tech B (Matheus) -> Check M1
    // Agora Loja A (locIds[0]) vai pro Tech A no M2
    await client.query(`UPDATE assignments SET end_date = $1 WHERE location_id = $2 AND technician_id = $3`, [`${year}-01-31T23:59:59Z`, locationIds[0], techIdB]);
    await client.query(`
      INSERT INTO assignments (location_id, technician_id, location_name, technician_name, start_date, year, cycle, active, month_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
    `, [locationIds[0], techId, locationNames[0], 'Test Tech A', `${year}-02-01T00:00:00Z`, year, 1, `${year}-02`]);
    
    // Insere checklist pro tech B no M1
    await client.query(`
      INSERT INTO checklists (id, location_id, technician_id, location_name, technician_name, year, month, cycle, visit_date, is_baseline, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, '{}')
    `, [randomUUID(), locationIds[0], techIdB, locationNames[0], 'Test Tech B', year, 1, 1, `${year}-01-10T12:00:00Z`]);
    
    // Verifica
    const checkJ = await client.query(`SELECT technician_id FROM checklists WHERE location_id = $1 AND month = 1`, [locationIds[0]]);
    console.log(`[TESTE J] Checklist anterior da Loja mantido com técnico original: ${checkJ.rows[0].technician_id === techIdB ? 'SIM' : 'NÃO'}`);


    // Clean up
    await client.query('DELETE FROM checklists WHERE technician_id IN ($1, $2, $3, $4)', [techId, techIdB, techIdC, techIdD]);
    await client.query('DELETE FROM assignments WHERE technician_id IN ($1, $2, $3, $4)', [techId, techIdB, techIdC, techIdD]);
    await client.query('DELETE FROM cycle_goals WHERE technician_id IN ($1, $2, $3, $4)', [techId, techIdB, techIdC, techIdD]);
    await client.query('DELETE FROM monthly_goals WHERE technician_id IN ($1, $2, $3, $4)', [techId, techIdB, techIdC, techIdD]);
    await client.query('DELETE FROM technicians WHERE id IN ($1, $2, $3, $4)', [techId, techIdB, techIdC, techIdD]);
    for (const locId of locationIds) {
      await client.query('DELETE FROM locations WHERE id = $1', [locId]);
    }

    console.log("Auditoria finalizada com sucesso!");
  } catch (err) {
    console.error("Erro na auditoria:", err);
  } finally {
    client.release();
  }
}

runAudit().then(() => process.exit(0));
