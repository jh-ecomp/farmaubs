// FarmaUBS - Lógica de Recebimento de Medicamentos / Entrada de Estoque (js/recebimento.js)

// Medicamentos em estoque (lidos do estoque compartilhado: js/estoque-store.js)
let INVENTORY_MEDICINES = [];

function refreshInventory() {
  INVENTORY_MEDICINES = FarmaStore.load().map(m => ({
    id: m.id,
    name: `${m.name} ${m.dosage}`,
    form: m.form,
    batch: m.batch,
    expiry: m.expiryDate,
    stock: m.stock,
    unit: m.unit
  }));
}

let receivingsList = [];
let pendingEstornoEntryId = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshInventory();
  initUserSession();
  initReceivingCombobox();
  setupDefaultExpiryDate();
  loadReceivingsData();
  setupReceivingForm();
  setupTableEventListeners();
  setupSearchFilter();
  setupModals();
});

/**
 * Carrega a identificação salva no login
 */
function initUserSession() {
  const savedUser = localStorage.getItem('farmaubs_user');
  const navUserName = document.getElementById('navUserName');
  const navUserEmail = document.getElementById('navUserEmail');
  const userAvatar = document.getElementById('userAvatar');

  if (savedUser) {
    if (navUserEmail) navUserEmail.textContent = savedUser;
    const namePart = savedUser.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    if (navUserName) navUserName.textContent = formattedName;
    if (userAvatar) userAvatar.textContent = namePart.charAt(0).toUpperCase();
  }

  // Alternar Menu Lateral no Mobile
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const farmaSidebar = document.getElementById('farmaSidebar');
  if (btnToggleSidebar && farmaSidebar) {
    btnToggleSidebar.addEventListener('click', (e) => {
      e.stopPropagation();
      farmaSidebar.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (farmaSidebar.classList.contains('show') && !farmaSidebar.contains(e.target) && e.target !== btnToggleSidebar) {
        farmaSidebar.classList.remove('show');
      }
    });
  }
}

/**
 * Define data padrão de validade para testes (2 anos no futuro)
 */
function setupDefaultExpiryDate() {
  const expiryInput = document.getElementById('recExpiryDate');
  if (expiryInput && !expiryInput.value) {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 2);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expiryInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Inicializa o Combobox de Seleção de Medicamento para Recebimento
 */
function initReceivingCombobox() {
  const searchInput = document.getElementById('recMedSearchInput');
  const selectedMedId = document.getElementById('recSelectedMedId');
  const dropdownList = document.getElementById('recMedDropdownList');
  const btnClear = document.getElementById('btnClearRecMedSearch');
  const dropdownArrow = document.getElementById('recMedDropdownArrow');
  const wrapper = document.getElementById('recMedComboboxWrapper');
  const recBatchNumber = document.getElementById('recBatchNumber');
  const recUnitLabel = document.getElementById('recUnitLabel');

  if (!searchInput || !dropdownList) return;

  function renderDropdown(filterText = '') {
    const query = filterText.toLowerCase().trim();

    const filtered = INVENTORY_MEDICINES.filter(med => {
      if (!query) return true;
      return (
        med.name.toLowerCase().includes(query) ||
        med.form.toLowerCase().includes(query) ||
        med.batch.toLowerCase().includes(query)
      );
    });

    if (filtered.length === 0) {
      dropdownList.innerHTML = `
        <div class="farma-dropdown-empty">
          <span class="material-symbols-outlined d-block text-muted mb-1" style="font-size: 24px;">search_off</span>
          Nenhum medicamento encontrado para <strong>"${escapeHTML(filterText)}"</strong>.
        </div>
      `;
      dropdownList.style.display = 'block';
      return;
    }

    dropdownList.innerHTML = filtered.map(med => {
      return `
        <div class="farma-dropdown-item" data-id="${med.id}">
          <div class="d-flex align-items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size: 18px;">pill</span>
            <div>
              <span class="d-block fw-semibold text-dark" style="font-size: 13px;">${escapeHTML(med.name)}</span>
              <small class="text-muted" style="font-size: 11px;">
                ${escapeHTML(med.form)} &bull; Lote Atual: ${escapeHTML(med.batch)}
              </small>
            </div>
          </div>
          <div class="text-end ps-2">
            <small class="badge bg-light text-primary border" style="font-size: 11px;">
              Estoque Atual: ${med.stock} ${escapeHTML(med.unit)}
            </small>
          </div>
        </div>
      `;
    }).join('');

    dropdownList.style.display = 'block';

    const items = dropdownList.querySelectorAll('.farma-dropdown-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const medId = item.getAttribute('data-id');
        const med = INVENTORY_MEDICINES.find(m => m.id === medId);
        if (med) selectMedicine(med);
      });
    });
  }

  function selectMedicine(med) {
    selectedMedId.value = med.id;
    searchInput.value = `${med.name} (${med.form})`;
    dropdownList.style.display = 'none';
    if (btnClear) btnClear.style.display = 'block';

    if (recBatchNumber) recBatchNumber.value = med.batch;
    if (recUnitLabel) recUnitLabel.textContent = med.unit;

    searchInput.classList.remove('is-invalid');
    document.getElementById('recQuantity').focus();
  }

  window.clearReceivingMedicineSelection = function() {
    selectedMedId.value = '';
    searchInput.value = '';
    if (btnClear) btnClear.style.display = 'none';
    dropdownList.style.display = 'none';
    searchInput.focus();
  };

  searchInput.addEventListener('input', () => {
    selectedMedId.value = '';
    if (btnClear) {
      btnClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
    }
    renderDropdown(searchInput.value);
  });

  searchInput.addEventListener('focus', () => {
    renderDropdown(searchInput.value);
  });

  if (dropdownArrow) {
    dropdownArrow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdownList.style.display === 'block') {
        dropdownList.style.display = 'none';
      } else {
        searchInput.focus();
        renderDropdown(searchInput.value);
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.stopPropagation();
      window.clearReceivingMedicineSelection();
    });
  }

  document.addEventListener('click', (e) => {
    if (wrapper && !wrapper.contains(e.target)) {
      dropdownList.style.display = 'none';
    }
  });
}

/**
 * Carrega a lista de recebimentos do LocalStorage
 */
function loadReceivingsData() {
  receivingsList = FarmaStore.loadReceivings();
  renderReceivingsTable();
  updateStatistics();
}

function saveToStorage() {
  FarmaStore.saveReceivings(receivingsList);
}

/**
 * Configura o envio do Formulário de Recebimento
 */
function setupReceivingForm() {
  const receivingForm = document.getElementById('receivingForm');
  const selectedMedId = document.getElementById('recSelectedMedId');
  const searchInput = document.getElementById('recMedSearchInput');
  const invoiceNumber = document.getElementById('invoiceNumber');
  const supplierOrigin = document.getElementById('supplierOrigin');
  const recBatchNumber = document.getElementById('recBatchNumber');
  const recExpiryDate = document.getElementById('recExpiryDate');
  const recQuantity = document.getElementById('recQuantity');
  const recNotes = document.getElementById('recNotes');

  if (!receivingForm) return;

  receivingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const medId = selectedMedId.value;
    const med = INVENTORY_MEDICINES.find(m => m.id === medId);

    if (!med) {
      e.stopPropagation();
      if (searchInput) {
        searchInput.classList.add('is-invalid');
        searchInput.focus();
      }
      return;
    }

    if (!receivingForm.checkValidity()) {
      e.stopPropagation();
      receivingForm.classList.add('was-validated');
      return;
    }

    const quantity = parseInt(recQuantity.value, 10);
    const batch = recBatchNumber.value.trim().toUpperCase();
    const expiryRaw = recExpiryDate.value;
    const expiryFormatted = formatDateBR(expiryRaw);

    const date = FarmaStore.today();
    const time = FarmaStore.nowTime();

    const newReceiving = {
      id: 'rec_' + Date.now(),
      medId: med.id,
      medicine: med.name,
      form: med.form,
      batch: batch,
      expiry: expiryFormatted,
      expiryDate: expiryRaw,
      quantity: quantity,
      unit: med.unit,
      invoiceNumber: invoiceNumber.value.trim(),
      supplierOrigin: supplierOrigin.value,
      notes: recNotes.value.trim() || 'Conferência física realizada sem divergências',
      date: date,
      time: time
    };

    // Atualiza saldo, lote e validade no estoque compartilhado
    FarmaStore.adjust(med.id, quantity, { batch, expiryDate: expiryRaw });
    refreshInventory();

    receivingsList.unshift(newReceiving);
    saveToStorage();

    renderReceivingsTable(newReceiving.id);
    updateStatistics();

    showToast(`Entrada de ${quantity} ${med.unit} de "${med.name}" registrada com sucesso!`, 'success');

    // Reseta formulário
    receivingForm.reset();
    receivingForm.classList.remove('was-validated');
    if (window.clearReceivingMedicineSelection) {
      window.clearReceivingMedicineSelection();
    }
    setupDefaultExpiryDate();
    invoiceNumber.focus();
  });
}

function formatDateBR(dateString) {
  if (!dateString) return '—';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Obtém a lista de recebimentos filtrada por range de datas e busca
 */
function getFilteredReceivings() {
  const fromDate = document.getElementById('recDateFrom')?.value || '';
  const toDate = document.getElementById('recDateTo')?.value || '';
  const searchFilter = document.getElementById('searchReceivingInput')?.value.toLowerCase().trim() || '';

  return receivingsList.filter(item => {
    if (fromDate || toDate) {
      if (!FarmaStore.inRange(item.date, fromDate, toDate)) return false;
    }
    if (!searchFilter) return true;
    return (
      item.medicine.toLowerCase().includes(searchFilter) ||
      item.batch.toLowerCase().includes(searchFilter) ||
      item.invoiceNumber.toLowerCase().includes(searchFilter) ||
      item.supplierOrigin.toLowerCase().includes(searchFilter)
    );
  });
}

/**
 * Renderiza a Tabela de Recebimentos em Tempo Real
 */
function renderReceivingsTable(highlightedId = null) {
  const tbody = document.getElementById('receivingsTableBody');
  const emptyState = document.getElementById('emptyReceivingMessage');
  const badgeCount = document.getElementById('badgeReceivingCount');
  const footerSummary = document.getElementById('footerReceivingSummary');

  if (!tbody) return;

  const filteredList = getFilteredReceivings();

  if (badgeCount) {
    badgeCount.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'entrada' : 'entradas'}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhum recebimento encontrado no período/busca.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${receivingsList.length} entradas de estoque.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.medicine ? item.medicine.charAt(0).toUpperCase() : 'M';
    const isToday = item.date === FarmaStore.today();
    const dateDisplay = item.date
      ? (isToday ? `<span class="fw-semibold text-primary">Hoje, ${item.time || ''}</span>` : `<span class="fw-semibold text-dark">${FarmaStore.fmtDate(item.date)}</span> <small class="text-muted d-block" style="font-size: 11px;">${item.time || ''}</small>`)
      : (item.time || '—');

    return `
      <tr class="${isRowNew}" data-id="${item.id}">
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 32px; height: 32px; background-color: rgba(4, 120, 87, 0.1); color: #047857; font-size: 13px; flex-shrink: 0;">
              ${initial}
            </div>
            <div>
              <span class="d-block fw-bold text-dark" style="font-size: 14px;">${escapeHTML(item.medicine)}</span>
              <span class="badge-category-tag" style="font-size: 10px;">${escapeHTML(item.form)}</span>
            </div>
          </div>
        </td>

        <td>
          <div class="d-flex flex-column">
            <span class="fw-semibold text-dark" style="font-size: 13px;">
              <span class="material-symbols-outlined text-muted" style="font-size: 14px; vertical-align: text-bottom;">qr_code_2</span>
              ${escapeHTML(item.batch)}
            </span>
            <span class="badge-expiry-safe mt-1" style="font-size: 11px; width: fit-content;">
              <span class="material-symbols-outlined" style="font-size: 12px;">event_available</span>
              Val: ${escapeHTML(item.expiry)}
            </span>
          </div>
        </td>

        <td class="text-center">
          <span class="badge-farma-optimal px-2 py-1" style="font-size: 12px;">
            +${item.quantity} ${escapeHTML(item.unit || 'un.')}
          </span>
        </td>

        <td>
          <span class="d-block fw-semibold text-dark" style="font-size: 13px;">${escapeHTML(item.invoiceNumber)}</span>
          <small class="text-muted text-truncate d-block" style="font-size: 11px; max-width: 170px;" title="${escapeHTML(item.supplierOrigin)}">
            ${escapeHTML(item.supplierOrigin)}
          </small>
        </td>

        <td>
          <span style="font-size: 12px; white-space: nowrap;">
            ${dateDisplay}
          </span>
        </td>

        <td class="text-end">
          <div class="d-flex align-items-center justify-content-end gap-1">
            <button class="btn btn-sm text-primary p-1 btn-view-entry-receipt" data-id="${item.id}" title="Termo de Recebimento CAF">
              <span class="material-symbols-outlined" style="font-size: 18px;">description</span>
            </button>
            <button class="btn btn-sm text-danger p-1 btn-estorno-entry" data-id="${item.id}" data-name="${escapeHTML(item.medicine)}" title="Estornar entrada de estoque">
              <span class="material-symbols-outlined" style="font-size: 18px;">undo</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Atualiza os contadores das métricas superiores
 */
function updateStatistics() {
  const statTotalReceivings = document.getElementById('statTotalReceivings');
  const statTotalUnitsReceived = document.getElementById('statTotalUnitsReceived');
  const statTotalBatches = document.getElementById('statTotalBatches');

  const filtered = getFilteredReceivings();
  const totalReceivings = filtered.length;
  const totalUnits = filtered.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalBatches = new Set(filtered.map(item => item.batch)).size;

  if (statTotalReceivings) statTotalReceivings.textContent = totalReceivings;
  if (statTotalUnitsReceived) statTotalUnitsReceived.textContent = totalUnits.toLocaleString('pt-BR');
  if (statTotalBatches) statTotalBatches.textContent = totalBatches;
}

/**
 * Delegação de eventos da tabela e filtros
 */
function setupTableEventListeners() {
  const tbody = document.getElementById('receivingsTableBody');
  const btnReload = document.getElementById('btnReloadMockReceivings');
  const btnPopulateEmpty = document.getElementById('btnPopulateEmptyReceiving');
  const btnPrintReport = document.getElementById('btnPrintReceivingReport');
  const btnClearFilters = document.getElementById('btnClearRecFilters');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const estornoBtn = e.target.closest('.btn-estorno-entry');
      if (estornoBtn) {
        const id = estornoBtn.getAttribute('data-id');
        const medName = estornoBtn.getAttribute('data-name');
        openEstornoModal(id, medName);
        return;
      }

      const receiptBtn = e.target.closest('.btn-view-entry-receipt');
      if (receiptBtn) {
        const id = receiptBtn.getAttribute('data-id');
        openEntryReceiptModal(id);
      }
    });
  }

  // Relatório de Recebimento (impressão padrão A4 / SUS)
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      const filtered = getFilteredReceivings();
      const fromDate = document.getElementById('recDateFrom')?.value || '';
      const toDate = document.getElementById('recDateTo')?.value || '';
      const totalUnits = filtered.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const totalBatches = new Set(filtered.map(item => item.batch)).size;

      FarmaReport.print({
        title: 'RELATÓRIO DE RECEBIMENTO DE MEDICAMENTOS',
        period: FarmaReport.periodText(fromDate, toDate),
        summary: [
          ['Total de Entradas', `${filtered.length} registro(s)`],
          ['Total de Unidades Ingressadas', `${totalUnits.toLocaleString('pt-BR')}`],
          ['Lotes Distintos', `${totalBatches}`]
        ],
        groups: {
          title: 'Consolidação por Medicamento',
          head: ['Medicamento', 'Entradas', 'Total Ingressado'],
          rows: FarmaReport.groupByMedicine(filtered),
          aligns: ['left', 'center', 'right']
        },
        detail: {
          title: 'Detalhamento das Entradas',
          head: ['Data/Hora', 'Medicamento & Forma', 'Lote', 'Validade', 'Qtd.', 'Documento / Fornecedor'],
          rows: filtered.map(r => [
            `${FarmaStore.fmtDate(r.date)} ${r.time || ''}`,
            `${r.medicine} (${r.form})`,
            r.batch,
            r.expiry,
            `+${r.quantity} ${r.unit || 'un.'}`,
            `${r.invoiceNumber} • ${r.supplierOrigin}`
          ]),
          aligns: ['left', 'left', 'left', 'center', 'right', 'left']
        }
      });
    });
  }

  // Filtros por Range de Data
  ['recDateFrom', 'recDateTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        renderReceivingsTable();
        updateStatistics();
      });
    }
  });

  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      const df = document.getElementById('recDateFrom');
      const dt = document.getElementById('recDateTo');
      const si = document.getElementById('searchReceivingInput');
      if (df) df.value = '';
      if (dt) dt.value = '';
      if (si) si.value = '';
      renderReceivingsTable();
      updateStatistics();
    });
  }

  if (btnReload) {
    btnReload.addEventListener('click', () => {
      if (confirm('Deseja recarregar o ciclo completo de demonstração (setembro e outubro) com 8 medicamentos?')) {
        FarmaStore.resetAll();
        refreshInventory();
        loadReceivingsData();
        showToast('Histórico demonstrativo de entradas restaurado com sucesso!', 'info');
      }
    });
  }

  if (btnPopulateEmpty) {
    btnPopulateEmpty.addEventListener('click', () => {
      FarmaStore.resetAll();
      refreshInventory();
      loadReceivingsData();
      showToast('Entradas de exemplo carregadas com sucesso!', 'success');
    });
  }
}

/**
 * Configuração dos Modais
 */
function setupModals() {
  // Modal de Estorno
  const estornoModal = document.getElementById('estornoModal');
  const btnCancel = document.getElementById('btnCancelEstorno');
  const btnConfirm = document.getElementById('btnConfirmEstorno');

  if (btnCancel && estornoModal) {
    btnCancel.addEventListener('click', () => {
      estornoModal.style.display = 'none';
      pendingEstornoEntryId = null;
    });

    estornoModal.addEventListener('click', (e) => {
      if (e.target === estornoModal) {
        estornoModal.style.display = 'none';
        pendingEstornoEntryId = null;
      }
    });
  }

  if (btnConfirm && estornoModal) {
    btnConfirm.addEventListener('click', () => {
      if (pendingEstornoEntryId) {
        const item = receivingsList.find(m => m.id === pendingEstornoEntryId);
        const medName = item ? item.medicine : 'Medicamento';
        const qty = item ? item.quantity : 0;

        // Subtrai do estoque compartilhado
        if (item && item.medId) {
          FarmaStore.adjust(item.medId, -qty);
          refreshInventory();
        }

        receivingsList = receivingsList.filter(m => m.id !== pendingEstornoEntryId);
        saveToStorage();
        renderReceivingsTable();
        updateStatistics();
        showToast(`Entrada estornada. ${qty} un. de ${medName} deduzidas do estoque da UBS.`, 'warning');
      }
      estornoModal.style.display = 'none';
      pendingEstornoEntryId = null;
    });
  }

  // Modal de Termo de Recebimento
  const entryModal = document.getElementById('receiptEntryModal');
  const btnClose = document.getElementById('btnCloseEntryReceipt');
  const btnOk = document.getElementById('btnOkEntryReceipt');
  const btnPrint = document.getElementById('btnPrintEntryReceipt');

  const closeEntryModal = () => {
    if (entryModal) entryModal.style.display = 'none';
  };

  if (btnClose) btnClose.addEventListener('click', closeEntryModal);
  if (btnOk) btnOk.addEventListener('click', closeEntryModal);
  if (entryModal) {
    entryModal.addEventListener('click', (e) => {
      if (e.target === entryModal) closeEntryModal();
    });
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }
}

function openEstornoModal(id, medName) {
  pendingEstornoEntryId = id;
  const modal = document.getElementById('estornoModal');
  const desc = document.getElementById('estorno-modal-desc');

  if (desc) {
    desc.innerHTML = `Tem certeza que deseja estornar a entrada do medicamento <strong>${medName}</strong>? O saldo será deduzido do estoque da UBS.`;
  }

  if (modal) modal.style.display = 'flex';
}

function openEntryReceiptModal(id) {
  const item = receivingsList.find(m => m.id === id);
  if (!item) return;

  const modal = document.getElementById('receiptEntryModal');
  const content = document.getElementById('entryReceiptContent');

  if (content) {
    content.innerHTML = `
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="font-weight: 700; color: #001c6d; font-size: 14px; margin-bottom: 4px;">
          TERMO DE CONFERÊNCIA E RECEBIMENTO DE CARGA &bull; SUS
        </div>
        <div style="font-size: 11px; color: #64748B;">
          Secretaria Municipal de Saúde &bull; SMS Parnaíba/PI &bull; FarmaUBS Almoxarifado
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Medicamento Ingressado</strong>
          <span style="font-weight: 700; color: #001c6d; font-size: 14px;">${escapeHTML(item.medicine)}</span>
          <span style="font-size: 12px; color: #475569;">(${escapeHTML(item.form)})</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Quantidade Recebida</strong>
          <span style="font-weight: 700; color: #047857; font-size: 14px;">+${item.quantity} ${escapeHTML(item.unit || 'un.')}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Lote do Fabricante</strong>
          <span style="font-weight: 600;">${escapeHTML(item.batch)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Data de Validade</strong>
          <span class="badge-expiry-safe" style="font-size: 11px;">Val: ${escapeHTML(item.expiry)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Documento / NF</strong>
          <span>${escapeHTML(item.invoiceNumber)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Origem / Remetente</strong>
          <span>${escapeHTML(item.supplierOrigin)}</span>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
        <strong style="display: block; font-size: 11px; color: #475569; text-transform: uppercase; margin-bottom: 2px;">Laudo de Conformidade & Observações</strong>
        <span style="font-style: italic; color: #1e293b;">"${escapeHTML(item.notes)}"</span>
      </div>

      <div style="font-size: 11px; color: #64748B; text-align: right; margin-top: 8px;">
        Entrada Registrada em: <strong>${item.date ? FarmaStore.fmtDate(item.date) + ' às ' : ''}${escapeHTML(item.time || '')}</strong>
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

function setupSearchFilter() {
  const searchInput = document.getElementById('searchReceivingInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderReceivingsTable();
      updateStatistics();
    });
  }
}

function showToast(message, type = 'success') {
  const toastEl = document.getElementById('liveToast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toastEl) return;

  toastEl.className = 'toast align-items-center border-0 shadow-lg text-white';

  if (type === 'success') {
    toastEl.style.backgroundColor = '#047857';
    if (toastIcon) toastIcon.textContent = 'check_circle';
  } else if (type === 'warning') {
    toastEl.style.backgroundColor = '#b91c1c';
    if (toastIcon) toastIcon.textContent = 'undo';
  } else if (type === 'info') {
    toastEl.style.backgroundColor = '#0b3099';
    if (toastIcon) toastIcon.textContent = 'info';
  } else {
    toastEl.style.backgroundColor = '#334155';
    if (toastIcon) toastIcon.textContent = 'notifications';
  }

  if (toastMsg) toastMsg.textContent = message;

  const toastInstance = new bootstrap.Toast(toastEl, { delay: 3500 });
  toastInstance.show();
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
