// FarmaUBS - Lógica de Estoque Atual e Rastreabilidade Analítica (js/estoque.js)

const CATALOG_STORAGE_KEY = 'farmaubs_catalogo_estoque';

// Dados Padrão do Estoque da UBS
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
    batch: 'LT-2026X1',
    expiry: '18/09/2026',
    expiryDate: '2026-09-18',
    stock: 90,
    minStock: 30,
    unit: 'unid.',
    manufacturer: 'Germed Farmacêutica',
    location: 'Prateleira D1 - Gástricos'
  },
  {
    id: 'inv_8',
    name: 'Sinvastatina',
    dosage: '20 mg',
    form: 'Comprimido',
    category: 'Anti-hipertensivo',
    batch: 'LT-2027S4',
    expiry: '05/06/2027',
    expiryDate: '2027-06-05',
    stock: 140,
    minStock: 40,
    unit: 'unid.',
    manufacturer: 'Sandoz do Brasil',
    location: 'Prateleira C3 - Hipertensão/Diabetes'
  }
];

let stockList = [];

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
  loadStockData();
  setupFilterListeners();
  setupTableActions();
  setupLotModal();
  setupGlobalActions();
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
 * Lê o estoque sincronizado do LocalStorage
 */
function loadStockData() {
  try {
    const stored = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (stored) {
      stockList = JSON.parse(stored);
    } else {
      stockList = [...DEFAULT_CATALOG];
      saveStockStorage();
    }
  } catch (e) {
    console.error('Erro ao ler estoque:', e);
    stockList = [...DEFAULT_CATALOG];
  }

  renderStockTable();
  updateStockStatistics();
}

function saveStockStorage() {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(stockList));
  } catch (e) {
    console.error('Erro ao salvar estoque:', e);
  }
}

/**
 * Renderiza a Tabela de Estoque Atual com base nos filtros
 */
function renderStockTable(highlightedId = null) {
  const tbody = document.getElementById('stockTableBody');
  const emptyState = document.getElementById('emptyStockMessage');
  const footerSummary = document.getElementById('footerStockSummary');

  const searchQuery = document.getElementById('searchStockInput')?.value.toLowerCase().trim() || '';
  const selectedCategory = document.getElementById('categoryFilter')?.value || 'ALL';
  const selectedStatus = document.getElementById('stockStatusFilter')?.value || 'ALL';

  if (!tbody) return;

  const filteredList = stockList.filter(item => {
    // Busca textual
    const matchesSearch = !searchQuery || (
      item.name.toLowerCase().includes(searchQuery) ||
      item.dosage.toLowerCase().includes(searchQuery) ||
      item.batch.toLowerCase().includes(searchQuery) ||
      item.form.toLowerCase().includes(searchQuery)
    );

    // Filtro por Categoria
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    // Filtro por Status
    let matchesStatus = true;
    if (selectedStatus === 'NORMAL') {
      matchesStatus = item.stock > item.minStock;
    } else if (selectedStatus === 'BAIXO') {
      matchesStatus = item.stock > 0 && item.stock <= item.minStock;
    } else if (selectedStatus === 'CRITICO') {
      matchesStatus = item.stock === 0;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhum medicamento encontrado para os filtros selecionados.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${stockList.length} itens cadastrados no estoque da UBS.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.name ? item.name.charAt(0).toUpperCase() : 'M';
    
    // Status do Estoque
    let statusBadge = '';
    let rowBorderClass = '';
    if (item.stock === 0) {
      statusBadge = `<span class="badge-farma-rupture"><span class="material-symbols-outlined" style="font-size: 13px;">cancel</span> Esgotado</span>`;
      rowBorderClass = 'table-danger';
    } else if (item.stock <= item.minStock) {
      statusBadge = `<span class="badge-farma-warning"><span class="material-symbols-outlined" style="font-size: 13px;">warning</span> Baixo (${item.stock}/${item.minStock})</span>`;
    } else {
      statusBadge = `<span class="badge-farma-optimal"><span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span> Normal</span>`;
    }

    return `
      <tr class="${isRowNew} ${rowBorderClass}" data-id="${item.id}">
        <!-- Medicamento & Dosagem -->
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 32px; height: 32px; background-color: rgba(11, 48, 153, 0.1); color: #0b3099; font-size: 13px; flex-shrink: 0;">
              ${initial}
            </div>
            <div>
              <span class="d-block fw-bold text-dark" style="font-size: 14px;">${escapeHTML(item.name)}</span>
              <small class="text-muted" style="font-size: 12px;">${escapeHTML(item.dosage)}</small>
            </div>
          </div>
        </td>

        <!-- Forma & Categoria -->
        <td>
          <span class="badge-category-tag mb-1 d-inline-block" style="font-size: 11px;">${escapeHTML(item.form)}</span>
          <br>
          <small class="text-secondary fw-semibold" style="font-size: 11px;">${escapeHTML(item.category)}</small>
        </td>

        <!-- Lote Farmacêutico -->
        <td>
          <span class="fw-semibold text-dark d-flex align-items-center gap-1" style="font-size: 13px;">
            <span class="material-symbols-outlined text-muted" style="font-size: 15px;">qr_code_2</span>
            ${escapeHTML(item.batch)}
          </span>
          <small class="text-muted" style="font-size: 11px;">${escapeHTML(item.location || 'Farmácia UBS')}</small>
        </td>

        <!-- Validade Sanitária -->
        <td>
          <span class="badge-expiry-safe" style="font-size: 11px;">
            <span class="material-symbols-outlined" style="font-size: 12px;">event_available</span>
            ${escapeHTML(item.expiry)}
          </span>
        </td>

        <!-- Saldo em Estoque -->
        <td class="text-center">
          <strong class="d-block text-dark fs-6">${item.stock}</strong>
          <small class="text-muted" style="font-size: 11px;">${escapeHTML(item.unit)}</small>
        </td>

        <!-- Status / Nível de Abastecimento -->
        <td class="text-center">
          ${statusBadge}
        </td>

        <!-- Ações: Ajuste Rápido & Ficha do Lote -->
        <td class="text-end">
          <div class="d-flex align-items-center justify-content-end gap-1">
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="-10" title="Deduzir 10 unidades" style="font-size: 10px; border-radius: 4px;">-10</button>
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="10" title="Adicionar 10 unidades" style="font-size: 10px; border-radius: 4px;">+10</button>
            <button class="btn btn-sm text-primary p-1 btn-view-lot-detail" data-id="${item.id}" title="Ficha de Rastreabilidade">
              <span class="material-symbols-outlined" style="font-size: 18px;">info</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Atualiza os contadores das métricas analíticas no topo
 */
function updateStockStatistics() {
  const statTotalItems = document.getElementById('statTotalItems');
  const statTotalUnits = document.getElementById('statTotalUnits');
  const statLowStock = document.getElementById('statLowStock');
  const statNearExpiry = document.getElementById('statNearExpiry');

  const totalMedicines = stockList.length;
  const totalUnits = stockList.reduce((acc, curr) => acc + (curr.stock || 0), 0);
  const lowStockCount = stockList.filter(item => item.stock <= item.minStock).length;
  
  // Itens com validade próxima (ano 2026)
  const nearExpiryCount = stockList.filter(item => item.expiry && item.expiry.includes('2026')).length;

  if (statTotalItems) statTotalItems.textContent = totalMedicines;
  if (statTotalUnits) statTotalUnits.textContent = totalUnits.toLocaleString('pt-BR');
  if (statLowStock) statLowStock.textContent = lowStockCount;
  if (statNearExpiry) statNearExpiry.textContent = nearExpiryCount;
}

/**
 * Configura ouvintes dos filtros e campo de busca
 */
function setupFilterListeners() {
  const searchInput = document.getElementById('searchStockInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const stockStatusFilter = document.getElementById('stockStatusFilter');
  const btnReset = document.getElementById('btnResetFilters');

  if (searchInput) searchInput.addEventListener('input', () => renderStockTable());
  if (categoryFilter) categoryFilter.addEventListener('change', () => renderStockTable());
  if (stockStatusFilter) stockStatusFilter.addEventListener('change', () => renderStockTable());

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (categoryFilter) categoryFilter.value = 'ALL';
      if (stockStatusFilter) stockStatusFilter.value = 'ALL';
      renderStockTable();
    });
  }
}

/**
 * Ações de ajuste rápido (+ / -) e visualização de lote na tabela
 */
function setupTableActions() {
  const tbody = document.getElementById('stockTableBody');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      // Ajuste de quantidade (+10 / -10)
      const adjustBtn = e.target.closest('.btn-adjust-stock');
      if (adjustBtn) {
        const id = adjustBtn.getAttribute('data-id');
        const delta = parseInt(adjustBtn.getAttribute('data-delta'), 10);
        adjustStockAmount(id, delta);
        return;
      }

      // Visualizar ficha detalhada do lote
      const detailBtn = e.target.closest('.btn-view-lot-detail');
      if (detailBtn) {
        const id = detailBtn.getAttribute('data-id');
        openLotDetailModal(id);
      }
    });
  }
}

function adjustStockAmount(id, delta) {
  const item = stockList.find(m => m.id === id);
  if (!item) return;

  item.stock = Math.max(0, item.stock + delta);
  saveStockStorage();
  renderStockTable();
  updateStockStatistics();

  const changeText = delta > 0 ? `+${delta}` : `${delta}`;
  showToast(`Estoque de "${item.name}" ajustado (${changeText} ${item.unit})`, 'info');
}

/**
 * Modal "FarmaUBS diz:" com Ficha do Lote
 */
function setupLotModal() {
  const modal = document.getElementById('lotDetailModal');
  const btnClose = document.getElementById('btnCloseLotModal');
  const btnOk = document.getElementById('btnOkLotModal');

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnOk) btnOk.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}

function openLotDetailModal(id) {
  const item = stockList.find(m => m.id === id);
  if (!item) return;

  const modal = document.getElementById('lotDetailModal');
  const content = document.getElementById('lotDetailContent');

  if (content) {
    content.innerHTML = `
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="font-weight: 700; color: #001c6d; font-size: 14px; margin-bottom: 2px;">
          ${escapeHTML(item.name)} ${escapeHTML(item.dosage)}
        </div>
        <div style="font-size: 12px; color: #64748B;">
          Forma: ${escapeHTML(item.form)} &bull; Categoria: ${escapeHTML(item.category)}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Lote Registrado</strong>
          <span style="font-weight: 700; color: #0F172A; font-size: 14px;">${escapeHTML(item.batch)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Validade Sanitária</strong>
          <span class="badge-expiry-safe" style="font-size: 12px;">${escapeHTML(item.expiry)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Saldo Físico Atual</strong>
          <span style="font-weight: 700; color: #047857; font-size: 14px;">${item.stock} ${escapeHTML(item.unit)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Estoque de Segurança (Mínimo)</strong>
          <span>${item.minStock} ${escapeHTML(item.unit)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Laboratório Fabricante</strong>
          <span>${escapeHTML(item.manufacturer || 'Fornecedor SUS')}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Localização na UBS</strong>
          <span>${escapeHTML(item.location || 'Farmácia Central')}</span>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 12px; color: #475569;">
        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: text-bottom; color: #0b3099;">verified_user</span>
        Lote em conformidade com as diretrizes da Anvisa e Rename/SUS.
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

/**
 * Ações Globais: Imprimir Relatório e Restaurar Dados
 */
function setupGlobalActions() {
  const btnPrint = document.getElementById('btnPrintReport');
  const btnReload = document.getElementById('btnReloadDefaultStock');

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnReload) {
    btnReload.addEventListener('click', () => {
      if (confirm('Deseja restaurar as quantidades e lotes padrão do estoque da UBS?')) {
        stockList = [...DEFAULT_CATALOG];
        saveStockStorage();
        renderStockTable();
        updateStockStatistics();
        showToast('Estoque padrão restaurado!', 'info');
      }
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
    if (toastIcon) toastIcon.textContent = 'warning';
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
