/**
 * autoCollectionJob.mjs
 * Job automático de escalonamento da Régua de Cobrança.
 *
 * Lógica de escalonamento por dias desde o checklist:
 *   Nível 0 → 1 : imediatamente ao salvar (dia 0)
 *   Nível 1 → 2 : após 30 dias
 *   Nível 2 → 3 : após 60 dias
 *   Nível 3 → 4 : após 90 dias
 *
 * Registrado no PM2 com cron: 0 7 * * * (todo dia às 07:00)
 * Também acionado via checklistController ao salvar um checklist.
 */

import pg from './node_modules/pg/lib/index.js';
import nodemailer from './node_modules/nodemailer/lib/nodemailer.js';
import fs from 'fs';

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

// ─── Extração de pendências ────────────────────────────────────────────────────

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

// ─── Download de foto para Buffer ─────────────────────────────────────────────

async function fetchPhotoAsBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch {
    return null;
  }
}

// ─── Template de e-mail detalhado ─────────────────────────────────────────────

const LEVEL_SUBJECTS = {
  1: 'Checklist de Infraestrutura Pendente — Ação Necessária',
  2: '⚠️ 1ª Cobrança — Checklist de TI ainda pendente',
  3: '🔴 2ª Cobrança — Checklist de TI sem resposta',
  4: '🚨 Escalonamento Máximo — Checklist de TI pendente sem solução',
};

async function buildEmailBody(level, storeName, month, checklistData) {
  const monthLabel = new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const visitDate  = checklistData?.visitDate
    ? new Date(checklistData.visitDate).toLocaleDateString('pt-BR')
    : 'N/A';
  const techName   = checklistData?.technicianName || 'N/A';

  const levelMessages = {
    1: `Prezado(a),<br><br>Informamos que o <strong>Checklist Mensal de Infraestrutura de TI</strong> referente ao mês de <strong>${monthLabel}</strong> da unidade <strong>${storeName}</strong> ainda possui pendências não resolvidas.<br><br>Solicitamos que seja providenciada a regularização dos itens abaixo.`,
    2: `Prezado(a) Diretor(a),<br><br>Esta é a <strong>primeira cobrança formal</strong> referente ao <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong>.<br><br>Os gerentes foram notificados anteriormente sem resposta. Solicitamos sua intervenção.`,
    3: `Prezado(a) Diretor(a),<br><br>Esta é a <strong>segunda e última cobrança</strong> ao(à) senhor(a) sobre o <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong>.<br><br>Não houve resposta às notificações anteriores. Caso não haja providências, o caso será escalado para a Diretoria de TI.`,
    4: `Prezado(a) Diretor(a) de TI,<br><br>Após <strong>3 notificações</strong>, o <strong>Checklist de TI</strong> de <strong>${monthLabel}</strong> — <strong>${storeName}</strong> permanece sem solução.<br><br>Solicitamos orientação e intervenção imediata.`,
  };

  const borderColor = level >= 4 ? '#e53935' : level >= 3 ? '#f57c00' : '#1565c0';
  const bgColor     = level >= 4 ? '#fff3e0' : level >= 3 ? '#fff8e1' : '#f9f9f9';

  // Coleção de attachments inline (CID)
  const attachments = [];
  let cidCounter = 0;

  async function renderPhotos(photos) {
    if (!photos || photos.length === 0) return '';
    const imgs = [];
    for (const p of photos) {
      if (!p.url && !p.base64) continue;
      cidCounter++;
      const cid = `photo-${cidCounter}@infracheck`;
      let buf = null;
      if (p.base64) {
        buf = Buffer.from(p.base64, 'base64');
      } else if (p.url) {
        buf = await fetchPhotoAsBuffer(p.url);
      }
      if (!buf) continue;
      attachments.push({
        filename: p.filename || `foto-${cidCounter}.jpg`,
        content: buf,
        cid,
        contentType: p.mimeType || 'image/jpeg',
      });
      imgs.push(`<img src="cid:${cid}" style="max-width:300px;max-height:220px;border-radius:4px;border:1px solid #ccc;margin:5px;" alt="Foto" />`);
    }
    return imgs.length ? `<div style="margin-top:10px;">${imgs.join('')}</div>` : '';
  }

  // ── Detalhamento de anomalias ──
  let anomaliasHtml = '';
  let hasAnomalia = false;

  if (checklistData) {
    const boolText = b => b ? 'Sim' : 'Não';

    // Máquinas problemáticas
    if (!checklistData.allMachinesOk && Array.isArray(checklistData.problematicMachines) && checklistData.problematicMachines.length > 0) {
      hasAnomalia = true;
      anomaliasHtml += `<h4 style="color:#003366;margin-bottom:10px;">🖥️ Estações de Trabalho</h4>`;
      for (const pm of checklistData.problematicMachines) {
        const photosHtml = await renderPhotos(pm.photos || []);
        anomaliasHtml += `
          <div style="background:#fff8f8;border-left:4px solid #d32f2f;padding:10px 15px;margin-bottom:15px;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 5px 0;"><strong>ID da Máquina:</strong> ${pm.identifier || 'N/A'}</p>
            <p style="margin:0 0 5px 0;"><strong>Processador:</strong> ${pm.processorGen || 'N/A'} | <strong>Windows 11:</strong> ${boolText(pm.osUpdated)}</p>
            <p style="margin:0 0 10px 0;color:#b71c1c;"><strong>Problema Relatado:</strong> ${pm.problemDescription || ''}</p>
            ${photosHtml}
          </div>`;
      }
    }

    // Pontos de rede
    if (!checklistData.networkPointsOk && Array.isArray(checklistData.problematicNetworkPoints) && checklistData.problematicNetworkPoints.length > 0) {
      hasAnomalia = true;
      anomaliasHtml += `<h4 style="color:#003366;margin-bottom:10px;margin-top:20px;">🔌 Pontos de Rede Física</h4>`;
      for (const np of checklistData.problematicNetworkPoints) {
        const photosHtml = await renderPhotos(np.photos || []);
        anomaliasHtml += `
          <div style="background:#fff8f8;border-left:4px solid #d32f2f;padding:10px 15px;margin-bottom:15px;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 5px 0;"><strong>Local do Ponto:</strong> ${np.location || ''}</p>
            <p style="margin:0 0 10px 0;color:#b71c1c;"><strong>Descrição:</strong> ${np.description || ''}</p>
            ${photosHtml}
          </div>`;
      }
    }

    // Switches com problema
    const badSwitches = (checklistData.switches || []).filter(s => s.conditionOk === false);
    if (badSwitches.length > 0) {
      hasAnomalia = true;
      anomaliasHtml += `<h4 style="color:#003366;margin-bottom:10px;margin-top:20px;">🔀 Switches com Problema</h4>`;
      for (const s of badSwitches) {
        anomaliasHtml += `
          <div style="background:#fff8f8;border-left:4px solid #d32f2f;padding:10px 15px;margin-bottom:15px;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 5px 0;"><strong>Marca:</strong> ${s.brand || 'N/A'} | <strong>Modelo:</strong> ${s.model || 'N/A'} | <strong>Portas:</strong> ${s.ports || 'N/A'}</p>
            ${s.notes ? `<p style="margin:0;color:#b71c1c;"><strong>Observações:</strong> ${s.notes}</p>` : ''}
          </div>`;
      }
    }

    // Antenas com falha
    const badAntennas = (checklistData.antennas || []).filter(a => a.isWorking === false);
    if (badAntennas.length > 0) {
      hasAnomalia = true;
      anomaliasHtml += `<h4 style="color:#003366;margin-bottom:10px;margin-top:20px;">📡 Antenas com Falha</h4>`;
      for (const a of badAntennas) {
        anomaliasHtml += `
          <div style="background:#fff8f8;border-left:4px solid #d32f2f;padding:10px 15px;margin-bottom:15px;border-radius:0 4px 4px 0;">
            <p style="margin:0 0 5px 0;"><strong>Marca/Modelo:</strong> ${a.brand || 'N/A'} | <strong>Local:</strong> ${a.location || 'N/A'}</p>
            ${a.notes ? `<p style="margin:0;color:#b71c1c;"><strong>Observações:</strong> ${a.notes}</p>` : ''}
          </div>`;
      }
    }

    // Fotos do CPD
    const cpdPhotosHtml = await renderPhotos(checklistData.cpdPhotos || []);
    if (cpdPhotosHtml) {
      anomaliasHtml += `
        <h4 style="color:#003366;margin-bottom:10px;margin-top:20px;">📸 Fotos do CPD / Rack</h4>
        ${cpdPhotosHtml}`;
    }
  }

  const html = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">

  <!-- Header -->
  <div style="background:#003366;padding:20px;text-align:center;">
    <h2 style="color:#fff;margin:0;font-size:20px;">Régua de Cobrança — Checklist de TI (Automático)</h2>
    <p style="color:#aac4e0;margin:6px 0 0;font-size:12px;">SAGA Grupo — Equipe de Infraestrutura</p>
  </div>

  <!-- Meta Info -->
  <div style="background:#f4f7fa;padding:15px 20px;border-bottom:1px solid #ddd;">
    <p style="margin:0 0 5px 0;"><strong>Local:</strong> ${storeName}</p>
    <p style="margin:0 0 5px 0;"><strong>Data da Visita:</strong> ${visitDate}</p>
    <p style="margin:0;"><strong>Técnico:</strong> ${techName}</p>
  </div>

  <!-- Nível / Mensagem -->
  <div style="padding:24px;background:#fff;">
    <div style="background:${bgColor};border-left:4px solid ${borderColor};padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:20px;">
      <strong>Nível ${level} de 4</strong> — ${LEVEL_SUBJECTS[level]}
      <span style="float:right;font-size:11px;color:#999;">Disparo automático</span>
    </div>
    <p>${levelMessages[level] || ''}</p>
  </div>

  ${hasAnomalia ? `
  <!-- Detalhamento de Anomalias -->
  <div style="padding:20px;background:#fff;border-top:1px solid #eee;">
    <h3 style="color:#d32f2f;border-bottom:2px solid #ffcdd2;padding-bottom:5px;margin-top:0;">Detalhamento de Anomalias</h3>
    ${anomaliasHtml}
  </div>` : ''}

  <!-- Footer -->
  <div style="background:#f9f9f9;padding:12px;text-align:center;border-top:1px solid #eee;">
    <p style="font-size:11px;color:#999;margin:0;">Este e-mail foi gerado automaticamente. Não responda diretamente.</p>
  </div>
</div>`;

  return { html, attachments };
}

// ─── Lógica de escalamento ────────────────────────────────────────────────────

// Dias mínimos entre um nível e o próximo
// Nível 0 → 1: imediatamente (0 dias desde a visita)
// Nível 1 → 2: 30 dias desde o envio do nível 1
// Nível 2 → 3: 30 dias desde o envio do nível 2
// Nível 3 → 4: 30 dias desde o envio do nível 3
const ESCALATION_DAYS = { 0: 0, 1: 30, 2: 30, 3: 30 };

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
      cs.resolved_at,
      cs.thread_message_id
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
    const currentLevel = row.current_level || 0;
    const requiredDays = ESCALATION_DAYS[currentLevel];

    // Nível 0 → 1: conta dias desde a visita
    // Nível 1+ → N: conta dias desde o último e-mail enviado
    const referenceDate = (currentLevel > 0 && row.last_sent_at)
      ? new Date(row.last_sent_at)
      : visitDate;
    const daysSince = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));

    if (requiredDays === undefined || daysSince < requiredDays) {
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
      SELECT *
      FROM locations
      WHERE LOWER(name) = LOWER($1)
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
      // Gera HTML detalhado com fotos inline
      const { html, attachments } = await buildEmailBody(nextLevel, row.location_name, row.month, row.data);

      // Monta subject: resposta ao thread existente ou novo
      const isReply = nextLevel > 1 && row.thread_message_id;
      const subject = isReply
        ? `Re: ${LEVEL_SUBJECTS[1]}` // mantém o assunto original para agrupar no thread
        : LEVEL_SUBJECTS[nextLevel];

      // Headers de threading para agrupar no mesmo fio no Outlook/Gmail
      const extraHeaders = isReply
        ? { 'In-Reply-To': row.thread_message_id, 'References': row.thread_message_id }
        : {};

      const info = await transporter.sendMail({
        from:        SMTP_FROM,
        to:          to.join(', '),
        cc:          cc.join(', ') || undefined,
        subject,
        html,
        attachments: attachments.length > 0 ? attachments : undefined,
        headers:     extraHeaders,
      });

      // Captura o Message-ID gerado para usar como thread nos próximos níveis
      const sentMessageId = info.messageId || null;
      // Usa o messageId do nível 1 como âncora do thread
      const threadMessageId = (nextLevel === 1 ? sentMessageId : row.thread_message_id) || sentMessageId;

      // Salva no banco
      await pool.query(`
        INSERT INTO collection_state (store_name, month, current_level, last_sent_at, last_sent_by, auto_fired, thread_message_id)
        VALUES ($1, $2, $3, NOW(), 'Sistema Automático', true, $4)
        ON CONFLICT (store_name, month) DO UPDATE SET
          current_level     = EXCLUDED.current_level,
          last_sent_at      = NOW(),
          last_sent_by      = 'Sistema Automático',
          auto_fired        = true,
          thread_message_id = COALESCE(collection_state.thread_message_id, EXCLUDED.thread_message_id)
      `, [row.location_name, row.month, nextLevel, threadMessageId]);

      console.log(`[${timestamp}] [auto-collection] ✅ "${row.location_name}" → Nível ${nextLevel} (${daysSince} dias desde checklist)${isReply ? ' [thread]' : ''}`);
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
