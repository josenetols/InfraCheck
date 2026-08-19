import { pool } from '../../lib/db.js';

export interface MonthlyGoal {
  technician_id: string;
  year: number;
  cycle: number;
  month: number;
  position_in_cycle: number;
  assigned_locations: number;
  expected_checklists: number;
  completed_checklists: number;
  percentage: number | null;
  status: string;
}

export interface CycleGoal {
  technician_id: string;
  year: number;
  cycle: number;
  month_1_percentage: number | null;
  month_2_percentage: number | null;
  month_3_percentage: number | null;
  average_percentage: number | null;
  status: string;
  closed_at: Date | null;
}

/**
 * Recalcula e salva a meta de um mês específico para um técnico.
 */
export const calculateMonthlyGoal = async (technicianId: string, year: number, month: number) => {
  const cycle = Math.floor((month - 1) / 4) + 1;
  const positionInCycle = ((month - 1) % 4) + 1;
  
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString();
  
  const client = await pool.connect();
  try {
    // 1. Contar lojas designadas para o técnico neste mês (vigência da atribuição)
    const assignmentsRes = await client.query(`
      SELECT COUNT(DISTINCT location_id)::int as count 
      FROM assignments 
      WHERE technician_id = $1 
      AND start_date <= $2 
      AND (end_date IS NULL OR end_date >= $3)
    `, [technicianId, monthEnd, monthStart]);
    
    const assignedLocations = assignmentsRes.rows[0].count;
    
    // Para simplificar, expected_checklists = assigned_locations
    // A menos que haja outra regra no negócio.
    const expectedChecklists = assignedLocations;
    
    // 2. Contar checklists realizados pelo técnico neste mês
    const checklistsRes = await client.query(`
      SELECT COUNT(DISTINCT location_id)::int as count 
      FROM checklists 
      WHERE technician_id = $1 
      AND year = $2 
      AND month = $3
    `, [technicianId, year, month]);
    
    const completedChecklists = checklistsRes.rows[0].count;
    
    // 3. Calcular percentual e status
    let percentage: number | null = 0;
    let status = 'SEM DADOS';
    
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const isFutureMonth = (year > today.getFullYear()) || (year === today.getFullYear() && month > (today.getMonth() + 1));
    
    if (expectedChecklists > 0) {
      percentage = (completedChecklists / expectedChecklists) * 100;
      
      if (percentage >= 100) {
        status = 'ATINGIDA';
      } else if (isFutureMonth) {
        status = 'NÃO INICIADA';
      } else if (isCurrentMonth) {
        status = 'EM ANDAMENTO';
      } else {
        status = 'NÃO ATINGIDA';
      }
    } else {
      // expectedChecklists === 0
      percentage = null;
      status = 'SEM DADOS';
    }
    
    // 4. Upsert em monthly_goals
    await client.query(`
      INSERT INTO monthly_goals (technician_id, year, cycle, month, position_in_cycle, assigned_locations, expected_checklists, completed_checklists, percentage, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (technician_id, year, cycle, month) DO UPDATE SET
        position_in_cycle = EXCLUDED.position_in_cycle,
        assigned_locations = EXCLUDED.assigned_locations,
        expected_checklists = EXCLUDED.expected_checklists,
        completed_checklists = EXCLUDED.completed_checklists,
        percentage = EXCLUDED.percentage,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [technicianId, year, cycle, month, positionInCycle, assignedLocations, expectedChecklists, completedChecklists, percentage, status]);
    
    return {
      technician_id: technicianId,
      year,
      cycle,
      month,
      position_in_cycle: positionInCycle,
      assigned_locations: assignedLocations,
      expected_checklists: expectedChecklists,
      completed_checklists: completedChecklists,
      percentage,
      status
    };
  } finally {
    client.release();
  }
};

/**
 * Fecha um ciclo se os 3 meses estiverem concluídos. O Mês 4 é o mês de fechamento real.
 */
export const closeCycle = async (technicianId: string, year: number, cycle: number) => {
  const client = await pool.connect();
  try {
    // Buscar os resultados dos meses 1, 2 e 3 do ciclo
    const monthsRes = await client.query(`
      SELECT month, position_in_cycle, percentage, status
      FROM monthly_goals
      WHERE technician_id = $1 AND year = $2 AND cycle = $3 AND position_in_cycle IN (1, 2, 3)
      ORDER BY position_in_cycle ASC
    `, [technicianId, year, cycle]);
    
    const months = monthsRes.rows;

    // BUG-005: Verificar se o ciclo já foi fechado oficialmente
    const existingCycle = await client.query(
      'SELECT id, closed_at FROM cycle_goals WHERE technician_id = $1 AND year = $2 AND cycle = $3',
      [technicianId, year, cycle]
    );
    if (existingCycle.rows[0]?.closed_at) {
      throw new Error('Este ciclo já foi oficialmente fechado e não pode ser reaberto ou alterado.');
    }
    
    if (months.length < 3) {
      throw new Error('Não é possível fechar o ciclo: dados dos 3 meses estão incompletos.');
    }
    
    const m1 = months.find(m => m.position_in_cycle === 1)?.percentage;
    const m2 = months.find(m => m.position_in_cycle === 2)?.percentage;
    const m3 = months.find(m => m.position_in_cycle === 3)?.percentage;
    
    // Apenas meses com dados reais (não-nulos) entram na média
    const validMonths = [m1, m2, m3].filter(p => p !== null && p !== undefined);

    let average: number | null = null;
    let status = 'SEM DADOS';

    if (validMonths.length > 0) {
      const sum = validMonths.reduce((acc, curr) => acc + Number(curr), 0);
      average = sum / validMonths.length;
      
      if (validMonths.length < 3) {
        // Ao menos um mês tem SEM DADOS — ciclo é incompleto, não pode ser julgado como atingido/não atingido
        status = 'CICLO INCOMPLETO';
      } else {
        // Todos os 3 meses têm dados — julgamento definitivo
        status = average >= 100 ? 'META ATINGIDA' : 'META NÃO ATINGIDA';
      }
    } else {
      // Nenhum mês tem dados
      status = 'SEM DADOS';
    }
    
    await client.query(`
      INSERT INTO cycle_goals (technician_id, year, cycle, month_1_percentage, month_2_percentage, month_3_percentage, average_percentage, status, closed_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (technician_id, year, cycle) DO UPDATE SET
        month_1_percentage = EXCLUDED.month_1_percentage,
        month_2_percentage = EXCLUDED.month_2_percentage,
        month_3_percentage = EXCLUDED.month_3_percentage,
        average_percentage = EXCLUDED.average_percentage,
        status = EXCLUDED.status,
        closed_at = EXCLUDED.closed_at,
        updated_at = NOW()
    `, [technicianId, year, cycle, m1, m2, m3, average, status]);
    
    return {
      average_percentage: average,
      status
    };
  } finally {
    client.release();
  }
};

/**
 * Obtém dados de meta atuais do técnico.
 */
export const getCurrentCycleGoal = async (technicianId: string) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cycle = Math.floor((month - 1) / 4) + 1;
  
  // Recalcular o mês atual primeiro (para dados frescos)
  await calculateMonthlyGoal(technicianId, year, month);
  
  // Se estivermos num mês avançado (ex: Mês 3 ou 4), também garantimos recalculo dos meses anteriores do ciclo?
  // Normalmente eles já deveriam estar salvos.
  
  const client = await pool.connect();
  try {
    const cycleGoalRes = await client.query(`
      SELECT * FROM cycle_goals WHERE technician_id = $1 AND year = $2 AND cycle = $3
    `, [technicianId, year, cycle]);
    
    const monthlyGoalsRes = await client.query(`
      SELECT * FROM monthly_goals 
      WHERE technician_id = $1 AND year = $2 AND cycle = $3
      ORDER BY position_in_cycle ASC
    `, [technicianId, year, cycle]);
    
    return {
      year,
      cycle,
      cycle_goal: cycleGoalRes.rows[0] || null,
      monthly_goals: monthlyGoalsRes.rows
    };
  } finally {
    client.release();
  }
};

/**
 * Obtém o histórico de todos os ciclos
 */
export const getHistory = async (filters: { technicianId?: string, year?: number, cycle?: number, month?: number }) => {
  let query = `
    SELECT mg.*, t.name as technician_name
    FROM monthly_goals mg
    JOIN technicians t ON mg.technician_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filters.technicianId) {
    params.push(filters.technicianId);
    query += ` AND mg.technician_id = $${params.length}`;
  }
  if (filters.year) {
    params.push(filters.year);
    query += ` AND mg.year = $${params.length}`;
  }
  if (filters.cycle) {
    params.push(filters.cycle);
    query += ` AND mg.cycle = $${params.length}`;
  }
  if (filters.month) {
    params.push(filters.month);
    query += ` AND mg.month = $${params.length}`;
  }
  
  query += ' ORDER BY mg.year DESC, mg.month DESC LIMIT 100';
  
  const result = await pool.query(query, params);
  
  // Obter as médias do ciclo
  let cycleQuery = `
    SELECT cg.*, t.name as technician_name
    FROM cycle_goals cg
    JOIN technicians t ON cg.technician_id = t.id
    WHERE 1=1
  `;
  const cycleParams: any[] = [];
  
  if (filters.technicianId) {
    cycleParams.push(filters.technicianId);
    cycleQuery += ` AND cg.technician_id = $${cycleParams.length}`;
  }
  if (filters.year) {
    cycleParams.push(filters.year);
    cycleQuery += ` AND cg.year = $${cycleParams.length}`;
  }
  if (filters.cycle) {
    cycleParams.push(filters.cycle);
    cycleQuery += ` AND cg.cycle = $${cycleParams.length}`;
  }
  
  cycleQuery += ' ORDER BY cg.year DESC, cg.cycle DESC LIMIT 50';
  const cycleResult = await pool.query(cycleQuery, cycleParams);
  
  return {
    monthly: result.rows,
    cycles: cycleResult.rows
  };
};

/**
 * Recalcula o mês inteiro para um ou mais técnicos
 */
export const recalculateAll = async (year: number, month: number) => {
  const techs = await pool.query('SELECT id FROM technicians WHERE active = true');
  for (const t of techs.rows) {
    await calculateMonthlyGoal(t.id, year, month);
  }
};
