// FarmaUBS - Lógica de Inventário Mensal & Apuração de Divergências (js/inventario.js)

const CATALOG_STORAGE_KEY = 'farmaubs_catalogo_estoque';
const INVENTORY_STORAGE_KEY = 'farmaubs_inventario_dados';

// Catálogo padrão caso ainda não exista no LocalStorage
const DEFAULT_CATALOG = [
  {
    id: 'inv_1',
    name: 'Paracetamol',
    dosage: '500 mg',
    form: 'Comprimido',
    category: 'Analgésico',
    batch: 'LT-2026A1',
    expiry: '30/11/2026',
    expiryDate: '2026-11-30',
    stock: 350,
    minStock: 60,
    unit: 'unid.',
    manufacturer: 'EMS / Farmacêutica SUS',
    location: 'Prateleira A1 - Armário Central'
  },
  {
    id: 'inv_2',
    name: 'Amoxicilina',
    dosage: '500 mg',
    form: 'Cápsula',
    category: 'Antibiótico',
    batch: 'LT-2025F4',
    expiry: '15/04/2027',
    expiryDate: '2027-04-15',
    stock: 180,
    minStock: 50,
    unit: 'unid.',
    manufacturer: 'Medley Genéricos',
    location: 'Prateleira B3 - Antibióticos'
  },
  {
    id: 'inv_3',
    name: 'Losartana Potássica',
    dosage: '50 mg',
    form: 'Comprimido',
    category: 'Anti-hipertensivo',
    batch: 'LT-2026C9',
    expiry: '31/12/2026',
    expiryDate: '2026-12-31',
    stock: 15,
    minStock: 40,
    unit: 'unid.',
    manufacturer: 'Eurofarma',
    location: 'Prateleira C2 - Hipertensão/Diabetes'
  },
  {
    id: 'inv_4',
    name: 'Dipirona Sódica',
    dosage: '500 mg/ml',
    form: 'Solução Oral / Gotas',
    category: 'Analgésico',
    batch: 'LT-2027B2',
    expiry: '20/08/2027',
    expiryDate: '2027-08-20',
    stock: 85,
    minStock: 30,
    unit: 'frascos',
    manufacturer: 'Neo Química',
    location: 'Prateleira A2 - Líquidos/Soluções'
  },
  {
    id: 'inv_5',
    name: 'Ibuprofeno',
    dosage: '600 mg',
    form: 'Comprimido',
    category: 'Anti-inflamatório',
    batch: 'LT-2026M8',
    expiry: '10/10/2026',
    expiryDate: '2026-10-10',
    stock: 120,
    minStock: 40,
    unit: 'unid.',
    manufacturer: 'Aché Laboratórios',
    location: 'Prateleira A3 - Anti-inflamatórios'
  },
  {
    id: 'inv_6',
    name: 'Glibenclamida',
    dosage: '5 mg',
    form: 'Comprimido',
    category: 'Hipoglicemiante',
    batch: 'LT-2027K3',
    expiry: '25/03/2027',
    expiryDate: '2027-03-25',
    stock: 200,
    minStock: 50,
    unit: 'unid.',
    manufacturer: 'Prati-Donaduzzi',
    location: 'Prateleira C1 - Hipertensão/Diabetes'
  },
  {
    id: 'inv_7',
    name: 'Omeprazol',
    dosage: '20 mg',
    form: 'Cápsula',
    category: 'Gástrico',
    batch: 'LT-2026P5',
    expiry: '18/11/2026',
    expiryDate: '2026-11-18',
    stock: 240,
    minStock: 60,
    unit: 'unid.',
    manufacturer: 'Teuto Farmacêutica',
    location: 'Prateleira B1 - Gastrointestinais'
  },
  {
    id: 'inv_8',
    name: 'Atenolol',
    dosage: '50 mg',
    form: 'Comprimido',
    category: 'Anti-hipertensivo',
    batch: 'LT-2026T7',
    expiry: '05/09/2026',
    expiryDate: '2026-09-05',
    stock: 90,
    minStock: 30,
    unit: 'unid.',
    manufacturer: 'EMS Genéricos',
    location: 'Prateleira C3 - Hipertensão/Diabetes'
  }
];

// Estado da Aplicação
let inventorySession = null;
let currentCatalog = [];
let selectedMedicine = null;

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initCatalog();
  initInventorySession();
  setupUIEvents();
  renderAll();
});

// Inicializa o catálogo de estoque
function initCatalog() {
  try {
    const stored = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (stored) {
      currentCatalog = JSON.parse(stored);
    } else {
      currentCatalog = [...DEFAULT_CATALOG];
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(currentCatalog));
    }
  } catch (e) {
    console.error('Erro ao carregar catálogo:', e);
    currentCatalog = [...DEFAULT_CATALOG];
  }
}

// Inicializa a sessão do inventário mensal
function initInventorySession() {
  try {
    const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (stored) {
      inventorySession = JSON.parse(stored);
    } else {
      // Cria sessão inicial com contagens padrão para demonstração interativa
      inventorySession = {
        cycle: 'Setembro / 2026',
        startDate: '01/09/2026',
        status: 'EM_ANDAMENTO', // 'EM_ANDAMENTO' ou 'HOMOLOGADO'
        pharmacist: 'Dr. Carlos Eduardo (CRF/PI 4821)',
        unit: 'SMS Parnaíba - UBS Centro',
        items: [
          {
            medId: 'inv_1',
            physicalCount: 350,
            conferred: true,
            divergence: 0,
            reason: '',
            notes: 'Conferência física 100% conforme.',
            date: '28/09/2026 09:15'
          },
          {
            medId: 'inv_2',
            physicalCount: 178,
            conferred: true,
            divergence: -2,
            reason: 'Avaria / Frasco Quebrado',
            notes: '2 cápsulas danificadas com umidade na caixa.',
            date: '28/09/2026 09:30'
          },
          {
            medId: 'inv_3',
            physicalCount: 15,
            conferred: true,
            divergence: 0,
            reason: '',
            notes: 'Estoque baixo verificado.',
            date: '28/09/2026 09:45'
          },
          {
            medId: 'inv_4',
            physicalCount: 88,
            conferred: true,
            divergence: 3,
            reason: 'Sobra Não Registrada',
            notes: 'Identificados 3 frascos excedentes da última remessa CAF.',
            date: '28/09/2026 10:10'
          },
          {
            medId: 'inv_5',
            physicalCount: 120,
            conferred: true,
            divergence: 0,
            reason: '',
            notes: 'Contagem bate com o livro de registro.',
            date: '28/09/2026 10:25'
          }
          // inv_6, inv_7, inv_8 propositalmente pendentes para o usuário experimentar registrar
        ]
      };
      saveInventorySession();
    }
  } catch (e) {
    console.error('Erro ao carregar sessão de inventário:', e);
    inventorySession = {
      cycle: 'Setembro / 2026',
      startDate: '01/09/2026',
      status: 'EM_ANDAMENTO',
      pharmacist: 'Dr. Carlos Eduardo (CRF/PI 4821)',
      unit: 'SMS Parnaíba - UBS Centro',
      items: []
    };
  }
}

function saveInventorySession() {
  localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventorySession));
}

// ==========================================================================
// RENDERIZAÇÃO GERAL
// ==========================================================================
function renderAll() {
  renderMetrics();
  renderInventoryTable();
}

// Atualiza Métricas Superiores
function renderMetrics() {
  const totalCatalogItems = currentCatalog.length;
  const countedItems = inventorySession.items.filter(i => i.conferred);
  const countedCount = countedItems.length;
  
  // Itens com divergência
  const divergentItems = countedItems.filter(i => i.divergence !== 0);
  const divergenceCount = divergentItems.length;

  // Acurácia (% de itens conferidos sem divergência)
  let accuracy = 100;
  if (countedCount > 0) {
    const correctCount = countedCount - divergenceCount;
    accuracy = Math.round((correctCount / countedCount) * 100);
  }

  // Total de unidades físicas contadas
  const totalPhysicalUnits = countedItems.reduce((acc, curr) => acc + (Number(curr.physicalCount) || 0), 0);

  // Elementos do DOM
  const statCountedRatio = document.getElementById('statCountedRatio');
  const statDivergenceCount = document.getElementById('statDivergenceCount');
  const statAccuracyPercent = document.getElementById('statAccuracyPercent');
  const statTotalPhysicalUnits = document.getElementById('statTotalPhysicalUnits');
  const inventoryStatusBadge = document.getElementById('inventoryStatusBadge');
  const inventoryStatusText = document.getElementById('inventoryStatusText');
  const inventoryCycleText = document.getElementById('inventoryCycleText');

  if (statCountedRatio) statCountedRatio.textContent = `${countedCount} / ${totalCatalogItems}`;
  if (statDivergenceCount) statDivergenceCount.textContent = divergenceCount;
  if (statAccuracyPercent) statAccuracyPercent.textContent = `${accuracy}%`;
  if (statTotalPhysicalUnits) statTotalPhysicalUnits.textContent = totalPhysicalUnits.toLocaleString('pt-BR');
  if (inventoryCycleText) inventoryCycleText.textContent = inventorySession.cycle;

  if (inventoryStatusBadge && inventoryStatusText) {
    if (inventorySession.status === 'HOMOLOGADO') {
      inventoryStatusBadge.className = 'badge-farma-optimal';
      inventoryStatusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">verified</span><span>Homologado / Fechado</span>';
    } else {
      inventoryStatusBadge.className = 'badge-farma-warning';
      inventoryStatusBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 14px;">pending_actions</span><span>Em Andamento</span>';
    }
  }
}

// Renderiza a Tabela de Conciliação
function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTableBody');
  const filter = document.getElementById('tableFilterStatus')?.value || 'ALL';
  const emptyMsg = document.getElementById('emptyInventoryFilterMessage');
  const footerSummary = document.getElementById('footerInventorySummary');

  if (!tbody) return;
  tbody.innerHTML = '';

  // Combina dados do catálogo com contagens registradas
  const rows = currentCatalog.map(med => {
    const countRecord = inventorySession.items.find(i => i.medId === med.id);
    return {
      med,
      countRecord: countRecord || null
    };
  });

  // Filtra as linhas conforme a seleção
  const filteredRows = rows.filter(item => {
    const isConferred = !!item.countRecord?.conferred;
    const divergence = item.countRecord ? item.countRecord.divergence : 0;

    if (filter === 'CONFERRED') return isConferred;
    if (filter === 'PENDING') return !isConferred;
    if (filter === 'DIVERGENT') return isConferred && divergence !== 0;
    return true; // 'ALL'
  });

  if (filteredRows.length === 0) {
    if (emptyMsg) emptyMsg.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhum medicamento encontrado para o filtro ativo.';
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('d-none');

  filteredRows.forEach(({ med, countRecord }) => {
    const tr = document.createElement('tr');

    const systemStock = med.stock;
    const isConferred = !!countRecord?.conferred;
    const physicalCount = isConferred ? countRecord.physicalCount : null;
    const divergence = isConferred ? countRecord.divergence : null;
    const reason = countRecord?.reason || '';
    const notes = countRecord?.notes || '';

    // Coluna 1: Medicamento & Lote
    const colMed = `
      <div>
        <strong class="text-dark d-block" style="font-size: 13px;">${escapeHtml(med.name)} ${escapeHtml(med.dosage)}</strong>
        <div class="d-flex align-items-center gap-1 mt-1 text-muted" style="font-size: 11px;">
          <span class="badge bg-light text-dark border px-1 py-0">${escapeHtml(med.batch)}</span>
          <span>&bull; Val: ${escapeHtml(med.expiry)}</span>
        </div>
      </div>
    `;

    // Coluna 2: Saldo Sistema
    const colSystem = `
      <div class="text-center fw-semibold text-secondary" style="font-size: 13px;">
        ${systemStock} <small class="text-muted" style="font-size: 10px;">${escapeHtml(med.unit || 'unid.')}</small>
      </div>
    `;

    // Coluna 3: Contagem Física
    let colPhysical = '';
    if (isConferred) {
      colPhysical = `
        <div class="text-center fw-bold text-dark" style="font-size: 14px;">
          ${physicalCount} <small class="text-muted" style="font-size: 10px;">${escapeHtml(med.unit || 'unid.')}</small>
        </div>
      `;
    } else {
      colPhysical = `
        <div class="text-center text-muted" style="font-size: 12px;">
          <span class="badge bg-light text-muted border">Não contado</span>
        </div>
      `;
    }

    // Coluna 4: Divergência
    let colDivergence = '';
    if (!isConferred) {
      colDivergence = `<div class="text-center text-muted">-</div>`;
    } else if (divergence === 0) {
      colDivergence = `
        <div class="text-center">
          <span class="badge-divergence-zero">
            <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
            0 (Exato)
          </span>
        </div>
      `;
    } else if (divergence > 0) {
      colDivergence = `
        <div class="text-center">
          <span class="badge-divergence-surplus">
            <span class="material-symbols-outlined" style="font-size: 14px;">add_circle</span>
            +${divergence} (Sobra)
          </span>
        </div>
      `;
    } else {
      colDivergence = `
        <div class="text-center">
          <span class="badge-divergence-deficit">
            <span class="material-symbols-outlined" style="font-size: 14px;">remove_circle</span>
            ${divergence} (Falta)
          </span>
        </div>
      `;
    }

    // Coluna 5: Motivo / Justificativa
    let colReason = '';
    if (isConferred && divergence !== 0) {
      colReason = `
        <div style="font-size: 12px; line-height: 1.3;">
          <strong class="text-dark d-block">${escapeHtml(reason || 'Sem motivo registrado')}</strong>
          ${notes ? `<small class="text-muted d-block text-truncate" style="max-width: 180px;" title="${escapeHtml(notes)}">${escapeHtml(notes)}</small>` : ''}
        </div>
      `;
    } else if (isConferred) {
      colReason = `<span class="text-muted small">Saldo conforme</span>`;
    } else {
      colReason = `<span class="text-muted small">-</span>`;
    }

    // Coluna 6: Status
    let colStatus = '';
    if (isConferred) {
      colStatus = `
        <div class="text-center">
          <span class="badge-status-conferido">
            <span class="material-symbols-outlined" style="font-size: 14px;">verified</span>
            Conferido
          </span>
        </div>
      `;
    } else {
      colStatus = `
        <div class="text-center">
          <span class="badge-status-pendente">
            <span class="material-symbols-outlined" style="font-size: 14px;">schedule</span>
            Pendente
          </span>
        </div>
      `;
    }

    // Coluna 7: Ação (Botão de Contar / Editar)
    const colAction = `
      <div class="text-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary py-0 px-2 btn-select-med-row"
          data-med-id="${med.id}"
          title="${isConferred ? 'Editar contagem' : 'Realizar contagem'}"
          style="font-size: 11px;"
        >
          <span class="material-symbols-outlined align-middle" style="font-size: 14px;">
            ${isConferred ? 'edit' : 'add_task'}
          </span>
          <span>${isConferred ? 'Editar' : 'Contar'}</span>
        </button>
      </div>
    `;

    tr.innerHTML = `
      <td>${colMed}</td>
      <td>${colSystem}</td>
      <td>${colPhysical}</td>
      <td>${colDivergence}</td>
      <td>${colReason}</td>
      <td>${colStatus}</td>
      <td>${colAction}</td>
    `;

    tbody.appendChild(tr);
  });

  // Atualiza sumário do rodapé
  const totalCounted = inventorySession.items.filter(i => i.conferred).length;
  if (footerSummary) {
    footerSummary.textContent = `${totalCounted} de ${currentCatalog.length} medicamentos auditados neste ciclo`;
  }
}

// ==========================================================================
// CONFIGURAÇÃO DE EVENTOS & UI
// ==========================================================================
function setupUIEvents() {
  const medicineInput = document.getElementById('medicineSearchInput');
  const medicineDropdown = document.getElementById('medicineDropdown');
  const btnClearMedSelection = document.getElementById('btnClearMedSelection');
  const physicalCountInput = document.getElementById('physicalCountInput');
  const inventoryCountForm = document.getElementById('inventoryCountForm');
  const btnResetForm = document.getElementById('btnResetForm');
  const tableFilterStatus = document.getElementById('tableFilterStatus');

  // Modal de Homologação
  const btnOpenHomologateModal = document.getElementById('btnOpenHomologateModal');
  const btnCloseHomologateModal = document.getElementById('btnCloseHomologateModal');
  const btnCancelHomologate = document.getElementById('btnCancelHomologate');
  const btnConfirmHomologate = document.getElementById('btnConfirmHomologate');
  const btnPrintAta = document.getElementById('btnPrintAta');

  // Mobile sidebar toggle
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const farmaSidebar = document.getElementById('farmaSidebar');
  if (btnToggleSidebar && farmaSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      farmaSidebar.classList.toggle('show');
    });
  }

  // 1. Busca em tempo real de Medicamento (Combobox)
  if (medicineInput && medicineDropdown) {
    medicineInput.addEventListener('input', () => {
      const query = medicineInput.value.trim().toLowerCase();
      renderMedicineDropdown(query);
    });

    medicineInput.addEventListener('focus', () => {
      const query = medicineInput.value.trim().toLowerCase();
      renderMedicineDropdown(query);
    });

    // Fecha dropdown se clicar fora
    document.addEventListener('click', (e) => {
      if (!medicineInput.contains(e.target) && !medicineDropdown.contains(e.target)) {
        medicineDropdown.classList.add('d-none');
      }
    });
  }

  // Limpar seleção do medicamento
  if (btnClearMedSelection) {
    btnClearMedSelection.addEventListener('click', () => {
      resetCountForm();
    });
  }

  // 2. Cálculo dinâmico de divergência ao digitar a contagem física
  if (physicalCountInput) {
    physicalCountInput.addEventListener('input', () => {
      calculateDivergenceFeedback();
    });
  }

  // 3. Submissão do Formulário de Contagem
  if (inventoryCountForm) {
    inventoryCountForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSaveItemCount();
    });
  }

  // Botão Limpar Formulário
  if (btnResetForm) {
    btnResetForm.addEventListener('click', () => {
      resetCountForm();
    });
  }

  // 4. Delegação de Clique na Tabela para botão "Contar / Editar"
  const tbody = document.getElementById('inventoryTableBody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.btn-select-med-row');
      if (targetBtn) {
        const medId = targetBtn.getAttribute('data-med-id');
        selectMedicineById(medId);
      }
    });
  }

  // 5. Filtro da Tabela
  if (tableFilterStatus) {
    tableFilterStatus.addEventListener('change', () => {
      renderInventoryTable();
    });
  }

  // 6. Modal de Homologação
  if (btnOpenHomologateModal) {
    btnOpenHomologateModal.addEventListener('click', openHomologateModal);
  }
  if (btnCloseHomologateModal) {
    btnCloseHomologateModal.addEventListener('click', closeHomologateModal);
  }
  if (btnCancelHomologate) {
    btnCancelHomologate.addEventListener('click', closeHomologateModal);
  }
  if (btnConfirmHomologate) {
    btnConfirmHomologate.addEventListener('click', handleConfirmHomologation);
  }

  // 7. Impressão da Ata
  if (btnPrintAta) {
    btnPrintAta.addEventListener('click', handlePrintAta);
  }
}

// Renderiza o menu suspenso de medicamentos na busca
function renderMedicineDropdown(query) {
  const dropdown = document.getElementById('medicineDropdown');
  if (!dropdown) return;

  const matches = currentCatalog.filter(m => {
    if (!query) return true;
    const nameMatch = m.name.toLowerCase().includes(query);
    const batchMatch = m.batch.toLowerCase().includes(query);
    const catMatch = (m.category || '').toLowerCase().includes(query);
    return nameMatch || batchMatch || catMatch;
  });

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="farma-dropdown-empty">
        <span class="material-symbols-outlined mb-1" style="font-size: 20px;">search_off</span><br>
        Nenhum medicamento encontrado para "${escapeHtml(query)}"
      </div>
    `;
    dropdown.classList.remove('d-none');
    return;
  }

  dropdown.innerHTML = '';
  matches.forEach(med => {
    const div = document.createElement('div');
    div.className = 'farma-dropdown-item';

    // Verifica se já foi contado
    const countRecord = inventorySession.items.find(i => i.medId === med.id);
    const countBadge = countRecord?.conferred
      ? `<span class="badge bg-success-subtle text-success border border-success-subtle px-1" style="font-size: 10px;">Auditado (${countRecord.physicalCount})</span>`
      : `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-1" style="font-size: 10px;">Pendente</span>`;

    div.innerHTML = `
      <div class="d-flex flex-column">
        <div class="d-flex align-items-center gap-2">
          <strong class="text-dark" style="font-size: 13px;">${escapeHtml(med.name)} ${escapeHtml(med.dosage)}</strong>
          ${countBadge}
        </div>
        <div class="text-muted" style="font-size: 11px;">
          Lote: <span class="fw-semibold">${escapeHtml(med.batch)}</span> &bull; Val: ${escapeHtml(med.expiry)}
        </div>
      </div>
      <div class="text-end ps-2">
        <span class="badge bg-light text-secondary border" style="font-size: 11px;">
          Saldo: <strong>${med.stock}</strong>
        </span>
      </div>
    `;

    div.addEventListener('click', () => {
      selectMedicine(med);
      dropdown.classList.add('d-none');
    });

    dropdown.appendChild(div);
  });

  dropdown.classList.remove('d-none');
}

// Seleciona o medicamento no formulário
function selectMedicine(med) {
  selectedMedicine = med;

  const searchInput = document.getElementById('medicineSearchInput');
  const selectedIdInput = document.getElementById('selectedMedicineId');
  const detailPanel = document.getElementById('medDetailPanel');
  const displayName = document.getElementById('displayMedName');
  const displayBatch = document.getElementById('displayMedBatch');
  const displayExpiry = document.getElementById('displayMedExpiry');
  const displaySystemStock = document.getElementById('displayMedSystemStock');
  const physicalInput = document.getElementById('physicalCountInput');
  const unitLabel = document.getElementById('unitLabel');
  const btnSave = document.getElementById('btnSaveItemCount');

  if (searchInput) searchInput.value = `${med.name} ${med.dosage} (${med.batch})`;
  if (selectedIdInput) selectedIdInput.value = med.id;

  if (displayName) displayName.textContent = `${med.name} ${med.dosage} (${med.form})`;
  if (displayBatch) displayBatch.textContent = med.batch;
  if (displayExpiry) displayExpiry.textContent = med.expiry;
  if (displaySystemStock) displaySystemStock.textContent = `${med.stock} ${med.unit || 'unid.'}`;
  if (unitLabel) unitLabel.textContent = med.unit || 'unidades';

  if (detailPanel) detailPanel.style.display = 'grid';

  // Habilita campo de contagem
  if (physicalInput) {
    physicalInput.disabled = false;
    physicalInput.value = '';
    physicalInput.focus();
  }
  if (btnSave) btnSave.disabled = false;

  // Se já houver contagem registrada para este item, carrega os dados salvos
  const existingCount = inventorySession.items.find(i => i.medId === med.id);
  const reasonSelect = document.getElementById('divergenceReasonSelect');
  const notesArea = document.getElementById('countNotes');

  if (existingCount && existingCount.conferred) {
    if (physicalInput) physicalInput.value = existingCount.physicalCount;
    if (reasonSelect) reasonSelect.value = existingCount.reason || '';
    if (notesArea) notesArea.value = existingCount.notes || '';
    showToast(`Carregada contagem anterior de ${med.name}: ${existingCount.physicalCount} unidades.`, 'info');
  } else {
    if (reasonSelect) reasonSelect.value = '';
    if (notesArea) notesArea.value = '';
  }

  calculateDivergenceFeedback();
}

function selectMedicineById(medId) {
  const med = currentCatalog.find(m => m.id === medId);
  if (med) {
    selectMedicine(med);
    // Rolagem suave até o formulário no mobile/desktop
    const formEl = document.getElementById('inventoryCountForm');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

// Calcula divergência em tempo real
function calculateDivergenceFeedback() {
  if (!selectedMedicine) return;

  const physicalInput = document.getElementById('physicalCountInput');
  const feedbackBox = document.getElementById('divergenceFeedbackBox');
  const badge = document.getElementById('calculatedDivergenceBadge');
  const formulaText = document.getElementById('divergenceFormulaText');
  const reasonGroup = document.getElementById('divergenceReasonGroup');
  const reasonSelect = document.getElementById('divergenceReasonSelect');

  const rawVal = physicalInput?.value;
  if (rawVal === '' || rawVal === undefined) {
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (reasonGroup) reasonGroup.style.display = 'none';
    return;
  }

  const physical = Number(rawVal);
  const system = Number(selectedMedicine.stock);
  const divergence = physical - system;

  if (feedbackBox) feedbackBox.style.display = 'block';

  if (divergence === 0) {
    if (badge) {
      badge.className = 'badge-divergence-zero';
      badge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 15px;">check_circle</span><span>Divergência: 0 (Estoque Batendo)</span>';
    }
    if (formulaText) {
      formulaText.innerHTML = `Fórmula: Contagem (<strong>${physical}</strong>) - Sistema (<strong>${system}</strong>) = <strong>0</strong>. Saldo físico e contábil 100% alinhados.`;
    }
    if (reasonGroup) reasonGroup.style.display = 'none';
    if (reasonSelect) reasonSelect.required = false;
  } else if (divergence > 0) {
    if (badge) {
      badge.className = 'badge-divergence-surplus';
      badge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px;">add_circle</span><span>Divergência: +${divergence} unid. (Sobra no Estoque)</span>`;
    }
    if (formulaText) {
      formulaText.innerHTML = `Fórmula: Contagem (<strong>${physical}</strong>) - Sistema (<strong>${system}</strong>) = <strong class="text-primary">+${divergence}</strong>. Constatada SOBRA física. Justifique abaixo.`;
    }
    if (reasonGroup) reasonGroup.style.display = 'block';
    if (reasonSelect) reasonSelect.required = true;
  } else {
    if (badge) {
      badge.className = 'badge-divergence-deficit';
      badge.innerHTML = `<span class="material-symbols-outlined" style="font-size: 15px;">remove_circle</span><span>Divergência: ${divergence} unid. (Falta no Estoque)</span>`;
    }
    if (formulaText) {
      formulaText.innerHTML = `Fórmula: Contagem (<strong>${physical}</strong>) - Sistema (<strong>${system}</strong>) = <strong class="text-danger">${divergence}</strong>. Constatada FALTA física. Justifique abaixo.`;
    }
    if (reasonGroup) reasonGroup.style.display = 'block';
    if (reasonSelect) reasonSelect.required = true;
  }
}

// Salva contagem do item
function handleSaveItemCount() {
  if (!selectedMedicine) {
    showToast('Por favor, selecione primeiro um medicamento para conferência.', 'warning');
    return;
  }

  const physicalInput = document.getElementById('physicalCountInput');
  const reasonSelect = document.getElementById('divergenceReasonSelect');
  const notesArea = document.getElementById('countNotes');

  const physicalVal = physicalInput?.value;
  if (physicalVal === '' || physicalVal === undefined || Number(physicalVal) < 0) {
    showToast('Informe uma quantidade física válida (maior ou igual a 0).', 'warning');
    physicalInput?.focus();
    return;
  }

  const physical = Number(physicalVal);
  const system = Number(selectedMedicine.stock);
  const divergence = physical - system;
  const reason = reasonSelect?.value || '';
  const notes = notesArea?.value.trim() || '';

  // Validação do motivo caso haja divergência
  if (divergence !== 0 && !reason) {
    showToast('É obrigatório selecionar o motivo da divergência para fins de auditoria sanitária SUS.', 'warning');
    reasonSelect?.focus();
    return;
  }

  // Prepara registro
  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const existingIndex = inventorySession.items.findIndex(i => i.medId === selectedMedicine.id);
  const newRecord = {
    medId: selectedMedicine.id,
    physicalCount: physical,
    conferred: true,
    divergence: divergence,
    reason: divergence !== 0 ? reason : '',
    notes: notes,
    date: dateFormatted
  };

  if (existingIndex >= 0) {
    inventorySession.items[existingIndex] = newRecord;
  } else {
    inventorySession.items.push(newRecord);
  }

  saveInventorySession();
  renderAll();

  showToast(`Contagem de ${selectedMedicine.name} salva com sucesso! (${physical} ${selectedMedicine.unit || 'unid.'})`, 'success');
  resetCountForm();
}

// Limpa o formulário de contagem
function resetCountForm() {
  selectedMedicine = null;

  const searchInput = document.getElementById('medicineSearchInput');
  const selectedIdInput = document.getElementById('selectedMedicineId');
  const detailPanel = document.getElementById('medDetailPanel');
  const physicalInput = document.getElementById('physicalCountInput');
  const feedbackBox = document.getElementById('divergenceFeedbackBox');
  const reasonGroup = document.getElementById('divergenceReasonGroup');
  const reasonSelect = document.getElementById('divergenceReasonSelect');
  const notesArea = document.getElementById('countNotes');
  const btnSave = document.getElementById('btnSaveItemCount');

  if (searchInput) searchInput.value = '';
  if (selectedIdInput) selectedIdInput.value = '';
  if (detailPanel) detailPanel.style.display = 'none';
  if (physicalInput) {
    physicalInput.value = '';
    physicalInput.disabled = true;
  }
  if (feedbackBox) feedbackBox.style.display = 'none';
  if (reasonGroup) reasonGroup.style.display = 'none';
  if (reasonSelect) reasonSelect.value = '';
  if (notesArea) notesArea.value = '';
  if (btnSave) btnSave.disabled = true;
}

// ==========================================================================
// HOMOLOGAÇÃO & FECHAMENTO DO INVENTÁRIO MENSAL
// ==========================================================================
function openHomologateModal() {
  const modal = document.getElementById('homologateModal');
  if (!modal) return;

  const countedItems = inventorySession.items.filter(i => i.conferred);
  const divergentItems = countedItems.filter(i => i.divergence !== 0);
  const totalCatalog = currentCatalog.length;

  const modalCycleName = document.getElementById('modalCycleName');
  const modalAuditedItems = document.getElementById('modalAuditedItems');
  const modalDivergentItems = document.getElementById('modalDivergentItems');
  const modalPendingWarning = document.getElementById('modalPendingWarning');

  if (modalCycleName) modalCycleName.textContent = inventorySession.cycle;
  if (modalAuditedItems) modalAuditedItems.textContent = `${countedItems.length} de ${totalCatalog} itens`;
  if (modalDivergentItems) modalDivergentItems.textContent = `${divergentItems.length} com divergência`;

  if (modalPendingWarning) {
    if (countedItems.length < totalCatalog) {
      modalPendingWarning.classList.remove('d-none');
    } else {
      modalPendingWarning.classList.add('d-none');
    }
  }

  modal.style.display = 'flex';
}

function closeHomologateModal() {
  const modal = document.getElementById('homologateModal');
  if (modal) modal.style.display = 'none';
}

function handleConfirmHomologation() {
  // Atualiza os saldos no catálogo de estoque com base na contagem física de cada item
  inventorySession.items.forEach(record => {
    if (record.conferred) {
      const catItem = currentCatalog.find(m => m.id === record.medId);
      if (catItem) {
        catItem.stock = Number(record.physicalCount);
      }
    }
  });

  // Salva novo estoque homologado
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(currentCatalog));

  // Marca sessão como HOMOLOGADO
  inventorySession.status = 'HOMOLOGADO';
  inventorySession.homologatedAt = new Date().toLocaleString('pt-BR');
  saveInventorySession();

  closeHomologateModal();
  renderAll();

  showToast('Inventário Mensal homologado com sucesso! Saldos de estoque ajustados e auditados.', 'success');
}

// Impressão da Ata Oficial
function handlePrintAta() {
  const printCycle = document.getElementById('printCycle');
  const printStatus = document.getElementById('printStatus');
  const printAccuracy = document.getElementById('printAccuracy');
  const printDateStamp = document.getElementById('printDateStamp');
  const printTableBody = document.getElementById('printTableBody');

  const countedItems = inventorySession.items.filter(i => i.conferred);
  const divergentItems = countedItems.filter(i => i.divergence !== 0);

  let accuracy = 100;
  if (countedItems.length > 0) {
    accuracy = Math.round(((countedItems.length - divergentItems.length) / countedItems.length) * 100);
  }

  if (printCycle) printCycle.textContent = inventorySession.cycle;
  if (printStatus) printStatus.textContent = inventorySession.status === 'HOMOLOGADO' ? 'HOMOLOGADO' : 'PARCIAL / EM ANDAMENTO';
  if (printAccuracy) printAccuracy.textContent = `${accuracy}%`;
  if (printDateStamp) printDateStamp.textContent = `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;

  if (printTableBody) {
    printTableBody.innerHTML = '';
    currentCatalog.forEach(med => {
      const record = inventorySession.items.find(i => i.medId === med.id);
      const isConferred = !!record?.conferred;
      const physical = isConferred ? record.physicalCount : 'Pendente';
      const divergence = isConferred ? (record.divergence > 0 ? `+${record.divergence}` : record.divergence) : '-';
      const reason = record?.reason || (isConferred ? 'Saldo Conforme' : 'Não auditado');

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e5e7eb';
      tr.innerHTML = `
        <td style="padding: 5px 8px;"><strong>${escapeHtml(med.name)} ${escapeHtml(med.dosage)}</strong></td>
        <td style="padding: 5px 8px;">${escapeHtml(med.batch)}</td>
        <td style="padding: 5px 8px; text-align: center;">${escapeHtml(med.expiry)}</td>
        <td style="padding: 5px 8px; text-align: right;">${med.stock}</td>
        <td style="padding: 5px 8px; text-align: right;">${physical}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: bold;">${divergence}</td>
        <td style="padding: 5px 8px;">${escapeHtml(reason)}</td>
      `;
      printTableBody.appendChild(tr);
    });
  }

  // Aciona impressão
  const printArea = document.getElementById('printArea');
  if (printArea) {
    printArea.classList.remove('d-none');
    window.print();
    printArea.classList.add('d-none');
  }
}

// ==========================================================================
// UTILITÁRIOS
// ==========================================================================
function showToast(message, type = 'success') {
  const toastEl = document.getElementById('liveToast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toastEl || !toastMessage) return;

  toastMessage.textContent = message;

  if (type === 'warning') {
    toastEl.style.backgroundColor = '#b45309';
    if (toastIcon) toastIcon.textContent = 'warning';
  } else if (type === 'danger') {
    toastEl.style.backgroundColor = '#b91c1c';
    if (toastIcon) toastIcon.textContent = 'error';
  } else if (type === 'info') {
    toastEl.style.backgroundColor = '#0b3099';
    if (toastIcon) toastIcon.textContent = 'info';
  } else {
    toastEl.style.backgroundColor = '#047857';
    if (toastIcon) toastIcon.textContent = 'check_circle';
  }

  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
