/**
 * test-thread.mjs
 * Envia 2 e-mails reais para verificar o comportamento de threading.
 * O segundo deve aparecer como resposta ao primeiro no Outlook/Gmail.
 */

import nodemailer from './node_modules/nodemailer/lib/nodemailer.js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((a, b) => {
  const i = b.indexOf('=');
  if (i > 0) a[b.substring(0, i).trim()] = b.substring(i + 1).trim();
  return a;
}, {});

const transporter = nodemailer.createTransport({
  host:   env['SMTP_HOST']   || 'smtp.office365.com',
  port:   parseInt(env['SMTP_PORT'] || '587'),
  secure: false,
  auth: {
    user: env['SMTP_USER'],
    pass: env['SMTP_PASS'],
  },
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false },
});

const FROM    = env['SMTP_FROM'] || env['SMTP_USER'];
const TO      = 'fieldgo@gruposaga.com.br'; // Gerentes SAGA TESTE — Nível 1
const TO_DIR  = 'matheus.creis@gruposaga.com.br'; // Diretor SAGA TESTE — Nível 2
const CC_FIXO = env['SMTP_USER']; // técnico em CC para acompanhar
const SUBJECT = '[TESTE DE THREAD] Régua de Cobrança - SAGA TESTE';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n🧪 TESTE DE THREADING DE E-MAIL');
  console.log(`📧 Nível 1 → Para: ${TO} | CC: ${CC_FIXO}`);
  const info1 = await transporter.sendMail({
    from:    FROM,
    to:      TO,
    cc:      CC_FIXO,
    subject: SUBJECT,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:650px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:#003366;padding:20px;text-align:center;">
          <h2 style="color:#fff;margin:0;">⚠️ [TESTE] Régua de Cobrança — Nível 1</h2>
          <p style="color:#aac4e0;margin:6px 0 0;font-size:12px;">SAGA Grupo — Equipe de Infraestrutura</p>
        </div>
        <div style="padding:20px;background:#fff;">
          <div style="background:#f9f9f9;border-left:4px solid #1565c0;padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:20px;">
            <strong>Nível 1 de 4</strong> — Checklist Pendente — Ação Necessária
            <span style="float:right;font-size:11px;color:#999;">E-MAIL DE TESTE</span>
          </div>
          <p>Este é o <strong>E-mail 1 de 2</strong> do teste de threading.</p>
          <p>Enviado em: <strong>${new Date().toLocaleString('pt-BR')}</strong></p>
          <p>O próximo e-mail (Nível 2) deve chegar em <strong>10 segundos</strong> e aparecer como <strong>resposta a este e-mail</strong> no Outlook.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">⚠️ ESTE É UM E-MAIL DE TESTE. Pode ignorar.</p>
        </div>
      </div>
    `,
  });

  const messageId1 = info1.messageId;
  console.log(`  ✅ Nível 1 enviado! Message-ID: ${messageId1}`);

  // ── Aguarda 10 segundos ─────────────────────────────────────────────────────
  console.log('\n⏳ Aguardando 10 segundos antes de enviar o Nível 2...\n');
  await sleep(10000);

  // ── E-mail 2: Nível 2 (deve aparecer como resposta ao E-mail 1) ─────────────
  console.log(`📤 Enviando E-mail 2 (Nível 2 - Diretor) como RESPOSTA ao E-mail 1...`);
  console.log(`📧 Nível 2 → Para: ${TO_DIR} | CC: ${TO}, ${CC_FIXO}`);
  const info2 = await transporter.sendMail({
    from:    FROM,
    to:      TO_DIR,
    cc:      `${TO}, ${CC_FIXO}`,
    subject: `Re: ${SUBJECT}`,
    headers: {
      'In-Reply-To': messageId1,
      'References':  messageId1,
    },
    html: `
      <div style="font-family:Arial,sans-serif;max-width:650px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <div style="background:#003366;padding:20px;text-align:center;">
          <h2 style="color:#fff;margin:0;">⚠️ [TESTE] Régua de Cobrança — Nível 2</h2>
          <p style="color:#aac4e0;margin:6px 0 0;font-size:12px;">SAGA Grupo — Equipe de Infraestrutura</p>
        </div>
        <div style="padding:20px;background:#fff;">
          <div style="background:#fff8e1;border-left:4px solid #f57c00;padding:12px 16px;border-radius:0 4px 4px 0;margin-bottom:20px;">
            <strong>Nível 2 de 4</strong> — 1ª Cobrança Formal
            <span style="float:right;font-size:11px;color:#999;">E-MAIL DE TESTE</span>
          </div>
          <p>Este é o <strong>E-mail 2 de 2</strong> do teste de threading.</p>
          <p>Enviado em: <strong>${new Date().toLocaleString('pt-BR')}</strong></p>
          <p>Se o threading funcionar corretamente no seu Outlook, <strong>este e-mail deve aparecer como resposta ao E-mail 1</strong>, formando uma conversa/thread.</p>
          <hr/>
          <p style="color:#888;font-size:12px;">⚠️ ESTE É UM E-MAIL DE TESTE. Pode ignorar.</p>
        </div>
      </div>
    `,
  });

  console.log(`  ✅ Nível 2 enviado! Message-ID: ${info2.messageId}`);

  console.log('\n══════════════════════════════════════════════');
  console.log('✅ TESTE CONCLUÍDO!');
  console.log('📬 Verifique sua caixa de entrada agora.');
  console.log('   Os 2 e-mails devem aparecer agrupados no mesmo thread.');
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
