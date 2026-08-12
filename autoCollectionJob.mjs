/**
 * autoCollectionJob.mjs
 * Job automático de escalonamento da Régua de Cobrança.
 *
 * Lógica de escalonamento por dias desde o checklist:
 *   Nível 0 → 1 : após 30 dias sem ação
 *   Nível 1 → 2 : após 60 dias (30 dias após nível 1)
 *   Nível 2 → 3 : após 90 dias (30 dias após nível 2)
 *   Nível 3 → 4 : após 120 dias (30 dias após nível 3)
 *
 * Registrado no PM2 com cron: 0 7 * * * (todo dia às 07:00)
 */

import pg from './node_modules/pg/lib/index.js';
import nodemailer from './node_modules/nodemailer/lib/nodemailer.js';
import fs from 'fs';
import https from 'https';

const { Pool } = pg;

// ─── Configuração ──────────────────────────────────────────────────────────────

const ENV_PATH = '/home/ubuntu/InfraCheck/.env.local';

function parseEnv(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const result = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i < 0) continue;
      result[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
    }
    return result;
  } catch (e) {
    return {};
  }
}

const env = parseEnv(ENV_PATH);
const pool = new Pool({ connectionString: env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

const SMTP_CONFIG = {
  host:   env['SMTP_HOST']   || 'smtp.office365.com',
  port:   parseInt(env['SMTP_PORT'] || '587'),
  secure: false,
  auth: {
    user: env['SMTP_USER'] || '',
    pass: env['SMTP_PASS'] || '',
  },
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
};

const SMTP_FROM = env['SMTP_FROM'] || env['SMTP_USER'] || '';

// ─── Extração de pendências do JSONB ──────────────────────────────────────────

function extractPendingItems(data) {
  const items = [];
  if (!data) return items;

  if (Array.isArray(data.problematicMachines)) {
    for (const m of data.problematicMachines) {
      const desc = [
        m.identifier   ? 'ID: ' + m.identifier : null,
        m.processorGen ? 'Processador: ' + m.processorGen : null,
        m.problemDescription || null,
      ].filter(Boolean).join(' | ');
      if (desc) items.push({ category: 'Máquina com Problema', description: desc });
    }
  }

  if (Array.isArray(data.problematicNetworkPoints)) {
    for (const p of data.problematicNetworkPoints) {
      const desc = [
        p.location    ? 'Ponto: ' + p.location : null,
        p.description || null,
      ].filter(Boolean).join(' | ');
      if (desc) items.push({ category: 'Ponto de Rede', description: desc });
    }
  }

  if (Array.isArray(data.switches)) {
    for (const s of data.switches) {
      if (s.conditionOk === false) {
        const desc = [s.brand ? 'Marca: ' + s.brand : null, s.notes || null].filter(Boolean).join(' | ');
        items.push({ category: 'Switch com Problema', description: desc || 'Sem detalhes' });
      }
    }
  }

  if (Array.isArray(data.antennas)) {
    for (const a of data.antennas) {
      if (a.isWorking === false) {
        const desc = [a.brand ? 'Marca: ' + a.brand : null, a.location ? 'Local: ' + a.location : null, a.notes || null].filter(Boolean).join(' | ');
        items.push({ category: 'Antena com Falha', description: desc || 'Sem detalhes' });
      }
    }
  }

  if (data.cableCondition && data.cableCondition !== 'Organizado') {
    const note = data.cableNotes ? ' — ' + data.cableNotes : '';
    items.push({ category: 'Cabeamento', description: 'Condição: ' + data.cableCondition + note });
  }

  if (data.hasFirewall && data.firewallWorking === false) {
    const note = data.firewallNotes ? ' — ' + data.firewallNotes : '';
    items.push({ category: 'Firewall', description: 'Firewall com problema' + note });
  }

  if (data.employeesSatisfied === false && data.complaints) {
    items.push({ category: 'Reclamações', description: data.complaints });
  }

  return items;
}

// ─── Template de e-mail ────────────────────────────────────────────────────────

const LEVEL_SUBJECTS = {
  1: 'Checklist de Infraestrutura Pendente — Ação Necessária',
  2: '⚠️ 1ª Cobrança — Checklist de TI ainda pendente',
  3: '🔴 2ª Cobrança — Checklist de TI sem resposta',
  4: '🚨 Escalonamento Máximo — Checklist de TI pendente sem solução',
};

function buildEmailBody(level, storeName, month, pendingItems = []) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const levelMessages = {
    1: `Prezado(a),<br><br>Informamos que o <strong>Checklist Mensal de Infraestrutura de TI</strong> referente ao mês de <strong>${monthLabel}</strong> da unidade <strong>${storeName}</strong> ainda possui pendências não resolvidas.<br><br>Solicitamos que seja providenciada a regularização dos itens abaixo.`,
    2: `Prezado(a) Diretor(a),<br><br>Esta é a <strong>primeira cobrança formal</strong> referente ao <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong>.<br><br>Os gerentes foram notificados anteriormente sem resposta. Solicitamos sua intervenção.`,
    3: `Prezado(a) Diretor(a),<br><br>Esta é a <strong>segunda e última cobrança</strong> ao(à) senhor(a) sobre o <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong>.<br><br>Não houve resposta às notificações anteriores. Caso não haja providências, o caso será escalado para a Diretoria de TI.`,
    4: `Prezado(a) Diretor(a) de TI,<br><br>Após <strong>3 notificações</strong>, o <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong> permanece sem solução.<br><br>Solicitamos orientação e intervenção imediata.`,
  };

  const borderColor = level >= 4 ? '#e53935' : level >= 3 ? '#f57c00' : '#1565c0';
  const bgColor     = level >= 4 ? '#fff3e0' : level >= 3 ? '#fff8e1' : '#f9f9f9';

  const pendingSection = pendingItems.length > 0
    ? `<div style="margin-top:20px;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
        <div style="background:#fff3e0;padding:10px 16px;border-bottom:1px solid #e0e0e0;">
          <strong style="color:#e65100;font-size:13px;">⚠️ Itens Pendentes (${pendingItems.length})</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f5f5f5;">
            <th style="padding:8px 12px;text-align:left;color:#555;width:35%;">Categoria</th>
            <th style="padding:8px 12px;text-align:left;color:#555;">Descrição</th>
          </tr></thead>
          <tbody>${pendingItems.map((item, idx) =>
            `<tr style="background:${idx % 2 === 0 ? '#fff' : '#fafafa'};border-top:1px solid #eee;">
              <td style="padding:8px 12px;color:#c62828;font-weight:bold;">${item.category}</td>
              <td style="padding:8px 12px;color:#333;">${item.description}</td>
            </tr>`
          ).join('')}</tbody>
        </table>
      </div>`
    : '';

  return `<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
    <div style="background:#003366;padding:20px;text-align:center;">
      <h2 style="color:#fff;margin:0;font-size:18px;">Régua de Cobrança — Checklist de TI (Automático)</h2>
      <p style="color:#aac4e0;margin:6px 0 0;font-size:12px;">SAGA Grupo — Equipe de Infraestrutura</p>
    </div>
    <div style="padding:24px;background:#fff;">
      <div style="background:${bgColor};border-left:4px solid ${borderColor};padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:20px;">
        <strong>Nível ${level} de 4</strong> — ${LEVEL_SUBJECTS[level]}
        <span style="float:right;font-size:11px;color:#999;">Disparo automático</span>
      </div>
      <p>${levelMessages[level] || ''}</p>
      ${pendingSection}
      <br>
      <p style="color:#555;font-size:13px;">Gerado pelo sistema <strong>InfraCheck BR</strong> — Disparo automático</p>
    </div>
    <div style="background:#f9f9f9;padding:12px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#999;margin:0;">Este e-mail foi gerado automaticamente. Não responda diretamente.</p>
    </div>
  </div>`;
}

// ─── Lógica de escalamento ────────────────────────────────────────────────────

const ESCALATION_DAYS = { 0: 30, 1: 60, 2: 90, 3: 120 };

async function run() {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`[${timestamp}] [auto-collection] Iniciando job de escalamento automático...`);

  // Busca lojas com checklists recentes que tenham pendências reais (não resolvidos)
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
      -- Só checklists dos últimos 6 meses
      c.visit_date >= NOW() - INTERVAL '6 months'
      -- Não resolvidos
      AND (cs.resolved_at IS NULL OR cs.id IS NULL)
    ORDER BY c.location_name, c.visit_date DESC
  `);

  const checklists = checklistsResult.rows;
  console.log(`[${timestamp}] [auto-collection] ${checklists.length} loja(s) para avaliar`);

  // Busca equipe TI
  const tiResult = await pool.query(`
    SELECT name, email, ti_role FROM ti_supervisors WHERE active = true
  `);
  const tiTeam = tiResult.rows;
  const tiDirector  = tiTeam.find(t => t.ti_role === 'director')  || null;
  const tiManager   = tiTeam.find(t => t.ti_role === 'manager')   || null;
  const tiCoord     = tiTeam.find(t => t.ti_role === 'coordinator') || null;
  const techsResult = await pool.query(`SELECT name, email FROM technicians WHERE active = true AND role = 'technician' AND email IS NOT NULL`);
  const technicians = techsResult.rows;

  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.error(`[${timestamp}] [auto-collection] ERRO: Credenciais SMTP não configuradas no .env.local`);
    await pool.end();
    return;
  }

  const transporter = nodemailer.createTransport(SMTP_CONFIG);
  let fired = 0;
  let skipped = 0;

  for (const row of checklists) {
    const pendingItems = extractPendingItems(row.data);

    // Se não há pendências no checklist, pula
    if (pendingItems.length === 0) {
      skipped++;
      continue;
    }

    const visitDate = new Date(row.visit_date);
    const daysSince = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
    const currentLevel = row.current_level || 0;
    const requiredDays = ESCALATION_DAYS[currentLevel];

    if (!requiredDays || daysSince < requiredDays) {
      skipped++;
      continue;
    }

    const nextLevel = currentLevel + 1;
    if (nextLevel > 4) {
      skipped++;
      continue;
    }

    // Busca contatos da loja
    const contactResult = await pool.query(`
      SELECT sc.*
      FROM store_contacts sc
      INNER JOIN locations l ON LOWER(l.store_contact_name) = LOWER(sc.store_name)
      WHERE LOWER(l.name) = LOWER($1)
      UNION
      SELECT * FROM store_contacts WHERE LOWER(store_name) = LOWER($1)
      LIMIT 1
    `, [row.location_name]);

    const store = contactResult.rows[0];
    if (!store) {
      console.warn(`[${timestamp}] [auto-collection] Sem contatos para "${row.location_name}" — pulando`);
      skipped++;
      continue;
    }

    // Monta destinatários
    const baseCC = [
      ...technicians.map(t => `"${t.name}" <${t.email}>`),
      tiCoord ? `"${tiCoord.name}" <${tiCoord.email}>` : null,
      tiManager ? `"${tiManager.name}" <${tiManager.email}>` : null,
    ].filter(Boolean);

    const managers = [
      store.manager_sales_email   ? `"${store.manager_sales_name}"   <${store.manager_sales_email}>` : null,
      store.manager_aftersales_email ? `"${store.manager_aftersales_name}" <${store.manager_aftersales_email}>` : null,
    ].filter(Boolean);

    const director = store.director_email ? `"${store.director_name}" <${store.director_email}>` : null;

    let to = [];
    let cc = [...baseCC];

    if (nextLevel === 1) {
      to = managers;
    } else if (nextLevel === 2 || nextLevel === 3) {
      to = director ? [director] : [];
      cc = [...managers, ...baseCC];
    } else if (nextLevel === 4) {
      to = tiDirector ? [`"${tiDirector.name}" <${tiDirector.email}>`] : [];
      cc = [...(director ? [director] : []), ...managers, ...baseCC];
    }

    if (to.length === 0) {
      console.warn(`[${timestamp}] [auto-collection] Sem destinatários para "${row.location_name}" nível ${nextLevel} — pulando`);
      skipped++;
      continue;
    }

    try {
      await transporter.sendMail({
        from:    SMTP_FROM,
        to:      to.join(', '),
        cc:      cc.join(', ') || undefined,
        subject: LEVEL_SUBJECTS[nextLevel],
        html:    buildEmailBody(nextLevel, row.location_name, row.month, pendingItems),
      });

      // Salva no banco
      await pool.query(`
        INSERT INTO collection_state (store_name, month, current_level, last_sent_at, last_sent_by, auto_fired)
        VALUES ($1, $2, $3, NOW(), 'Sistema Automático', true)
        ON CONFLICT (store_name, month) DO UPDATE SET
          current_level = EXCLUDED.current_level,
          last_sent_at  = NOW(),
          last_sent_by  = 'Sistema Automático',
          auto_fired    = true
      `, [row.location_name, row.month, nextLevel]);

      console.log(`[${timestamp}] [auto-collection] ✅ "${row.location_name}" → Nível ${nextLevel} (${daysSince} dias desde checklist)`);
      fired++;
    } catch (err) {
      console.error(`[${timestamp}] [auto-collection] ❌ Erro ao disparar para "${row.location_name}":`, err.message);
    }
  }

  console.log(`[${timestamp}] [auto-collection] Concluído. Disparados: ${fired} | Pulados: ${skipped}`);
  await pool.end();
}

run().catch(err => {
  console.error('[auto-collection] ERRO FATAL:', err);
  process.exit(1);
});
