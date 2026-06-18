import { ChecklistData, Photo } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Helpers gerais ───────────────────────────────────────────────────────────

const formatDate = (isoString: string) => new Date(isoString).toLocaleString('pt-BR');
const boolToText = (val: boolean) => (val ? 'Sim' : 'Não');

/**
 * Converte um objeto Photo para um dataURL base64 válido para embed em PDF/DOCX.
 * Suporta: previewUrl (data: ou blob:), campo base64, e campo url.
 */
const getImageDataUrl = async (photo: Photo): Promise<string | null> => {
  const src = (photo as any).previewUrl || (photo as any).base64 || (photo as any).url;
  if (!src || typeof src !== 'string') return null;

  // Já é dataURL
  if (src.startsWith('data:')) return src;

  // Blob URL → converter para base64
  if (src.startsWith('blob:')) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Base64 puro sem prefixo
  if (src.length > 100) return `data:image/jpeg;base64,${src}`;

  return null;
};

export const getConclusion = (data: ChecklistData): string => {
  const visitDate = new Date(data.visitDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const technicianName = data.technicianName || 'Técnico';

  // ─── Cabeçalho do e-mail ────────────────────────────────────────────────────
  let text = `Prezados,\n\n`;
  text += `O checklist foi realizado no ${data.locationName} pelo departamento Field TI, na data de ${visitDate}. `;
  text += `Durante a visita, foi analisada toda a infraestrutura de rede cabeada, Wi-Fi e computadores.\n\n`;
  text += `Pontos identificados:\n\n`;

  // ─── Rede Cabeada ───────────────────────────────────────────────────────────
  text += `Rede cabeada:\n`;
  const hasNetworkProblems = !data.networkPointsOk && data.problematicNetworkPoints && data.problematicNetworkPoints.length > 0;

  if (data.cableCondition === 'Desorganizado') {
    text += `O cabeamento estruturado encontra-se desorganizado, necessitando de intervenção urgente de organização.\n`;
  } else if (data.cableCondition === 'Parcial') {
    text += `Foram identificados pontos de rede necessitando adequação ao padrão.\n`;
  } else if (hasNetworkProblems) {
    text += `Foram identificados pontos de rede fora do padrão necessitando adequação.\n`;
  } else {
    text += `O cabeamento estruturado encontra-se organizado e dentro do padrão.\n`;
  }

  // Pontos de rede com defeito
  if (hasNetworkProblems) {
    data.problematicNetworkPoints.forEach((np) => {
      text += `- ${np.location}${np.description ? `: ${np.description}` : ''}.\n`;
    });
  }
  text += `\n`;

  // ─── Wi-Fi ──────────────────────────────────────────────────────────────────
  text += `Wi-Fi:\n`;
  const hasAntennaFault = data.antennas.some(a => !a.isWorking);
  if (hasAntennaFault) {
    const faultyAntennas = data.antennas.filter(a => !a.isWorking);
    text += `Foram identificadas falhas em antenas Wi-Fi:\n`;
    faultyAntennas.forEach(a => {
      text += `- ${a.brand || 'Antena'}${a.location ? ` (${a.location})` : ''}: inoperante.\n`;
    });
  } else if (data.antennas.length > 0) {
    text += `O sinal Wi-Fi encontra-se propício nas dependências do local.\n`;
  } else {
    text += `Nenhuma antena Wi-Fi registrada no local.\n`;
  }
  text += `\n`;

  // ─── Equipamentos ───────────────────────────────────────────────────────────
  text += `Equipamentos:\n`;
  if (!data.allMachinesOk && data.problematicMachines && data.problematicMachines.length > 0) {
    data.problematicMachines.forEach((pm) => {
      const id = pm.identifier ? `${pm.identifier} – ` : '';
      const proc = pm.processorGen ? ` (${pm.processorGen})` : '';
      const os = !pm.osUpdated ? ` | Sem Windows 11` : '';
      const desc = pm.problemDescription ? `${pm.problemDescription}` : 'Anomalia identificada';
      text += `- ${id}${desc}${proc}${os}.\n`;
    });
  } else {
    text += `Todos os equipamentos analisados encontram-se em plenas condições operacionais.\n`;
  }
  text += `\n`;

  // ─── Observações gerais ──────────────────────────────────────────────────────
  if (data.observations) {
    text += `Observações gerais:\n${data.observations}\n\n`;
  }

  // ─── Rodapé ─────────────────────────────────────────────────────────────────
  text += `Fico à disposição para esclarecimentos e alinhamento das tratativas necessárias.\n\n`;
  text += `Atenciosamente,\n`;
  text += `${technicianName}\n`;
  text += `TI – Field GO`;

  return text;
};

// ─── TXT Export ───────────────────────────────────────────────────────────────

export const downloadTXT = (data: ChecklistData) => {
  let text = `================================================================\n`;
  text += `           RELATÓRIO DE CHECKLIST - INFRAESTRUTURA DE TI        \n`;
  text += `================================================================\n\n`;

  text += `DADOS DA VISITA\n`;
  text += `----------------------------------------------------------------\n`;
  text += `Local:                 ${data.locationName}\n`;
  text += `Data e Hora:           ${formatDate(data.visitDate)}\n`;
  text += `Responsável Local:     ${data.responsibleName || 'Não informado'}\n`;
  text += `Técnico Responsável:   ${data.technicianName}\n\n`;

  text += `1. CPD / INFRAESTRUTURA DE REDE\n`;
  text += `----------------------------------------------------------------\n`;
  text += `[ Cabos ]\n`;
  text += `  - Organização: ${data.cableCondition}\n`;
  text += `  - Observações: ${data.cableNotes || 'Nenhuma'}\n`;
  if (data.cpdPhotos?.length > 0) {
    text += `  - Fotos do CPD: ${data.cpdPhotos.length} foto(s) anexada(s) (ver PDF para visualização)\n`;
  }
  text += `\n`;

  text += `[ Switches de Rede ]\n`;
  if (data.switches.length > 0) {
    data.switches.forEach((sw, idx) => {
      text += `  Item ${idx + 1}:\n`;
      text += `    - Quantidade: ${sw.quantity}\n`;
      text += `    - Equipamento: ${sw.brand} ${sw.model}\n`;
      text += `    - Portas: ${sw.ports}\n`;
      text += `    - Condição: ${sw.conditionOk ? 'OK' : 'DEFEITO'}\n`;
      if (sw.notes) text += `    - Obs: ${sw.notes}\n`;
    });
  } else {
    text += `  - Nenhum switch registrado.\n`;
  }
  text += `\n`;

  text += `[ Antenas Wi-Fi ]\n`;
  if (data.antennas.length > 0) {
    data.antennas.forEach((ant, idx) => {
      text += `  Item ${idx + 1}:\n`;
      text += `    - Quantidade: ${ant.quantity}\n`;
      text += `    - Marca: ${ant.brand}\n`;
      text += `    - Funcionando: ${boolToText(ant.isWorking)}\n`;
      if (ant.notes) text += `    - Obs: ${ant.notes}\n`;
    });
  } else {
    text += `  - Nenhuma antena registrada.\n`;
  }
  text += `\n`;

  text += `[ Firewall ]\n`;
  text += `  - Existe Firewall: ${boolToText(data.hasFirewall)}\n`;
  if (data.hasFirewall) {
    text += `  - Marca: ${data.firewallBrand}\n`;
    text += `  - Status: ${data.firewallWorking ? 'Funcionando Normalmente' : 'Apresentando Falhas'}\n`;
    text += `  - Obs: ${data.firewallNotes || '-'}\n`;
  }
  text += `\n`;

  text += `2. ESTAÇÕES DE TRABALHO (MÁQUINAS)\n`;
  text += `----------------------------------------------------------------\n`;
  text += `  - Status Geral: ${data.allMachinesOk ? 'Todas as máquinas estão operacionais.' : 'Foram encontrados problemas.'}\n`;
  if (!data.allMachinesOk) {
    data.problematicMachines.forEach((pm, idx) => {
      text += `\n  [ Máquina com Problema #${idx + 1} ]\n`;
      text += `    - ID: ${pm.identifier}\n`;
      text += `    - Processador: ${pm.processorGen}\n`;
      text += `    - Windows 11 Atualizado: ${boolToText(pm.osUpdated)}\n`;
      text += `    - Descrição do Problema: ${pm.problemDescription}\n`;
      if (pm.photos?.length > 0) {
        text += `    - Fotos: ${pm.photos.length} foto(s) anexada(s) (ver PDF)\n`;
      }
    });
  }
  text += `\n`;

  text += `3. PONTOS DE REDE FÍSICA\n`;
  text += `----------------------------------------------------------------\n`;
  text += `  - Estado dos Pontos: ${data.networkPointsOk ? 'Em perfeito estado' : 'Necessitam reparos'}\n`;
  text += `  - Observações: ${data.networkPointsNotes || 'Nenhuma'}\n\n`;

  text += `4. SATISFAÇÃO DOS USUÁRIOS\n`;
  text += `----------------------------------------------------------------\n`;
  text += `  - Os colaboradores estão satisfeitos? ${boolToText(data.employeesSatisfied)}\n`;
  if (!data.employeesSatisfied) {
    text += `  - Relato de Reclamações: ${data.complaints}\n`;
  }
  text += `\n`;

  text += `5. CONCLUSÃO TÉCNICA\n`;
  text += `----------------------------------------------------------------\n`;
  text += getConclusion(data);
  text += `\n\n`;

  if (data.observations) {
    text += `OBSERVAÇÕES GERAIS\n`;
    text += `----------------------------------------------------------------\n`;
    text += `${data.observations}\n\n`;
  }

  text += `\n\n`;
  text += `___________________________________________________\n`;
  text += `Assinatura do Técnico Responsável: ${data.technicianName}\n\n\n`;
  text += `___________________________________________________\n`;
  text += `[ Espaço para Carimbo ]\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Relatorio_${data.locationName.replace(/\s+/g, '_')}_${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

// ─── DOCX Export ──────────────────────────────────────────────────────────────

export const downloadDOCX = async (data: ChecklistData) => {
  const conclusion = getConclusion(data);

  // Converte fotos para HTML <img>
  const photosToHtml = async (photos: Photo[]): Promise<string> => {
    if (!photos || photos.length === 0) return '';
    const imgTags = await Promise.all(
      photos.map(async (p) => {
        const dataUrl = await getImageDataUrl(p);
        if (!dataUrl) return '';
        return `<img src="${dataUrl}" style="max-width:180px;max-height:140px;margin:4px;border:1px solid #ddd;border-radius:4px;" alt="Foto"/>`;
      })
    );
    const validImgs = imgTags.filter(Boolean);
    if (validImgs.length === 0) return '';
    return `<div style="margin-top:8px;padding:8px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;">
      <p style="font-size:9pt;color:#666;margin:0 0 6px 0;font-weight:bold;">📷 ${validImgs.length} foto(s) anexada(s):</p>
      <div style="display:flex;flex-wrap:wrap;">${validImgs.join('')}</div>
    </div>`;
  };

  // Pré-carrega todas as fotos
  const cpdPhotosHtml = await photosToHtml(data.cpdPhotos || []);
  const machinePhotosHtml = await Promise.all(
    (data.problematicMachines || []).map((pm) => photosToHtml(pm.photos || []))
  );
  const networkPhotosHtml = await Promise.all(
    (data.problematicNetworkPoints || []).map((np) => photosToHtml(np.photos || []))
  );

  const styles = `
    body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h1 { font-size: 18pt; color: #000; margin: 0; text-transform: uppercase; }
    h2 { font-size: 14pt; color: #1f4e79; border-bottom: 1px solid #ccc; margin-top: 25px; padding-bottom: 5px; }
    h3 { font-size: 12pt; font-weight: bold; margin-top: 15px; color: #444; }
    .meta-table { width: 100%; margin-bottom: 20px; }
    .meta-table td { padding: 5px; vertical-align: top; }
    .label { font-weight: bold; color: #555; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    table.data-table th { background-color: #f2f2f2; border: 1px solid #999; padding: 8px; text-align: left; }
    table.data-table td { border: 1px solid #ccc; padding: 8px; }
    .conclusion-box { background-color: #f9f9f9; border: 1px solid #e0e0e0; padding: 15px; margin-top: 10px; }
    .footer { margin-top: 60px; page-break-inside: avoid; }
    .signature-line { border-top: 1px solid #000; width: 60%; margin-top: 50px; padding-top: 5px; }
    .machine-problem { background:#fff8f8; border:1px solid #ffcccc; padding:10px; margin:8px 0; border-radius:4px; }
    .network-problem { background:#fff8f8; border:1px solid #ffcccc; padding:10px; margin:8px 0; border-radius:4px; }
  `;

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Relatório</title>
    <style>${styles}</style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório de Checklist</h1>
        <p style="margin:5px 0 0 0; font-size: 12pt;">Infraestrutura de TI</p>
      </div>

      <table class="meta-table">
        <tr><td width="20%"><span class="label">Local:</span></td><td width="80%"><strong>${data.locationName}</strong></td></tr>
        <tr><td><span class="label">Data/Hora:</span></td><td>${formatDate(data.visitDate)}</td></tr>
        <tr><td><span class="label">Responsável Local:</span></td><td>${data.responsibleName || '-'}</td></tr>
        <tr><td><span class="label">Técnico:</span></td><td>${data.technicianName}</td></tr>
      </table>

      <h2>1. CPD / Infraestrutura</h2>
      <p><span class="label">Organização dos Cabos:</span> ${data.cableCondition}</p>
      ${data.cableNotes ? `<p><em>Obs: ${data.cableNotes}</em></p>` : ''}
      ${cpdPhotosHtml}

      <h3>Switches de Rede</h3>
      ${data.switches.length > 0 ? `
      <table class="data-table">
        <thead><tr><th>Qtd</th><th>Equipamento</th><th>Portas</th><th>Condição</th><th>Observações</th></tr></thead>
        <tbody>
        ${data.switches.map(s => `<tr>
          <td>${s.quantity}</td><td>${s.brand} ${s.model}</td>
          <td>${s.ports}</td><td>${s.conditionOk ? 'OK' : 'Falha'}</td><td>${s.notes || '-'}</td>
        </tr>`).join('')}
        </tbody>
      </table>` : '<p>Nenhum switch registrado.</p>'}

      <h3>Antenas Wi-Fi</h3>
      ${data.antennas.length > 0 ? `
      <table class="data-table">
        <thead><tr><th>Qtd</th><th>Marca</th><th>Local</th><th>Status</th></tr></thead>
        <tbody>
        ${data.antennas.map(a => `<tr>
          <td>${a.quantity}</td><td>${a.brand}</td>
          <td>${a.location || '-'}</td><td>${a.isWorking ? 'Funcionando' : 'Falha'}</td>
        </tr>`).join('')}
        </tbody>
      </table>` : '<p>Nenhuma antena registrada.</p>'}

      <h3>Firewall</h3>
      <p><strong>Existe Firewall?</strong> ${data.hasFirewall ? 'Sim' : 'Não'}</p>
      ${data.hasFirewall ? `
        <ul>
          <li><strong>Marca:</strong> ${data.firewallBrand}</li>
          <li><strong>Status:</strong> ${data.firewallWorking ? 'Operacional' : 'Com Falha'}</li>
          ${data.firewallNotes ? `<li><strong>Obs:</strong> ${data.firewallNotes}</li>` : ''}
        </ul>` : ''}

      <h2>2. Máquinas e Computadores</h2>
      <p><strong>Status Geral:</strong> ${data.allMachinesOk ? 'Todas as máquinas estão em perfeito estado.' : 'Foram identificadas máquinas com problemas.'}</p>
      ${!data.allMachinesOk ? `
        ${data.problematicMachines.map((m, i) => `
        <div class="machine-problem">
          <strong>Máquina #${i + 1}: ${m.identifier}</strong><br/>
          Processador: ${m.processorGen} | Windows 11: ${boolToText(m.osUpdated)}<br/>
          <span style="color:#cc0000">Problema: ${m.problemDescription}</span>
          ${machinePhotosHtml[i] || ''}
        </div>`).join('')}` : ''}

      <h2>3. Pontos de Rede</h2>
      <p><strong>Estado Físico/Funcional:</strong> ${data.networkPointsOk ? 'Bons' : 'Apresentam problemas'}</p>
      <p><em>Obs: ${data.networkPointsNotes || 'Nenhuma observação.'}</em></p>
      ${!data.networkPointsOk ? `
        ${data.problematicNetworkPoints.map((np, i) => `
        <div class="network-problem">
          <strong>Ponto #${i + 1}: ${np.location}</strong><br/>
          <span style="color:#cc0000">${np.description}</span>
          ${networkPhotosHtml[i] || ''}
        </div>`).join('')}` : ''}

      <h2>4. Satisfação dos Usuários</h2>
      <p><strong>Satisfação Geral:</strong> ${data.employeesSatisfied ? 'Sim, satisfeitos.' : 'Não, há reclamações.'}</p>
      ${!data.employeesSatisfied ? `<p style="background-color:#fff0f0; padding:10px; border:1px solid #ffcccc;"><strong>Reclamações:</strong> ${data.complaints}</p>` : ''}

      <h2>5. Conclusão e Observações</h2>
      ${data.observations ? `<p><strong>Observações Gerais:</strong> ${data.observations}</p>` : ''}
      <div class="conclusion-box">
        <h3>Resumo Técnico</h3>
        <p>${conclusion}</p>
      </div>

      <div class="footer">
        <div class="signature-line">
          <strong>${data.technicianName}</strong><br>
          Técnico Responsável
        </div>
        <div style="margin-top:40px; border:1px dashed #ccc; width:200px; height:100px; padding:10px;">
          <br><br>
          <center>[ Espaço para Carimbo ]</center>
        </div>
      </div>
    </body></html>
  `;

  const blob = new Blob([content], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Relatorio_${data.locationName.replace(/\s+/g, '_')}.doc`;
  link.click();
  URL.revokeObjectURL(url);
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

import { SAGA_LOGO_BASE64 } from './logoBase64';

/**
 * Adiciona rodapé paginado em TODAS as páginas do documento.
 * Chamado após o conteúdo completo ser gerado.
 */
const addFooterToAllPages = (doc: jsPDF) => {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Linha separadora do rodapé
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);
    // Texto esquerdo
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('SAGA - TI FIELD  |  InfraCheck BR', 15, pageHeight - 10);
    // Página direita
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
  }
};

export const downloadPDF = async (data: ChecklistData, checklistId?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const checkPageBreak = (needed = 10) => {
    if (y + needed > 270) { doc.addPage(); y = 20; }
  };

  const drawSectionLine = () => {
    doc.setDrawColor(0, 71, 143);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  const drawThinLine = () => {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addTitle = (text: string) => {
    checkPageBreak(18);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text(text, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  const addSubTitle = (text: string) => {
    checkPageBreak(10);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(text, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  const addPair = (label: string, value: string, indent = 0) => {
    checkPageBreak(7);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin + indent, y);
    const labelWidth = doc.getTextWidth(`${label}: `);
    doc.setFont('helvetica', 'normal');
    const valueLines = doc.splitTextToSize(value, contentWidth - indent - labelWidth);
    doc.text(valueLines, margin + indent + labelWidth, y);
    y += valueLines.length * 6;
  };

  const addParagraph = (text: string, indent = 0) => {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5 + 2;
  };

  /**
   * Badge de status colorido
   */
  const addStatusBadge = (text: string, isOk: boolean, x: number, yPos: number) => {
    const badgeColor = isOk ? [34, 197, 94] : [239, 68, 68]; // green or red
    const textColor = [255, 255, 255];
    const badgeWidth = doc.getTextWidth(text) + 8;
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(x, yPos - 4, badgeWidth, 6, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(text, x + 4, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
  };

  /**
   * Grid de fotos no PDF (3 por linha, max 55mm de largura cada).
   */
  const addPhotoGrid = async (photos: Photo[], label: string) => {
    if (!photos || photos.length === 0) return;
    const imgW = 55;
    const imgH = 40;
    const gap = 5;
    const perRow = 3;

    checkPageBreak(15);
    addSubTitle(`Fotos: ${label} (${photos.length} foto(s))`);

    let col = 0;
    let rowY = y;

    for (const photo of photos) {
      const dataUrl = await getImageDataUrl(photo);
      if (!dataUrl) continue;

      const xPos = margin + col * (imgW + gap);

      if (col === 0) {
        checkPageBreak(imgH + 10);
        rowY = y;
      }

      try {
        const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(dataUrl, format, xPos, rowY, imgW, imgH);
        // Caption
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        const caption = doc.splitTextToSize(photo.filename || '', imgW);
        doc.text(caption[0] || '', xPos, rowY + imgH + 3);
        doc.setTextColor(0, 0, 0);
      } catch {
        // foto corrompida — ignorar
      }

      col++;
      if (col >= perRow) {
        col = 0;
        y = rowY + imgH + 10;
      }
    }

    if (col > 0) {
      y = rowY + imgH + 10;
    }
    y += 3;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CABEÇALHO COM LOGO SAGA - TI FIELD
  // ═══════════════════════════════════════════════════════════════════════════

  // Fundo azul escuro do cabeçalho
  doc.setFillColor(0, 41, 82);
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Logo Saga (canto esquerdo)
  try {
    doc.addImage(SAGA_LOGO_BASE64, 'PNG', margin, 5, 28, 14);
  } catch {
    // fallback se logo não carregar
  }

  // Texto "SAGA - TI FIELD"
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 200, 230);
  doc.text('SAGA - TI FIELD', margin + 30, 14);

  // Título principal
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Relatório de Checklist', pageWidth - margin, 14, { align: 'right' });

  // Subtítulo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 230);
  doc.text('Infraestrutura de TI', pageWidth - margin, 21, { align: 'right' });

  // ID do checklist
  if (checklistId) {
    doc.setFontSize(7);
    doc.setTextColor(140, 170, 210);
    doc.text(`ID: ${checklistId}`, pageWidth - margin, 28, { align: 'right' });
  }

  // Linha accent azul clara
  doc.setFillColor(0, 102, 204);
  doc.rect(0, 38, pageWidth, 2, 'F');

  y = 48;

  // ═══════════════════════════════════════════════════════════════════════════
  // BARRA DE METADADOS
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'S');

  const metaY = y + 8;
  const col2X = margin + contentWidth / 2;
  doc.setFontSize(8);

  // Col 1: Local
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('LOCAL', margin + 5, metaY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 41, 82);
  doc.setFontSize(11);
  doc.text(data.locationName, margin + 5, metaY + 6);

  // Col 2: Data
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('DATA', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(formatDate(data.visitDate), col2X, metaY + 6);

  // Row 2: Técnico + Responsável
  const metaY2 = metaY + 14;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('TECNICO', margin + 5, metaY2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(data.technicianName, margin + 5, metaY2 + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RESPONSAVEL LOCAL', col2X, metaY2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(data.responsibleName || 'N/A', col2X, metaY2 + 6);

  y += 36;
  drawSectionLine();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. CPD / INFRAESTRUTURA
  // ═══════════════════════════════════════════════════════════════════════════

  addTitle('1. CPD / Infraestrutura');
  addPair('Organizacao dos Cabos', data.cableCondition);
  if (data.cableNotes) addParagraph(`Obs: ${data.cableNotes}`, 5);
  y += 3;

  // Fotos do CPD
  await addPhotoGrid(data.cpdPhotos || [], 'CPD / Rack');

  // Switches — tabela
  addSubTitle('Switches de Rede');
  if (data.switches.length === 0) {
    addParagraph('Nenhum switch registrado.', 5);
  } else {
    checkPageBreak(20);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Qtd', 'Equipamento', 'Portas', 'Status', 'Obs']],
      body: data.switches.map((sw, i) => [
        (i + 1).toString(),
        sw.quantity.toString(),
        `${sw.brand} ${sw.model}`,
        sw.ports.toString(),
        sw.conditionOk ? 'OK' : 'Defeito',
        sw.notes || '-'
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 4) {
          if (hookData.cell.raw === 'Defeito') {
            hookData.cell.styles.textColor = [220, 50, 50];
            hookData.cell.styles.fontStyle = 'bold';
          } else {
            hookData.cell.styles.textColor = [22, 163, 74];
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  y += 3;

  // Antenas — tabela
  addSubTitle('Antenas Wi-Fi');
  if (data.antennas.length === 0) {
    addParagraph('Nenhuma antena registrada.', 5);
  } else {
    checkPageBreak(20);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Qtd', 'Marca', 'Local', 'Status', 'Obs']],
      body: data.antennas.map((ant, i) => [
        (i + 1).toString(),
        ant.quantity.toString(),
        ant.brand,
        ant.location || '-',
        ant.isWorking ? 'OK' : 'Falha',
        ant.notes || '-'
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 4) {
          if (hookData.cell.raw === 'Falha') {
            hookData.cell.styles.textColor = [220, 50, 50];
            hookData.cell.styles.fontStyle = 'bold';
          } else {
            hookData.cell.styles.textColor = [22, 163, 74];
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }
  y += 3;

  // Firewall
  addSubTitle('Firewall');
  addPair('Existe Firewall?', data.hasFirewall ? 'Sim' : 'Nao');
  if (data.hasFirewall) {
    addPair('Marca', data.firewallBrand, 5);
    addPair('Status', data.firewallWorking ? 'Operacional' : 'Falha', 5);
    if (data.firewallNotes) addParagraph(`Obs: ${data.firewallNotes}`, 5);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MAQUINAS E COMPUTADORES
  // ═══════════════════════════════════════════════════════════════════════════

  y += 5;
  drawThinLine();
  addTitle('2. Maquinas e Computadores');

  checkPageBreak(10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Status Geral:', margin, y);
  const statusText = data.allMachinesOk ? 'TODAS OK' : 'PROBLEMAS ENCONTRADOS';
  addStatusBadge(statusText, data.allMachinesOk, margin + doc.getTextWidth('Status Geral: ') + 3, y);
  y += 8;

  if (!data.allMachinesOk) {
    for (let i = 0; i < data.problematicMachines.length; i++) {
      const pm = data.problematicMachines[i];
      checkPageBreak(30);
      
      // Card da máquina problemática
      doc.setFillColor(255, 248, 248);
      doc.setDrawColor(255, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 41, 82);
      doc.text(`Maquina: ${pm.identifier}`, margin + 4, y + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Processador: ${pm.processorGen}  |  Win11 Atualizado: ${boolToText(pm.osUpdated)}`, margin + 4, y + 12);
      
      doc.setTextColor(200, 0, 0);
      doc.setFont('helvetica', 'bold');
      const probLines = doc.splitTextToSize(`Problema: ${pm.problemDescription}`, contentWidth - 10);
      doc.text(probLines[0] || '', margin + 4, y + 18);
      doc.setTextColor(0, 0, 0);
      
      y += 26;

      // Fotos da máquina
      await addPhotoGrid(pm.photos || [], pm.identifier);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PONTOS DE REDE
  // ═══════════════════════════════════════════════════════════════════════════

  y += 5;
  drawThinLine();
  addTitle('3. Pontos de Rede');

  checkPageBreak(10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado Geral:', margin, y);
  const netStatus = data.networkPointsOk ? 'BONS' : 'COM DEFEITOS';
  addStatusBadge(netStatus, data.networkPointsOk, margin + doc.getTextWidth('Estado Geral: ') + 3, y);
  y += 8;

  if (data.networkPointsNotes) {
    addParagraph(`Observacoes: ${data.networkPointsNotes}`);
  }

  if (!data.networkPointsOk) {
    for (let i = 0; i < data.problematicNetworkPoints.length; i++) {
      const np = data.problematicNetworkPoints[i];
      checkPageBreak(22);
      
      doc.setFillColor(255, 248, 248);
      doc.setDrawColor(255, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 41, 82);
      doc.text(`Ponto: ${np.location}`, margin + 4, y + 6);
      
      doc.setTextColor(200, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Defeito: ${np.description}`, margin + 4, y + 12);
      doc.setTextColor(0, 0, 0);
      
      y += 20;

      // Fotos do ponto de rede
      await addPhotoGrid(np.photos || [], np.location);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SATISFACAO DOS USUARIOS
  // ═══════════════════════════════════════════════════════════════════════════

  y += 5;
  drawThinLine();
  addTitle('4. Satisfacao dos Usuarios');

  checkPageBreak(10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Usuarios Satisfeitos?', margin, y);
  const satStatus = data.employeesSatisfied ? 'SIM' : 'NAO';
  addStatusBadge(satStatus, data.employeesSatisfied, margin + doc.getTextWidth('Usuarios Satisfeitos? ') + 3, y);
  y += 8;

  if (!data.employeesSatisfied) {
    doc.setTextColor(180, 0, 0);
    addParagraph(`Reclamacoes: ${data.complaints}`);
    doc.setTextColor(0, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CONCLUSAO TECNICA
  // ═══════════════════════════════════════════════════════════════════════════

  checkPageBreak(50);
  drawSectionLine();
  addTitle('Conclusao Tecnica');

  const conclusionText = getConclusion(data);
  doc.setFillColor(240, 248, 255);
  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.5);
  const splitConclusion = doc.splitTextToSize(conclusionText, contentWidth - 14);
  const boxHeight = splitConclusion.length * 5 + 14;
  doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'FD');
  
  // Barra lateral azul
  doc.setFillColor(0, 71, 143);
  doc.rect(margin, y, 3, boxHeight, 'F');
  
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(splitConclusion, margin + 8, y);
  y += boxHeight;

  if (data.observations) {
    checkPageBreak(20);
    y += 5;
    addParagraph(`Observacoes Gerais: ${data.observations}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASSINATURA
  // ═══════════════════════════════════════════════════════════════════════════

  checkPageBreak(55);
  y += 20;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 80, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(data.technicianName, margin, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Tecnico Responsavel', margin, y + 10);

  const boxX = pageWidth - margin - 60;
  const boxY = y - 10;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(boxX, boxY, 60, 30, 2, 2, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('Carimbo', boxX + 30, boxY + 15, { align: 'center' });

  // ═══════════════════════════════════════════════════════════════════════════
  // RODAPE em TODAS as páginas
  // ═══════════════════════════════════════════════════════════════════════════
  addFooterToAllPages(doc);

  doc.save(`Relatorio_${data.locationName.replace(/\s+/g, '_')}.pdf`);
};

// ─── PDF de Produtividade ─────────────────────────────────────────────────────

export const downloadProductivityPDF = (reportData: any[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Cabeçalho com logo
  doc.setFillColor(0, 41, 82);
  doc.rect(0, 0, pageWidth, 32, 'F');
  
  try {
    doc.addImage(SAGA_LOGO_BASE64, 'PNG', margin, 5, 28, 14);
  } catch {
    // fallback
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 200, 230);
  doc.text('SAGA - TI FIELD', margin + 30, 14);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Relatorio de Produtividade', pageWidth - margin, 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 230);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth - margin, 22, { align: 'right' });

  doc.setFillColor(0, 102, 204);
  doc.rect(0, 32, pageWidth, 2, 'F');

  const tableColumn = ['Tecnico', 'Lojas Atribuidas', 'Checklists Realizados', 'Conclusao'];
  const tableRows: any[][] = [];

  reportData.forEach((rep) => {
    const ratio = rep.attributed > 0 ? Math.round((rep.completed / rep.attributed) * 100) : 0;
    const statusText = rep.attributed === 0 ? 'N/A' : `${ratio}%`;
    tableRows.push([rep.technician, rep.attributed.toString(), rep.completed.toString(), statusText]);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 42,
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [0, 51, 102], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { fontStyle: 'bold', halign: 'center' }
    },
    margin: { left: margin, right: margin },
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const val = parseInt(hookData.cell.raw || '0');
        if (val >= 100) {
          hookData.cell.styles.textColor = [22, 163, 74];
        } else if (val > 0) {
          hookData.cell.styles.textColor = [234, 179, 8];
        }
      }
    }
  });

  // Rodapé
  addFooterToAllPages(doc);

  doc.save(`Relatorio_Produtividade_${Date.now()}.pdf`);
};

