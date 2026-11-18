// FarmaUBS - Dados compartilhados entre Dispensação, Recebimento, Estoque e Inventário (js/estoque-store.js)
// Única fonte de verdade (localStorage): estoque, recebimentos, dispensações e histórico de inventários.
// Os dados de demonstração (setembro e outubro/2026) são gerados de forma determinística e consistente:
//   - Saldo atual = estoque inicial + recebimentos - dispensações ± ajustes do inventário de 28/09.
//   - Entradas de setembro e outubro possuem lotes diferentes e validades diferentes.
//   - Validades distribuídas: algumas < 90 dias a contar de hoje (23/10/2026), outras < 180 dias e outras > 180 dias.
//   - Regra sanitária: se um medicamento está dividido em múltiplos lotes, o alerta de Estoque Baixo ou Crítico
//     é calculado estritamente pela SOMA dos estoques de todos os seus lotes.
//   - Nenhum saldo de estoque jamais assume valor negativo (Math.max(0, ...)).

const FarmaStore = (() => {
  const KEY = {
    catalog: 'farmaubs_catalogo_estoque_v4',
    receivings: 'farmaubs_recebimentos_v4',
    dispensations: 'farmaubs_ultimas_dispensas_v4',
    history: 'farmaubs_inventario_historico_v4',
    session: 'farmaubs_inventario_v4'
  };

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ---------- Utilitários de data ----------
  const fmtDate = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
  const fmtDateTime = r => `${fmtDate(r.date)} ${r.time || ''}`.trim();
  const today = () => isoOf(new Date());
  const nowTime = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  const inRange = (iso, from, to) => (!from || iso >= from) && (!to || iso <= to);
  const currentCycle = () => {
    const d = new Date();
    return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${MONTHS[d.getMonth()]} / ${d.getFullYear()}` };
  };

  // Dias até a validade a contar de hoje (23/10/2026)
  function daysUntilExpiry(isoOrBr) {
    if (!isoOrBr) return 9999;
    let iso = isoOrBr;
    if (iso.includes('/')) {
      const parts = iso.split('/');
      iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const target = new Date(iso + 'T00:00:00');
    const baseDate = new Date('2026-10-23T00:00:00');
    return Math.round((target - baseDate) / (1000 * 60 * 60 * 24));
  }

  // ---------- Persistência ----------
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Erro ao salvar dados:', e);
    }
  }

  function read(key) {
    if (!localStorage.getItem(KEY.catalog)) seed();
    try {
      const data = JSON.parse(localStorage.getItem(key)) || [];
      // Salvaguarda absoluta contra estoques negativos
      if (key === KEY.catalog && Array.isArray(data)) {
        data.forEach(item => {
          item.stock = Math.max(0, Number(item.stock) || 0);
        });
      }
      return data;
    } catch (e) {
      console.error('Erro ao ler dados:', e);
      return [];
    }
  }

  function seed() {
    const demo = buildDemo();
    write(KEY.catalog, demo.catalog);
    write(KEY.receivings, demo.receivings);
    write(KEY.dispensations, demo.dispensations);
    write(KEY.history, demo.history);
  }

  /** Apaga tudo e recria os dados de demonstração */
  function resetAll() {
    Object.values(KEY).forEach(k => localStorage.removeItem(k));
    seed();
  }

  /**
   * Ajusta o saldo de um item (lote específico ou medicamento);
   * garante estritamente que saldo nunca fique negativo.
   */
  function adjust(id, delta, { batch, expiryDate } = {}) {
    const list = read(KEY.catalog);
    let med = list.find(m => m.id === id);
    if (!med) {
      // Se não achou pelo ID exato do lote, tenta pelo medId associado
      const lots = list.filter(m => (m.medId || m.id) === id);
      med = lots.find(m => m.stock > 0) || lots[0];
    }
    if (!med) return null;
    med.stock = Math.max(0, (Number(med.stock) || 0) + delta);
    if (batch) med.batch = batch;
    if (expiryDate) {
      med.expiryDate = expiryDate;
      med.expiry = fmtDate(expiryDate);
    }
    write(KEY.catalog, list);
    return med;
  }

  // ---------- Geração dos dados de demonstração ----------
  const PHARMACIST = 'Dr. Carlos Eduardo (CRF/PI 4821)';
  const FIRST_RECEIVING = '2026-09-09';
  const INVENTORY_DAY = '2026-09-28';
  const SECOND_RECEIVING = '2026-10-05';
  const LAST_DAY = '2026-10-23';
  const HOLIDAYS = ['2026-09-07', '2026-10-12'];

  // Definição dos 8 medicamentos com lotes e validades distintos:
  // - lot1: recebido em 09/09/2026
  // - lot2: recebido em 05/10/2026 (lote diferente e validade diferente)
  // - Validades distribuídas conforme solicitado:
  //   * < 90 dias (a contar de 23/10/2026): Amoxicilina (79d), Losartana (53d), Ibuprofeno (38d), Omeprazol (84d)
  //   * < 180 dias: Paracetamol (159d), Dipirona (128d), Glibenclamida (153d), Sinvastatina (164d), Losartana L2 (169d), Omeprazol L2 (174d)
  //   * > 180 dias: Paracetamol L2 (494d), Amoxicilina L2 (342d), Dipirona L2 (555d), Ibuprofeno L2 (494d), Sinvastatina L2 (616d)
  const MEDS = [
    {
      id: 'inv_1', name: 'Paracetamol', dosage: '500 mg', form: 'Comprimido', category: 'Analgésico', unit: 'unid.', minStock: 60, step: 50, weight: 5, target: 250, qty: [20, 30],
      manufacturer: 'EMS / Farmacêutica SUS', location: 'Prateleira A1 - Armário Central', posology: ['1 cp de 8/8h por 5 dias', '1 cp de 6/6h em caso de dor ou febre'],
      lot1: { batch: 'LT-2026A9', expiryDate: '2027-03-31', stock: 50, recQty: 250 },  // 159 dias (< 180d)
      lot2: { batch: 'LT-2027A2', expiryDate: '2028-02-29', stock: 200, recQty: 200 }  // 494 dias (> 180d)
    },
    {
      id: 'inv_2', name: 'Amoxicilina', dosage: '500 mg', form: 'Cápsula', category: 'Antibiótico', unit: 'unid.', minStock: 50, step: 50, weight: 3, target: 160, qty: [21, 21, 30],
      manufacturer: 'Medley Genéricos', location: 'Prateleira B3 - Antibióticos', posology: ['1 cap de 8/8h por 7 dias', '1 cap de 8/8h por 10 dias'],
      lot1: { batch: 'LT-2026F6', expiryDate: '2027-01-10', stock: 30, recQty: 150 },  // 79 dias (< 90d)
      lot2: { batch: 'LT-2027F2', expiryDate: '2027-09-30', stock: 130, recQty: 150 } // 342 dias (> 180d)
    },
    {
      id: 'inv_3', name: 'Losartana Potássica', dosage: '50 mg', form: 'Comprimido', category: 'Anti-hipertensivo', unit: 'unid.', minStock: 40, step: 50, weight: 5, target: 170, qty: [30, 60],
      manufacturer: 'Eurofarma', location: 'Prateleira C2 - Hipertensão/Diabetes', posology: ['1 cp pela manhã em jejum contínuo', '1 cp de 12/12h uso contínuo'],
      lot1: { batch: 'LT-2026C9', expiryDate: '2026-12-15', stock: 35, recQty: 500 },  // 53 dias (< 90d)
      lot2: { batch: 'LT-2027C3', expiryDate: '2027-04-10', stock: 135, recQty: 500 } // 169 dias (< 180d)
    },
    {
      id: 'inv_4', name: 'Dipirona Sódica', dosage: '500 mg/ml', form: 'Solução Oral / Gotas', category: 'Analgésico', unit: 'frascos', minStock: 30, step: 5, weight: 3, target: 70, qty: [1, 1, 2],
      manufacturer: 'Neo Química', location: 'Prateleira A2 - Líquidos/Soluções', posology: ['30 gotas em caso de dor ou febre', '40 gotas de 6/6h se necessário'],
      lot1: { batch: 'LT-2027B2', expiryDate: '2027-02-28', stock: 20, recQty: 10 },   // 128 dias (< 180d)
      lot2: { batch: 'LT-2027B8', expiryDate: '2028-04-30', stock: 50, recQty: 5 }     // 555 dias (> 180d)
    },
    {
      id: 'inv_5', name: 'Ibuprofeno', dosage: '600 mg', form: 'Comprimido', category: 'Anti-inflamatório', unit: 'unid.', minStock: 40, step: 50, weight: 3, target: 110, qty: [15, 20],
      manufacturer: 'Aché Laboratórios', location: 'Prateleira A3 - Anti-inflamatórios', posology: ['1 cp de 8/8h por 5 dias', '1 cp de 12/12h após as refeições'],
      lot1: { batch: 'LT-2026M8', expiryDate: '2026-11-30', stock: 25, recQty: 50 },   // 38 dias (< 90d)
      lot2: { batch: 'LT-2027M4', expiryDate: '2028-02-29', stock: 85, recQty: 50 }   // 494 dias (> 180d)
    },
    {
      id: 'inv_6', name: 'Glibenclamida', dosage: '5 mg', form: 'Comprimido', category: 'Hipoglicemiante', unit: 'unid.', minStock: 50, step: 50, weight: 3, target: 35, qty: [30, 60],
      manufacturer: 'Prati-Donaduzzi', location: 'Prateleira C1 - Hipertensão/Diabetes', posology: ['1 cp antes do café da manhã', '1 cp de 12/12h antes das refeições'],
      lot1: { batch: 'LT-2027K3', expiryDate: '2027-03-25', stock: 35, recQty: 150 },  // 153 dias (< 180d) - total 35 <= minStock 50 (BAIXO)
      lot2: { batch: 'LT-2027K9', expiryDate: '2028-05-31', stock: 0, recQty: 150 }   // recebido no mês, já dispensado / saldo 0
    },
    {
      id: 'inv_7', name: 'Omeprazol', dosage: '20 mg', form: 'Cápsula', category: 'Gástrico', unit: 'unid.', minStock: 30, step: 50, weight: 3, target: 200, qty: [28, 30],
      manufacturer: 'Germed Farmacêutica', location: 'Prateleira D1 - Gástricos', posology: ['1 cap em jejum por 30 dias', '1 cap 30 minutos antes do café'],
      lot1: { batch: 'LT-2026X5', expiryDate: '2027-01-15', stock: 40, recQty: 250 },  // 84 dias (< 90d)
      lot2: { batch: 'LT-2027X2', expiryDate: '2027-04-15', stock: 160, recQty: 200 } // 174 dias (< 180d)
    },
    {
      id: 'inv_8', name: 'Sinvastatina', dosage: '20 mg', form: 'Comprimido', category: 'Anti-hipertensivo', unit: 'unid.', minStock: 40, step: 50, weight: 3, target: 370, qty: [30, 60],
      manufacturer: 'Sandoz do Brasil', location: 'Prateleira C3 - Hipertensão/Diabetes', posology: ['1 cp à noite uso contínuo', '1 cp à noite após o jantar'],
      lot1: { batch: 'LT-2027S4', expiryDate: '2027-04-05', stock: 70, recQty: 450 },  // 164 dias (< 180d)
      lot2: { batch: 'LT-2027S9', expiryDate: '2028-06-30', stock: 300, recQty: 450 } // 616 dias (> 180d)
    }
  ];

  // Divergências do inventário homologado de 28/09
  const DIVERGENCES = {
    inv_2: { value: -2, reason: 'Avaria / Frasco Quebrado', notes: '2 cápsulas danificadas com umidade na caixa.' },
    inv_4: { value: 3, reason: 'Sobra Não Registrada', notes: 'Identificados 3 frascos excedentes da última remessa CAF.' },
    inv_7: { value: -4, reason: 'Validade Vencida (Descarte)', notes: 'Descarte de 4 cápsulas com validade expirada.' }
  };

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildDemo() {
    const rand = rng(2026);
    const int = n => Math.floor(rand() * n);
    const medName = m => `${m.name} ${m.dosage}`;

    // Dias úteis de 01/09 a 23/10
    const days = [];
    for (let d = new Date(2026, 8, 1); isoOf(d) <= LAST_DAY; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6 && !HOLIDAYS.includes(isoOf(d))) days.push(isoOf(d));
    }

    // 1. Dispensações determinísticas em setembro e outubro
    const pool = MEDS.flatMap(m => Array(m.weight).fill(m));
    const dispensations = [];
    let recipeSeq = 0;

    days.forEach(date => {
      const isOctober = date >= '2026-10-01';
      const recipes = 1 + (rand() < 0.6 ? 1 : 0);
      for (let r = 0; r < recipes; r++) {
        const time = `${pad(8 + int(8))}:${pad(int(60))}`;
        const count = 1 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.15 ? 1 : 0);
        const chosen = new Set();
        while (chosen.size < count) chosen.add(pool[int(pool.length)]);
        const doc = rand() < 0.7 ? `${700 + int(100)} ${1000 + int(9000)} ${1000 + int(9000)} ${1000 + int(9000)}` : '';
        recipeSeq++;

        chosen.forEach(m => {
          // Em setembro usa lot1; em outubro consome lot1 ou lot2
          const targetLot = (!isOctober || rand() < 0.4) ? m.lot1 : m.lot2;
          dispensations.push({
            id: `disp_${recipeSeq}_${m.id}`,
            recipeId: `rx_${recipeSeq}`,
            medId: m.id,
            medicine: medName(m),
            form: m.form,
            batch: targetLot.batch,
            expiry: fmtDate(targetLot.expiryDate),
            quantity: m.qty[int(m.qty.length)],
            unit: m.unit,
            patientDoc: doc,
            posology: m.posology[int(m.posology.length)],
            date,
            time
          });
        });
      }
    });
    dispensations.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    // 2. Recebimentos: 09/09 usa lot1 e 05/10 usa lot2 (lotes e validades diferentes)
    const receivings = [];
    MEDS.forEach((m, i) => {
      // 09/09/2026 com Lote 1
      receivings.push({
        id: `rec_2026-09-09_${m.id}`,
        medId: m.id,
        medicine: medName(m),
        form: m.form,
        batch: m.lot1.batch,
        expiry: fmtDate(m.lot1.expiryDate),
        expiryDate: m.lot1.expiryDate,
        quantity: m.lot1.recQty,
        unit: m.unit,
        invoiceNumber: `GUIA-CAF-2026/${String(100 + i).padStart(3, '0')}`,
        supplierOrigin: 'CAF Central - SMS Parnaíba',
        notes: 'Remessa regular de setembro • Lote conferido',
        date: FIRST_RECEIVING,
        time: '07:50'
      });

      // 05/10/2026 com Lote 2
      receivings.push({
        id: `rec_2026-10-05_${m.id}`,
        medId: m.id,
        medicine: medName(m),
        form: m.form,
        batch: m.lot2.batch,
        expiry: fmtDate(m.lot2.expiryDate),
        expiryDate: m.lot2.expiryDate,
        quantity: m.lot2.recQty,
        unit: m.unit,
        invoiceNumber: `GUIA-CAF-2026/${String(130 + i).padStart(3, '0')}`,
        supplierOrigin: 'CAF Central - SMS Parnaíba',
        notes: 'Remessa regular de outubro • Novo lote de fábrica',
        date: SECOND_RECEIVING,
        time: '08:15'
      });
    });
    receivings.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    // 3. Catálogo de Estoque Atual:
    // Medicamentos divididos em lotes para controle PEPS / FEFO:
    // Cada lote é registrado com seu saldo físico estritamente positivo (>= 0).
    const catalog = [];
    MEDS.forEach(m => {
      // Lote 1 (remanescente com validade mais próxima)
      if (m.lot1 && m.lot1.stock > 0) {
        catalog.push({
          id: `${m.id}_l1`,
          medId: m.id,
          name: m.name,
          dosage: m.dosage,
          form: m.form,
          category: m.category,
          batch: m.lot1.batch,
          expiry: fmtDate(m.lot1.expiryDate),
          expiryDate: m.lot1.expiryDate,
          stock: Math.max(0, m.lot1.stock),
          minStock: m.minStock,
          unit: m.unit,
          manufacturer: m.manufacturer,
          location: m.location
        });
      }

      // Lote 2 (remessa recente)
      if (m.lot2 && m.lot2.stock > 0) {
        catalog.push({
          id: m.id,
          medId: m.id,
          name: m.name,
          dosage: m.dosage,
          form: m.form,
          category: m.category,
          batch: m.lot2.batch,
          expiry: fmtDate(m.lot2.expiryDate),
          expiryDate: m.lot2.expiryDate,
          stock: Math.max(0, m.lot2.stock),
          minStock: m.minStock,
          unit: m.unit,
          manufacturer: m.manufacturer,
          location: m.location
        });
      } else if (!m.lot2 || m.lot2.stock === 0) {
        // Se não possui lote 2 ou saldo zero, mantém o lote 1 como o ID principal
        const existing = catalog.find(c => c.id === `${m.id}_l1`);
        if (existing) {
          existing.id = m.id;
        }
      }
    });

    // 4. Histórico de Inventário Fechado em 28/09/2026 (Consistente com a época)
    const snapshotItems = [
      { medId: 'inv_1', name: 'Paracetamol', dosage: '500 mg', form: 'Comprimido', batch: 'LT-2026A9', expiry: '31/03/2027', unit: 'unid.', system: 170, physical: 170, divergence: 0, reason: '', notes: 'Estoque batendo com o livro de registros.' },
      { medId: 'inv_2', name: 'Amoxicilina', dosage: '500 mg', form: 'Cápsula', batch: 'LT-2026F6', expiry: '10/01/2027', unit: 'unid.', system: 126, physical: 124, divergence: -2, reason: 'Avaria / Frasco Quebrado', notes: '2 cápsulas com umidade na embalagem externa.' },
      { medId: 'inv_3', name: 'Losartana Potássica', dosage: '50 mg', form: 'Comprimido', batch: 'LT-2026C9', expiry: '15/12/2026', unit: 'unid.', system: 180, physical: 180, divergence: 0, reason: '', notes: 'Contagem física conferida na prateleira C2.' },
      { medId: 'inv_4', name: 'Dipirona Sódica', dosage: '500 mg/ml', form: 'Solução Oral / Gotas', batch: 'LT-2027B2', expiry: '28/02/2027', unit: 'frascos', system: 63, physical: 66, divergence: 3, reason: 'Sobra Não Registrada', notes: '3 frascos excedentes apurados.' },
      { medId: 'inv_5', name: 'Ibuprofeno', dosage: '600 mg', form: 'Comprimido', batch: 'LT-2026M8', expiry: '30/11/2026', unit: 'unid.', system: 80, physical: 80, divergence: 0, reason: '', notes: 'Conferido com auxiliar de farmácia.' },
      { medId: 'inv_6', name: 'Glibenclamida', dosage: '5 mg', form: 'Comprimido', batch: 'LT-2027K3', expiry: '25/03/2027', unit: 'unid.', system: 130, physical: 130, divergence: 0, reason: '', notes: 'Contagem 100% conforme.' },
      { medId: 'inv_7', name: 'Omeprazol', dosage: '20 mg', form: 'Cápsula', batch: 'LT-2026X5', expiry: '15/01/2027', unit: 'unid.', system: 72, physical: 68, divergence: -4, reason: 'Validade Vencida (Descarte)', notes: 'Descarte sanitário formal de 4 cápsulas.' },
      { medId: 'inv_8', name: 'Sinvastatina', dosage: '20 mg', form: 'Comprimido', batch: 'LT-2027S4', expiry: '05/04/2027', unit: 'unid.', system: 340, physical: 340, divergence: 0, reason: '', notes: 'Contagem exata.' }
    ];

    return {
      catalog,
      receivings: receivings.reverse(),
      dispensations: dispensations.reverse(),
      history: [{
        id: 'hist_2026-09',
        cycleKey: '2026-09',
        cycle: 'Setembro / 2026',
        homologatedAt: `${INVENTORY_DAY}T16:45`,
        pharmacist: PHARMACIST,
        editedAt: null,
        edits: [],
        items: snapshotItems
      }]
    };
  }

  return {
    keys: KEY,
    load: () => read(KEY.catalog),
    save: list => {
      if (Array.isArray(list)) {
        list.forEach(m => {
          m.stock = Math.max(0, Number(m.stock) || 0);
        });
      }
      write(KEY.catalog, list);
    },
    adjust,
    resetAll,
    loadReceivings: () => read(KEY.receivings),
    saveReceivings: list => write(KEY.receivings, list),
    loadDispensations: () => read(KEY.dispensations),
    saveDispensations: list => write(KEY.dispensations, list),
    loadHistory: () => read(KEY.history),
    saveHistory: list => write(KEY.history, list),
    daysUntilExpiry,
    fmtDate,
    fmtDateTime,
    today,
    nowTime,
    inRange,
    currentCycle
  };
})();
