// FarmaUBS - Lógica de Inventário Mensal & Apuração de Divergências (js/inventario.js)
// Conforme especificações do SUS e RDC 430/2020:
// - Ciclo ativo: mês corrente (Outubro / 2026)
// - Histórico de ciclos anteriores homologados (ex: 28/09/2026 e ciclos fechados pelo usuário)
// - Impressão da Ata oficial para qualquer ciclo
// - Retificação de contagem pós-homologação protegida com justificativa obrigatória e trilha de auditoria.

const INVENTORY_STORAGE_KEY = (typeof FarmaStore !== 'undefined' && FarmaStore.keys && FarmaStore.keys.session)
  ? FarmaStore.keys.session
  : 'farmaubs_inventario_v2';

// Estado da Aplicação
let inventorySession = null;
let currentCatalog = [];
let selectedMedicine = null;
let currentEditingHistoryCycle = null;

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
  currentCatalog = FarmaStore.load();
}

// Inicializa a sessão do inventário mensal corrente (Outubro / 2026)
function initInventorySession() {
  try {
    const stored = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.cycleKey === '2026-10') {
        inventorySession = parsed;
        return;
      }
    }

    // Gera itens iniciais de demonstração alinhados aos lotes reais do catálogo
    const initialItems = currentCatalog.slice(0, 6).map((med, idx) => ({
      medId: med.id,
      physicalCount: med.stock,
      conferred: true,
      divergence: 0,
      reason: '',
      notes: `Conferência física 100% conforme para o lote ${med.batch}.`,
      date: `23/10/2026 09:${String(10 + idx * 8).padStart(2, '0')}`
    }));

    // Sessão padrão de Outubro / 2026 (mês corrente) com dados de demonstração interativos
    inventorySession = {
      id: 'sess_2026-10',
      cycleKey: '2026-10',
      cycle: 'Outubro / 2026',
      startDate: '01/10/2026',
      status: 'EM_ANDAMENTO', // 'EM_ANDAMENTO' ou 'HOMOLOGADO'
      pharmacist: 'Dr. Carlos Eduardo (CRF/PI 4821)',
      unit: 'SMS Parnaíba - UBS Centro',
      items: initialItems
    };
    saveInventorySession();
  } catch (e) {
    console.error('Erro ao carregar sessão de inventário:', e);
    inventorySession = {
      id: 'sess_2026-10',
      cycleKey: '2026-10',
      cycle: 'Outubro / 2026',
      startDate: '01/10/2026',
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
  renderHistoryTable();
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
// RENDERIZAÇÃO DO HISTÓRICO DE INVENTÁRIOS ANTERIORES
// ==========================================================================
function renderHistoryTable() {
  const tbody = document.getElementById('historyInventoryTableBody');
  const countText = document.getElementById('historyTableCountText');
  if (!tbody) return;

  const history = FarmaStore.loadHistory();
  tbody.innerHTML = '';

  if (!history || history.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted" style="font-size: 13px;">
          Nenhum inventário anterior homologado registrado.
        </td>
      </tr>
    `;
    if (countText) countText.textContent = '0 ciclos homologados';
    return;
  }

  history.forEach(cycle => {
    const tr = document.createElement('tr');

    // Data de homologação formatada
    let dateFormatted = '—';
    if (cycle.homologatedAt) {
      const d = cycle.homologatedAt.slice(0, 10);
      const t = cycle.homologatedAt.length >= 16 ? cycle.homologatedAt.slice(11, 16) : '';
      dateFormatted = `${FarmaStore.fmtDate(d)}${t ? ` às ${t}` : ''}`;
    }

    // Selo de Homologado
    const badgeStatus = `
      <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 d-inline-flex align-items-center gap-1" style="font-size: 11px; font-weight: 600;">
        <span class="material-symbols-outlined" style="font-size: 14px;">verified</span>
        <span>Homologado</span>
      </span>
    `;

    // Última edição / retificação
    let editCell = `<span class="text-muted" style="font-size: 12px;">—</span>`;
    if (cycle.editedAt) {
      const editD = cycle.editedAt.slice(0, 10);
      const editT = cycle.editedAt.length >= 16 ? cycle.editedAt.slice(11, 16) : '';
      const lastEditDesc = (cycle.edits && cycle.edits.length > 0)
        ? `Último motivo: ${cycle.edits[cycle.edits.length - 1].reason}`
        : 'Retificado pelo Farmacêutico';

      editCell = `
        <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 d-inline-flex align-items-center gap-1" style="font-size: 11px;" title="${escapeHtml(lastEditDesc)}">
          <span class="material-symbols-outlined" style="font-size: 14px;">edit_note</span>
          <span>${FarmaStore.fmtDate(editD)} ${editT}</span>
        </span>
      `;
    }

    // Botões de Ação: Baixar Ata e Editar (Retificar)
    const actionCell = `
      <div class="text-end d-flex align-items-center justify-content-end gap-1">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary py-1 px-2 d-inline-flex align-items-center gap-1 btn-print-hist-ata"
          data-cycle-id="${cycle.id}"
          title="Baixar e imprimir Ata Oficial do Inventário"
          style="font-size: 11px;"
        >
          <span class="material-symbols-outlined" style="font-size: 15px;">print</span>
          <span>Ata</span>
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center gap-1 btn-edit-hist-cycle"
          data-cycle-id="${cycle.id}"
          title="Retificar contagem de item deste inventário homologado (requer justificativa)"
          style="font-size: 11px;"
        >
          <span class="material-symbols-outlined" style="font-size: 15px;">edit</span>
          <span>Editar</span>
        </button>
      </div>
    `;

    tr.innerHTML = `
      <td>
        <strong class="text-dark d-block" style="font-size: 13px;">${escapeHtml(cycle.cycle)}</strong>
        <span class="text-muted" style="font-size: 11px;">${escapeHtml(cycle.pharmacist || 'Responsável Técnico')}</span>
      </td>
      <td style="font-size: 12px; color: #334155;">
        ${dateFormatted}
      </td>
      <td class="text-center">
        ${badgeStatus}
      </td>
      <td>
        ${editCell}
      </td>
      <td>
        ${actionCell}
      </td>
    `;

    tbody.appendChild(tr);
  });

  if (countText) {
    countText.textContent = `${history.length} ciclo(s) homologado(s) arquivado(s)`;
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

  // Modal de Retificação de Histórico
  const btnCloseEditHistoryModal = document.getElementById('btnCloseEditHistoryModal');
  const btnCancelEditHistory = document.getElementById('btnCancelEditHistory');
  const btnSaveEditHistory = document.getElementById('btnSaveEditHistory');
  const editHistoryMedicineSelect = document.getElementById('editHistoryMedicineSelect');

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

  // 4. Delegação de Clique na Tabela Ativa para botão "Contar / Editar"
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

  // 7. Impressão da Ata do Ciclo Atual
  if (btnPrintAta) {
    btnPrintAta.addEventListener('click', () => handlePrintAta());
  }

  // 8. Tabela de Histórico: Delegação para Baixar Ata e Editar
  const historyTbody = document.getElementById('historyInventoryTableBody');
  if (historyTbody) {
    historyTbody.addEventListener('click', (e) => {
      const btnPrint = e.target.closest('.btn-print-hist-ata');
      if (btnPrint) {
        const cycleId = btnPrint.getAttribute('data-cycle-id');
        handlePrintAta(cycleId);
        return;
      }

      const btnEdit = e.target.closest('.btn-edit-hist-cycle');
      if (btnEdit) {
        const cycleId = btnEdit.getAttribute('data-cycle-id');
        openEditHistoryModal(cycleId);
      }
    });
  }

  // 9. Eventos do Modal de Retificação de Histórico
  if (btnCloseEditHistoryModal) {
    btnCloseEditHistoryModal.addEventListener('click', closeEditHistoryModal);
  }
  if (btnCancelEditHistory) {
    btnCancelEditHistory.addEventListener('click', closeEditHistoryModal);
  }
  if (btnSaveEditHistory) {
    btnSaveEditHistory.addEventListener('click', handleSaveEditHistory);
  }
  if (editHistoryMedicineSelect) {
    editHistoryMedicineSelect.addEventListener('change', handleSelectMedicineToEditHistory);
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
  const nowIso = new Date().toISOString();

  // 1. Atualiza saldos do catálogo com as contagens físicas dos itens conferidos
  inventorySession.items.forEach(record => {
    if (record.conferred) {
      const catItem = currentCatalog.find(m => m.id === record.medId);
      if (catItem) {
        catItem.stock = Number(record.physicalCount);
      }
    }
  });
  FarmaStore.save(currentCatalog);

  // 2. Marca sessão ativa como HOMOLOGADA
  inventorySession.status = 'HOMOLOGADO';
  inventorySession.homologatedAt = nowIso;
  saveInventorySession();

  // 3. Constrói o snapshot de conformidade para o histórico oficial
  const snapshotItems = currentCatalog.map(med => {
    const record = inventorySession.items.find(i => i.medId === med.id);
    const physical = record && record.conferred ? Number(record.physicalCount) : med.stock;
    const divergence = record && record.conferred ? Number(record.divergence) : 0;
    const reason = record?.reason || (divergence === 0 ? '' : 'Homologação administrativa');
    const notes = record?.notes || '';

    return {
      medId: med.id,
      name: med.name,
      dosage: med.dosage,
      form: med.form,
      batch: med.batch,
      expiry: med.expiry,
      unit: med.unit,
      system: med.stock,
      physical: physical,
      divergence: divergence,
      reason: reason,
      notes: notes
    };
  });

  // 4. Adiciona ao histórico persistido (substitui caso já exista o ciclo 2026-10)
  const history = FarmaStore.loadHistory();
  const filtered = history.filter(h => h.cycleKey !== inventorySession.cycleKey);
  filtered.unshift({
    id: `hist_${inventorySession.cycleKey}`,
    cycleKey: inventorySession.cycleKey,
    cycle: inventorySession.cycle,
    homologatedAt: nowIso,
    pharmacist: inventorySession.pharmacist,
    editedAt: null,
    edits: [],
    items: snapshotItems
  });
  FarmaStore.saveHistory(filtered);

  closeHomologateModal();
  renderAll();

  showToast(`Ciclo de ${inventorySession.cycle} homologado com sucesso! Arquivado no Histórico de Inventários.`, 'success');
}

// ==========================================================================
// IMPRESSÃO DA ATA OFICIAL DE HOMOLOGAÇÃO
// ==========================================================================
function handlePrintAta(cycleId) {
  const printCycle = document.getElementById('printCycle');
  const printStatus = document.getElementById('printStatus');
  const printAccuracy = document.getElementById('printAccuracy');
  const printDateStamp = document.getElementById('printDateStamp');
  const printTableBody = document.getElementById('printTableBody');

  let cycleTitle = inventorySession.cycle;
  let cycleStatus = inventorySession.status === 'HOMOLOGADO' ? 'HOMOLOGADO' : 'PARCIAL / EM ANDAMENTO';
  let dateStampText = `Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
  let rowsToPrint = [];

  if (cycleId) {
    // Impressão de ciclo arquivado no histórico
    const history = FarmaStore.loadHistory();
    const cycle = history.find(c => c.id === cycleId);
    if (cycle) {
      cycleTitle = cycle.cycle;
      cycleStatus = 'HOMOLOGADO';
      const d = cycle.homologatedAt ? cycle.homologatedAt.slice(0, 10) : '';
      const t = cycle.homologatedAt && cycle.homologatedAt.length >= 16 ? cycle.homologatedAt.slice(11, 16) : '';
      dateStampText = `Homologado em: ${FarmaStore.fmtDate(d)}${t ? ` às ${t}` : ''}`;
      rowsToPrint = cycle.items.map(item => ({
        name: `${item.name} ${item.dosage}`,
        batch: item.batch,
        expiry: item.expiry,
        system: item.system,
        physical: item.physical,
        divergence: item.divergence > 0 ? `+${item.divergence}` : item.divergence,
        reason: item.reason || (item.divergence === 0 ? 'Saldo Conforme' : 'Sem motivo')
      }));
    }
  }

  if (rowsToPrint.length === 0) {
    // Impressão da sessão corrente
    const countedItems = inventorySession.items.filter(i => i.conferred);
    rowsToPrint = currentCatalog.map(med => {
      const record = inventorySession.items.find(i => i.medId === med.id);
      const isConferred = !!record?.conferred;
      const physical = isConferred ? record.physicalCount : 'Pendente';
      const divergence = isConferred ? (record.divergence > 0 ? `+${record.divergence}` : record.divergence) : '-';
      const reason = record?.reason || (isConferred ? 'Saldo Conforme' : 'Não auditado');

      return {
        name: `${med.name} ${med.dosage}`,
        batch: med.batch,
        expiry: med.expiry,
        system: med.stock,
        physical: physical,
        divergence: divergence,
        reason: reason
      };
    });
  }

  // Calcula acurácia
  const validDivergences = rowsToPrint.filter(r => r.divergence !== '-' && r.divergence !== 0 && r.divergence !== '+0');
  const accuracy = rowsToPrint.length > 0
    ? Math.round(((rowsToPrint.length - validDivergences.length) / rowsToPrint.length) * 100)
    : 100;

  if (printCycle) printCycle.textContent = cycleTitle;
  if (printStatus) printStatus.textContent = cycleStatus;
  if (printAccuracy) printAccuracy.textContent = `${accuracy}%`;
  if (printDateStamp) printDateStamp.textContent = dateStampText;

  if (printTableBody) {
    printTableBody.innerHTML = '';
    rowsToPrint.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e5e7eb';
      tr.innerHTML = `
        <td style="padding: 5px 8px;"><strong>${escapeHtml(item.name)}</strong></td>
        <td style="padding: 5px 8px;">${escapeHtml(item.batch)}</td>
        <td style="padding: 5px 8px; text-align: center;">${escapeHtml(item.expiry)}</td>
        <td style="padding: 5px 8px; text-align: right;">${item.system}</td>
        <td style="padding: 5px 8px; text-align: right;">${item.physical}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: bold;">${item.divergence}</td>
        <td style="padding: 5px 8px;">${escapeHtml(item.reason)}</td>
      `;
      printTableBody.appendChild(tr);
    });
  }

  // Aciona visualização de impressão nativa
  const printArea = document.getElementById('printArea');
  if (printArea) {
    printArea.classList.remove('d-none');
    window.print();
    printArea.classList.add('d-none');
  }
}

// ==========================================================================
// MODAL DE RETIFICAÇÃO DE INVENTÁRIO HOMOLOGADO (COM MOTIVO OBRIGATÓRIO)
// ==========================================================================
function openEditHistoryModal(cycleId) {
  const modal = document.getElementById('editHistoryModal');
  if (!modal) return;

  const history = FarmaStore.loadHistory();
  const cycle = history.find(c => c.id === cycleId);
  if (!cycle) {
    showToast('Ciclo de inventário não localizado.', 'danger');
    return;
  }

  currentEditingHistoryCycle = cycle;

  const cycleIdInput = document.getElementById('editHistoryCycleId');
  const cycleLabelInput = document.getElementById('editHistoryCycleLabel');
  const medSelect = document.getElementById('editHistoryMedicineSelect');
  const currentDataBox = document.getElementById('editHistoryCurrentDataBox');
  const newCountInput = document.getElementById('editHistoryNewCount');
  const reasonSelect = document.getElementById('editHistoryReasonSelect');
  const notesArea = document.getElementById('editHistoryNotes');

  if (cycleIdInput) cycleIdInput.value = cycle.id;
  if (cycleLabelInput) cycleLabelInput.value = `${cycle.cycle} (Homologado em ${FarmaStore.fmtDate(cycle.homologatedAt ? cycle.homologatedAt.slice(0, 10) : '')})`;

  // Popula seletor de medicamentos com os itens deste inventário
  if (medSelect) {
    medSelect.innerHTML = '<option value="" selected disabled>Selecione o medicamento...</option>';
    cycle.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.medId;
      opt.textContent = `${item.name} ${item.dosage} (Contagem: ${item.physical} | Saldo: ${item.system})`;
      medSelect.appendChild(opt);
    });
  }

  if (currentDataBox) currentDataBox.classList.add('d-none');
  if (newCountInput) newCountInput.value = '';
  if (reasonSelect) reasonSelect.value = '';
  if (notesArea) notesArea.value = '';

  modal.style.display = 'flex';
}

function closeEditHistoryModal() {
  const modal = document.getElementById('editHistoryModal');
  if (modal) modal.style.display = 'none';
  currentEditingHistoryCycle = null;
}

function handleSelectMedicineToEditHistory() {
  const medSelect = document.getElementById('editHistoryMedicineSelect');
  const currentDataBox = document.getElementById('editHistoryCurrentDataBox');
  const sysCountEl = document.getElementById('editHistorySysCount');
  const oldCountEl = document.getElementById('editHistoryOldCount');
  const oldDivEl = document.getElementById('editHistoryOldDiv');
  const newCountInput = document.getElementById('editHistoryNewCount');

  if (!currentEditingHistoryCycle || !medSelect || !medSelect.value) return;

  const item = currentEditingHistoryCycle.items.find(i => i.medId === medSelect.value);
  if (!item) return;

  if (sysCountEl) sysCountEl.textContent = `${item.system} ${item.unit || 'unid.'}`;
  if (oldCountEl) oldCountEl.textContent = `${item.physical} ${item.unit || 'unid.'}`;
  if (oldDivEl) {
    const sign = item.divergence > 0 ? `+${item.divergence}` : `${item.divergence}`;
    oldDivEl.textContent = `${sign} ${item.reason ? `(${item.reason})` : ''}`;
  }

  if (newCountInput) {
    newCountInput.value = item.physical;
    newCountInput.focus();
  }

  if (currentDataBox) currentDataBox.classList.remove('d-none');
}

function handleSaveEditHistory() {
  if (!currentEditingHistoryCycle) return;

  const medSelect = document.getElementById('editHistoryMedicineSelect');
  const newCountInput = document.getElementById('editHistoryNewCount');
  const reasonSelect = document.getElementById('editHistoryReasonSelect');
  const notesArea = document.getElementById('editHistoryNotes');

  const medId = medSelect?.value;
  if (!medId) {
    showToast('Selecione o medicamento que deseja retificar.', 'warning');
    medSelect?.focus();
    return;
  }

  const rawCount = newCountInput?.value;
  if (rawCount === '' || rawCount === undefined || Number(rawCount) < 0) {
    showToast('Informe uma nova contagem física válida (maior ou igual a 0).', 'warning');
    newCountInput?.focus();
    return;
  }

  const newPhysical = Number(rawCount);
  const reason = reasonSelect?.value || '';
  const justification = notesArea?.value.trim() || '';

  // Validação: Motivo e justificativa são estritamente obrigatórios
  if (!reason) {
    showToast('É obrigatório selecionar o motivo da alteração para atender à auditoria sanitária.', 'warning');
    reasonSelect?.focus();
    return;
  }
  if (!justification) {
    showToast('É obrigatório redigir a justificativa técnica detalhada da alteração.', 'warning');
    notesArea?.focus();
    return;
  }

  const history = FarmaStore.loadHistory();
  const cycleIndex = history.findIndex(c => c.id === currentEditingHistoryCycle.id);
  if (cycleIndex === -1) {
    showToast('Ciclo de histórico não encontrado na base de dados.', 'danger');
    return;
  }

  const targetCycle = history[cycleIndex];
  const itemIndex = targetCycle.items.findIndex(i => i.medId === medId);
  if (itemIndex === -1) {
    showToast('Medicamento não localizado no inventário deste ciclo.', 'danger');
    return;
  }

  const targetItem = targetCycle.items[itemIndex];
  const oldPhysical = targetItem.physical;
  const newDivergence = newPhysical - Number(targetItem.system);
  const nowIso = new Date().toISOString();

  // Atualiza item no snapshot
  targetItem.physical = newPhysical;
  targetItem.divergence = newDivergence;
  targetItem.reason = reason;
  targetItem.notes = targetItem.notes
    ? `${targetItem.notes} | Retificação: ${justification}`
    : `Retificação: ${justification}`;

  // Marca data da última edição e adiciona ao log auditável de retificações
  targetCycle.editedAt = nowIso;
  if (!targetCycle.edits) targetCycle.edits = [];
  targetCycle.edits.push({
    timestamp: nowIso,
    medId: targetItem.medId,
    medName: `${targetItem.name} ${targetItem.dosage}`,
    oldPhysical: oldPhysical,
    newPhysical: newPhysical,
    reason: reason,
    justification: justification,
    pharmacist: targetCycle.pharmacist || 'Farmacêutico RT'
  });

  // Se o ciclo retificado for o mês corrente (Outubro), atualiza também o catálogo ativo
  if (targetCycle.cycleKey === inventorySession.cycleKey) {
    const catItem = currentCatalog.find(m => m.id === medId);
    if (catItem) {
      catItem.stock = newPhysical;
      FarmaStore.save(currentCatalog);
    }
    const sessionItem = inventorySession.items.find(i => i.medId === medId);
    if (sessionItem) {
      sessionItem.physicalCount = newPhysical;
      sessionItem.divergence = newDivergence;
      sessionItem.reason = reason;
      sessionItem.notes = targetItem.notes;
      saveInventorySession();
    }
  }

  // Persiste histórico atualizado
  FarmaStore.saveHistory(history);

  closeEditHistoryModal();
  renderAll();

  showToast(`Inventário de ${targetCycle.cycle} retificado com sucesso! Registro de auditoria arquivado.`, 'success');
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
