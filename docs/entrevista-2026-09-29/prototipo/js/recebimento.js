// FarmaUBS - Lógica de Recebimento de Medicamentos / Entrada de Estoque (js/recebimento.js)

const RECEIVINGS_STORAGE_KEY = 'farmaubs_recebimentos';

// Catálogo de Medicamentos da UBS
const INVENTORY_MEDICINES = [
  {
    id: 'inv_1',
    name: 'Paracetamol 500 mg',
    form: 'Comprimido',
    batch: 'LT-2026A1',
    expiry: '2026-11-30',
    stock: 350,
    unit: 'unid.'
  },
  {
    id: 'inv_2',
    name: 'Amoxicilina 500 mg',
    form: 'Cápsula',
    batch: 'LT-2025F4',
    expiry: '2027-04-15',
    stock: 180,
    unit: 'unid.'
  },
  {
    id: 'inv_3',
    name: 'Losartana Potássica 50 mg',
    form: 'Comprimido',
    batch: 'LT-2026C9',
    expiry: '2026-12-31',
    stock: 15,
    unit: 'unid.'
  },
  {
    id: 'inv_4',
    name: 'Dipirona Sódica 500 mg/ml',
    form: 'Solução Oral / Gotas',
    batch: 'LT-2027B2',
    expiry: '2027-08-20',
    stock: 85,
    unit: 'frascos'
  },
  {
    id: 'inv_5',
    name: 'Ibuprofeno 600 mg',
    form: 'Comprimido',
    batch: 'LT-2026M8',
    expiry: '2026-10-10',
    stock: 120,
    unit: 'unid.'
  },
  {
    id: 'inv_6',
    name: 'Glibenclamida 5 mg',
    form: 'Comprimido',
    batch: 'LT-2027K3',
    expiry: '2027-03-25',
    stock: 200,
    unit: 'unid.'
  },
  {
    id: 'inv_7',
    name: 'Omeprazol 20 mg',
    form: 'Cápsula',
    batch: 'LT-2026X1',
    expiry: '2026-09-18',
    stock: 90,
    unit: 'unid.'
  },
  {
    id: 'inv_8',
    name: 'Sinvastatina 20 mg',
    form: 'Comprimido',
    batch: 'LT-2027S4',
    expiry: '2027-06-05',
    stock: 140,
    unit: 'unid.'
  }
];

// Dados Iniciais de Demonstração para Entradas de Estoque
const DEFAULT_RECEIVINGS = [
  {
    id: 'rec_1',
    medicine: 'Paracetamol 500 mg',
    form: 'Comprimido',
    batch: 'LT-2026A1',
    expiry: '30/11/2026',
    quantity: 1000,
    unit: 'unid.',
    invoiceNumber: 'GUIA-CAF-2026/098',
    supplierOrigin: 'CAF Central - SMS Parnaíba',
    notes: 'Remessa mensal regular • Lote conforme',
    time: 'Hoje, 08:30'
  },
  {
    id: 'rec_2',
    medicine: 'Amoxicilina 500 mg',
    form: 'Cápsula',
    batch: 'LT-2025F4',
    expiry: '15/04/2027',
    quantity: 500,
    unit: 'unid.',
    invoiceNumber: 'NF-e 003.882',
    supplierOrigin: 'Ministério da Saúde (DLOG / SUS)',
    notes: 'Programa Farmácia Básica',
    time: 'Hoje, 09:15'
  },
  {
    id: 'rec_3',
    medicine: 'Dipirona Sódica 500 mg/ml',
    form: 'Solução Oral / Gotas',
    batch: 'LT-2027B2',
    expiry: '20/08/2027',
    quantity: 120,
    unit: 'frascos',
    invoiceNumber: 'GUIA-CAF-2026/102',
    supplierOrigin: 'CAF Central - SMS Parnaíba',
    notes: 'Reposição emergencial',
    time: 'Hoje, 10:00'
  }
];

let receivingsList = [];
let pendingEstornoEntryId = null;

document.addEventListener('DOMContentLoaded', () => {
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

    // Sugere o lote atual ou permite alteração para nova remessa
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
  try {
    const stored = localStorage.getItem(RECEIVINGS_STORAGE_KEY);
    if (stored) {
      receivingsList = JSON.parse(stored);
    } else {
      receivingsList = [...DEFAULT_RECEIVINGS];
      saveToStorage();
    }
  } catch (e) {
    console.error('Erro ao ler do LocalStorage:', e);
    receivingsList = [...DEFAULT_RECEIVINGS];
  }

  renderReceivingsTable();
  updateStatistics();
}

function saveToStorage() {
  try {
    localStorage.setItem(RECEIVINGS_STORAGE_KEY, JSON.stringify(receivingsList));
  } catch (e) {
    console.error('Erro ao salvar no LocalStorage:', e);
  }
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

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `Hoje, ${hours}:${minutes}`;

    const newReceiving = {
      id: 'rec_' + Date.now(),
      medId: med.id,
      medicine: med.name,
      form: med.form,
      batch: batch,
      expiry: expiryFormatted,
      quantity: quantity,
      unit: med.unit,
      invoiceNumber: invoiceNumber.value.trim(),
      supplierOrigin: supplierOrigin.value,
      notes: recNotes.value.trim() || 'Conferência física realizada sem divergências',
      time: time
    };

    // Atualiza saldo em estoque
    med.stock += quantity;
    med.batch = batch; // Atualiza lote para o novo recebido

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
 * Renderiza a Tabela de Recebimentos em Tempo Real
 */
function renderReceivingsTable(highlightedId = null) {
  const tbody = document.getElementById('receivingsTableBody');
  const emptyState = document.getElementById('emptyReceivingMessage');
  const badgeCount = document.getElementById('badgeReceivingCount');
  const footerSummary = document.getElementById('footerReceivingSummary');
  const searchFilter = document.getElementById('searchReceivingInput')?.value.toLowerCase().trim() || '';

  if (!tbody) return;

  const filteredList = receivingsList.filter(item => {
    if (!searchFilter) return true;
    return (
      item.medicine.toLowerCase().includes(searchFilter) ||
      item.batch.toLowerCase().includes(searchFilter) ||
      item.invoiceNumber.toLowerCase().includes(searchFilter) ||
      item.supplierOrigin.toLowerCase().includes(searchFilter)
    );
  });

  if (badgeCount) {
    badgeCount.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'entrada' : 'entradas'}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhum recebimento encontrado.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${receivingsList.length} entradas de estoque.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.medicine ? item.medicine.charAt(0).toUpperCase() : 'M';

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
          <span class="text-muted" style="font-size: 12px; white-space: nowrap;">
            ${escapeHTML(item.time)}
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

  const totalReceivings = receivingsList.length;
  const totalUnits = receivingsList.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalBatches = new Set(receivingsList.map(item => item.batch)).size;

  if (statTotalReceivings) statTotalReceivings.textContent = totalReceivings;
  if (statTotalUnitsReceived) statTotalUnitsReceived.textContent = totalUnits.toLocaleString('pt-BR');
  if (statTotalBatches) statTotalBatches.textContent = totalBatches;
}

/**
 * Delegação de eventos da tabela (Estorno e Termo de Recebimento)
 */
function setupTableEventListeners() {
  const tbody = document.getElementById('receivingsTableBody');
  const btnReload = document.getElementById('btnReloadMockReceivings');
  const btnPopulateEmpty = document.getElementById('btnPopulateEmptyReceiving');

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

  if (btnReload) {
    btnReload.addEventListener('click', () => {
      receivingsList = [...DEFAULT_RECEIVINGS];
      saveToStorage();
      renderReceivingsTable();
      updateStatistics();
      showToast('Histórico demonstrativo de entradas restaurado!', 'info');
    });
  }

  if (btnPopulateEmpty) {
    btnPopulateEmpty.addEventListener('click', () => {
      receivingsList = [...DEFAULT_RECEIVINGS];
      saveToStorage();
      renderReceivingsTable();
      updateStatistics();
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

        // Subtrai do catálogo
        if (item && item.medId) {
          const invMed = INVENTORY_MEDICINES.find(m => m.id === item.medId);
          if (invMed) {
            invMed.stock = Math.max(0, invMed.stock - qty);
          }
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
        Entrada Registrada em: <strong>${escapeHTML(item.time)}</strong>
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
