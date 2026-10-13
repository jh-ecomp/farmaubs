// FarmaUBS - Lógica de Registro de Medicamentos e Tabela em Tempo Real (js/registro.js)

const STORAGE_KEY = 'farmaubs_medicamentos';

// Dados iniciais de demonstração (Medicamentos essenciais da Rename / SUS)
const DEFAULT_MEDICINES = [
  {
    id: 'med_1',
    name: 'Paracetamol',
    dosage: '500 mg',
    form: 'Comprimido',
    category: 'Analgésico / Antitérmico',
    batch: 'LT-2026A1',
    expiry: '2026-11-30',
    quantity: 350,
    minStock: 50
  },
  {
    id: 'med_2',
    name: 'Amoxicilina',
    dosage: '500 mg',
    form: 'Cápsula',
    category: 'Antibiótico',
    batch: 'LT-2025F4',
    expiry: '2027-04-15',
    quantity: 180,
    minStock: 40
  },
  {
    id: 'med_3',
    name: 'Losartana Potássica',
    dosage: '50 mg',
    form: 'Comprimido',
    category: 'Anti-hipertensivo',
    batch: 'LT-2026C9',
    expiry: '2026-12-31',
    quantity: 15,
    minStock: 30
  },
  {
    id: 'med_4',
    name: 'Dipirona Sódica',
    dosage: '500 mg/ml',
    form: 'Solução Oral / Gotas',
    category: 'Analgésico / Antitérmico',
    batch: 'LT-2027B2',
    expiry: '2027-08-20',
    quantity: 85,
    minStock: 25
  }
];

let medicinesList = [];
let pendingDeleteId = null;

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  loadMedicinesData();
  setupDefaultExpiryDate();
  setupFormEventListeners();
  setupTableEventListeners();
  setupSearchFilter();
  setupDeleteModal();
});

/**
 * Carrega a identificação da sessão salva no login
 */
function initUserSession() {
  const savedUser = localStorage.getItem('farmaubs_user');
  const navUserName = document.getElementById('navUserName');
  const navUserEmail = document.getElementById('navUserEmail');
  const userAvatar = document.getElementById('userAvatar');

  if (savedUser) {
    if (navUserEmail) navUserEmail.textContent = savedUser;
    
    // Extrai nome antes do @
    const namePart = savedUser.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    
    if (navUserName) navUserName.textContent = formattedName;
    if (userAvatar) userAvatar.textContent = namePart.charAt(0).toUpperCase();
  }
}

/**
 * Define data padrão para facilitar o teste (1 ano no futuro)
 */
function setupDefaultExpiryDate() {
  const expiryInput = document.getElementById('medExpiry');
  if (expiryInput && !expiryInput.value) {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 1);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expiryInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Lê do LocalStorage ou carrega a lista padrão
 */
function loadMedicinesData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      medicinesList = JSON.parse(stored);
    } else {
      medicinesList = [...DEFAULT_MEDICINES];
      saveToStorage();
    }
  } catch (e) {
    console.error('Erro ao ler do LocalStorage:', e);
    medicinesList = [...DEFAULT_MEDICINES];
  }

  renderMedicinesTable();
  updateStatistics();
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medicinesList));
  } catch (e) {
    console.error('Erro ao salvar no LocalStorage:', e);
  }
}

/**
 * Ouvintes do Formulário de Registro
 */
function setupFormEventListeners() {
  const medicineForm = document.getElementById('medicineForm');
  const btnReset = document.getElementById('btnResetForm');

  if (medicineForm) {
    medicineForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!medicineForm.checkValidity()) {
        e.stopPropagation();
        medicineForm.classList.add('was-validated');
        return;
      }

      const name = document.getElementById('medName').value.trim();
      const dosage = document.getElementById('medDosage').value.trim();
      const form = document.getElementById('medForm').value;
      const category = document.getElementById('medCategory').value;
      const batch = document.getElementById('medBatch').value.trim().toUpperCase();
      const expiry = document.getElementById('medExpiry').value;
      const quantity = parseInt(document.getElementById('medQuantity').value, 10);
      const minStock = parseInt(document.getElementById('medMinStock').value, 10) || 25;

      const newMedicine = {
        id: 'med_' + Date.now(),
        name,
        dosage,
        form,
        category,
        batch,
        expiry,
        quantity,
        minStock
      };

      // Adiciona no topo em tempo real
      medicinesList.unshift(newMedicine);
      saveToStorage();

      // Renderiza com destaque para a nova linha
      renderMedicinesTable(newMedicine.id);
      updateStatistics();

      showToast(`Medicamento "${name}" adicionado em tempo real!`, 'success');

      medicineForm.reset();
      medicineForm.classList.remove('was-validated');
      setupDefaultExpiryDate();

      document.getElementById('medName').focus();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      medicineForm.classList.remove('was-validated');
      setTimeout(setupDefaultExpiryDate, 50);
    });
  }
}

/**
 * Formata data no padrão brasileiro DD/MM/AAAA
 */
function formatDateBR(dateString) {
  if (!dateString) return '—';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Retorna classe e rótulo de estoque conforme padrão de cores FarmaUBS
 */
function getStockBadge(quantity, minStock) {
  if (quantity <= 0) {
    return {
      badgeClass: 'badge-farma-rupture',
      icon: 'cancel',
      label: 'Esgotado (0)'
    };
  }
  if (quantity <= minStock) {
    return {
      badgeClass: 'badge-farma-warning',
      icon: 'warning',
      label: `${quantity} unid. (Baixo)`
    };
  }
  return {
    badgeClass: 'badge-farma-optimal',
    icon: 'check_circle',
    label: `${quantity} unid.`
  };
}

/**
 * Renderiza a tabela de medicamentos em tempo real
 */
function renderMedicinesTable(highlightedId = null) {
  const tbody = document.getElementById('medicineTableBody');
  const emptyState = document.getElementById('emptyTableMessage');
  const badgeCount = document.getElementById('badgeItemCount');
  const footerSummary = document.getElementById('footerRecordSummary');
  const searchFilter = document.getElementById('searchTableInput')?.value.toLowerCase().trim() || '';

  if (!tbody) return;

  const filteredList = medicinesList.filter(item => {
    if (!searchFilter) return true;
    return (
      item.name.toLowerCase().includes(searchFilter) ||
      item.dosage.toLowerCase().includes(searchFilter) ||
      item.category.toLowerCase().includes(searchFilter) ||
      item.form.toLowerCase().includes(searchFilter) ||
      item.batch.toLowerCase().includes(searchFilter)
    );
  });

  if (badgeCount) {
    badgeCount.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'item' : 'itens'}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhum medicamento encontrado.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${medicinesList.length} medicamentos cadastrados.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const stockStatus = getStockBadge(item.quantity, item.minStock);
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.name ? item.name.charAt(0).toUpperCase() : 'M';

    return `
      <tr class="${isRowNew}" data-id="${item.id}">
        <td>
          <div class="d-flex align-items-center gap-2.5">
            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 32px; height: 32px; background-color: rgba(11, 48, 153, 0.1); color: #0b3099; font-size: 13px; flex-shrink: 0;">
              ${initial}
            </div>
            <div>
              <span class="d-block fw-semibold text-dark" style="font-size: 14px;">${escapeHTML(item.name)}</span>
              <span class="text-muted" style="font-size: 12px;">${escapeHTML(item.dosage)}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="badge-category-tag d-inline-block mb-1">${escapeHTML(item.form)}</span>
          <br>
          <small class="text-secondary" style="font-size: 11px; font-weight: 500;">${escapeHTML(item.category)}</small>
        </td>
        <td>
          <span class="d-block fw-semibold text-dark" style="font-size: 13px;">${escapeHTML(item.batch)}</span>
          <small class="text-muted" style="font-size: 11px;">
            Validade: ${formatDateBR(item.expiry)}
          </small>
        </td>
        <td class="text-center">
          <span class="${stockStatus.badgeClass}">
            <span class="material-symbols-outlined" style="font-size: 14px;">${stockStatus.icon}</span>
            <span>${stockStatus.label}</span>
          </span>
          <div class="mt-1 d-flex justify-content-center gap-1">
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="-10" title="Subtrair 10 unidades" style="font-size: 10px; border-radius: 4px;">-10</button>
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="10" title="Adicionar 10 unidades" style="font-size: 10px; border-radius: 4px;">+10</button>
          </div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm text-secondary p-1 btn-delete-item" data-id="${item.id}" data-name="${escapeHTML(item.name)}" title="Remover este medicamento">
            <span class="material-symbols-outlined text-danger" style="font-size: 18px;">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Atualiza os contadores das caixas de estatísticas
 */
function updateStatistics() {
  const statTotalItems = document.getElementById('statTotalItems');
  const statTotalUnits = document.getElementById('statTotalUnits');
  const statLowStock = document.getElementById('statLowStock');

  const totalMedicines = medicinesList.length;
  const totalUnits = medicinesList.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const lowStockCount = medicinesList.filter(item => item.quantity <= item.minStock).length;

  if (statTotalItems) statTotalItems.textContent = totalMedicines;
  if (statTotalUnits) statTotalUnits.textContent = totalUnits.toLocaleString('pt-BR');
  if (statLowStock) statLowStock.textContent = lowStockCount;
}

/**
 * Delegação de eventos da tabela (Ajuste rápido de estoque e Exclusão)
 */
function setupTableEventListeners() {
  const tbody = document.getElementById('medicineTableBody');
  const btnReloadMockData = document.getElementById('btnReloadMockData');
  const btnPopulateEmpty = document.getElementById('btnPopulateEmpty');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      // Excluir
      const deleteBtn = e.target.closest('.btn-delete-item');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        const name = deleteBtn.getAttribute('data-name');
        openDeleteModal(id, name);
        return;
      }

      // Ajustar estoque
      const adjustBtn = e.target.closest('.btn-adjust-stock');
      if (adjustBtn) {
        const id = adjustBtn.getAttribute('data-id');
        const delta = parseInt(adjustBtn.getAttribute('data-delta'), 10);
        adjustMedicineStock(id, delta);
      }
    });
  }

  if (btnReloadMockData) {
    btnReloadMockData.addEventListener('click', () => {
      medicinesList = [...DEFAULT_MEDICINES];
      saveToStorage();
      renderMedicinesTable();
      updateStatistics();
      showToast('Medicamentos padrão do SUS restaurados!', 'info');
    });
  }

  if (btnPopulateEmpty) {
    btnPopulateEmpty.addEventListener('click', () => {
      medicinesList = [...DEFAULT_MEDICINES];
      saveToStorage();
      renderMedicinesTable();
      updateStatistics();
      showToast('Medicamentos carregados com sucesso!', 'success');
    });
  }
}

/**
 * Ajusta quantidade de estoque instantaneamente
 */
function adjustMedicineStock(id, delta) {
  const item = medicinesList.find(m => m.id === id);
  if (!item) return;

  item.quantity = Math.max(0, item.quantity + delta);
  saveToStorage();
  renderMedicinesTable();
  updateStatistics();

  const changeText = delta > 0 ? `+${delta}` : `${delta}`;
  showToast(`Estoque de "${item.name}" atualizado (${changeText} unid.)`, 'info');
}

/**
 * Configura o modal acessível "FarmaUBS diz:" para exclusão
 */
function setupDeleteModal() {
  const modal = document.getElementById('deleteModal');
  const btnCancel = document.getElementById('btnCancelDelete');
  const btnConfirm = document.getElementById('btnConfirmDelete');

  if (btnCancel && modal) {
    btnCancel.addEventListener('click', () => {
      modal.style.display = 'none';
      pendingDeleteId = null;
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        pendingDeleteId = null;
      }
    });
  }

  if (btnConfirm && modal) {
    btnConfirm.addEventListener('click', () => {
      if (pendingDeleteId) {
        const item = medicinesList.find(m => m.id === pendingDeleteId);
        const name = item ? item.name : 'Medicamento';
        medicinesList = medicinesList.filter(m => m.id !== pendingDeleteId);
        saveToStorage();
        renderMedicinesTable();
        updateStatistics();
        showToast(`"${name}" removido do estoque.`, 'warning');
      }
      modal.style.display = 'none';
      pendingDeleteId = null;
    });
  }
}

function openDeleteModal(id, name) {
  pendingDeleteId = id;
  const modal = document.getElementById('deleteModal');
  const modalDesc = document.getElementById('delete-modal-desc');

  if (modalDesc) {
    modalDesc.innerHTML = `Tem certeza que deseja remover o medicamento <strong>${name}</strong> do estoque da unidade?`;
  }

  if (modal) {
    modal.style.display = 'flex';
  }
}

/**
 * Filtro em tempo real na busca
 */
function setupSearchFilter() {
  const searchInput = document.getElementById('searchTableInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderMedicinesTable();
    });
  }
}

/**
 * Exibe notificação Toast flutuante
 */
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
    if (toastIcon) toastIcon.textContent = 'delete';
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
