// FarmaUBS - Relatório imprimível reutilizável (js/relatorio.js)
// Monta um documento oficial (cabeçalho SMS, resumo, tabela e assinaturas) e aciona window.print().

const FarmaReport = (() => {
  const esc = v => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function ensureArea() {
    let area = document.getElementById('farmaReportArea');
    if (area) return area;

    const style = document.createElement('style');
    style.textContent = `
      #farmaReportArea { display: none; }
      @media print {
        body > *:not(#farmaReportArea) { display: none !important; }
        #farmaReportArea { display: block !important; padding: 20px; background: #fff; }
      }`;
    document.head.appendChild(style);

    area = document.createElement('div');
    area.id = 'farmaReportArea';
    document.body.appendChild(area);
    return area;
  }

  const th = (c, i, aligns) => `<th style="padding: 6px 8px; text-align: ${aligns[i] || 'left'};">${esc(c)}</th>`;
  const td = (c, i, aligns) => `<td style="padding: 5px 8px; text-align: ${aligns[i] || 'left'};">${esc(c)}</td>`;

  function table(head, rows, aligns = []) {
    return `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 22px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 1px solid #d1d5db;">${head.map((c, i) => th(c, i, aligns)).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(r => `<tr style="border-bottom: 1px solid #e5e7eb;">${r.map((c, i) => td(c, i, aligns)).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
  }

  /**
   * options: { title, period, filters, summary: [[rótulo, valor]], groups: {title, head, rows, aligns},
   *            detail: {title, head, rows, aligns} }
   */
  function print({ title, period, summary = [], groups, detail }) {
    const area = ensureArea();
    const now = new Date();
    area.innerHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #111827;">
        <div style="border-bottom: 2px solid #001c6d; padding-bottom: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 18px; margin: 0; color: #001c6d; font-weight: bold;">SECRETARIA MUNICIPAL DE SAÚDE DE PARNAÍBA / PI</h2>
            <h3 style="font-size: 14px; margin: 3px 0 0 0; color: #374151;">Sistema FarmaUBS • Módulo de Controle e Gestão Farmacêutica</h3>
            <p style="font-size: 12px; margin: 2px 0 0 0; color: #6b7280;">Unidade: UBS Centro • CNES: 2384910 • Farmácia Básica SUS</p>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 14px; font-weight: bold; background: #e0e7ff; color: #1e1b4b; padding: 4px 10px; border-radius: 4px; display: inline-block;">${esc(title)}</span>
            <p style="font-size: 11px; margin: 4px 0 0 0; color: #6b7280;">Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div><strong>Período:</strong> ${esc(period)}</div>
            ${summary.map(([label, value]) => `<div><strong>${esc(label)}:</strong> ${esc(value)}</div>`).join('')}
          </div>
        </div>

        ${groups ? `<h4 style="font-size: 13px; text-transform: uppercase; margin-bottom: 8px; color: #001c6d;">${esc(groups.title)}</h4>${table(groups.head, groups.rows, groups.aligns)}` : ''}
        ${detail ? `<h4 style="font-size: 13px; text-transform: uppercase; margin-bottom: 8px; color: #001c6d;">${esc(detail.title)}</h4>${table(detail.head, detail.rows, detail.aligns)}` : ''}

        <div style="margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12px;">
          <div style="width: 45%; border-top: 1px solid #111827; padding-top: 6px;">
            <strong>Dr. Carlos Eduardo</strong><br>Farmacêutico Responsável Técnico<br>CRF/PI 4821
          </div>
          <div style="width: 45%; border-top: 1px solid #111827; padding-top: 6px;">
            <strong>Coordenação de Assistência Farmacêutica</strong><br>Secretaria Municipal de Saúde<br>Prefeitura de Parnaíba / PI
          </div>
        </div>

        <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af;">
          Documento gerado automaticamente pelo Sistema FarmaUBS. Em conformidade com as Boas Práticas de Armazenamento e Distribuição da Anvisa (RDC 430/2020) e SUS.
        </div>
      </div>`;
    window.print();
  }

  /** Texto do período a partir dos campos de data (ISO yyyy-mm-dd, opcionais). */
  function periodText(from, to) {
    if (!from && !to) return 'Todo o histórico registrado';
    if (from && to) return `${FarmaStore.fmtDate(from)} a ${FarmaStore.fmtDate(to)}`;
    return from ? `A partir de ${FarmaStore.fmtDate(from)}` : `Até ${FarmaStore.fmtDate(to)}`;
  }

  /** Agrupa registros por medicamento: [medicamento, nº de registros, total de unidades]. */
  function groupByMedicine(list) {
    const map = new Map();
    list.forEach(r => {
      const g = map.get(r.medicine) || { count: 0, units: 0, unit: r.unit || 'unid.' };
      g.count += 1;
      g.units += r.quantity || 0;
      map.set(r.medicine, g);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, g]) => [name, g.count, `${g.units.toLocaleString('pt-BR')} ${g.unit}`]);
  }

  return { print, periodText, groupByMedicine };
})();
