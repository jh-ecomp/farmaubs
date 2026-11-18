// FarmaUBS - Lógica de Estoque Atual e Rastreabilidade Analítica (js/estoque.js)
// Conforme especificações do SUS e orientações farmacêuticas:
// - Lotes com validades dinâmicas (< 90 dias, < 180 dias e > 180 dias)
// - Regra Sanitária Fundamental: quando um medicamento está dividido em múltiplos lotes,
//   o alerta de "Estoque Baixo" ou "Crítico" avalia a SOMA de todos os lotes do medicamento,
//   e não cada lote isoladamente.
// - Nenhum estoque assume valores negativos.

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
  stockList = FarmaStore.load();
  renderStockTable();
  updateStockStatistics();
}

function saveStockStorage() {
  FarmaStore.save(stockList);
}

/**
 * Obtém o estoque total somado de todas as frações/lotes de um mesmo medicamento
 */
function getMedicineTotalStock(item, list = stockList) {
  const baseId = (item.medId || item.id).replace(/_l\d+$/, '');
  const medName = item.name;
  return list
    .filter(m => {
      const otherBaseId = (m.medId || m.id).replace(/_l\d+$/, '');
      return otherBaseId === baseId || m.name === medName;
    })
    .reduce((acc, m) => acc + (Number(m.stock) || 0), 0);
}

/**
 * Dias até a validade a contar de hoje (23/10/2026)
 */
function getDaysUntil(dateStr) {
  if (typeof FarmaStore !== 'undefined' && FarmaStore.daysUntilExpiry) {
    return FarmaStore.daysUntilExpiry(dateStr);
  }
  if (!dateStr) return 9999;
  let iso = dateStr;
  if (iso.includes('/')) {
    const p = iso.split('/');
    iso = `${p[2]}-${p[1]}-${p[0]}`;
  }
  const target = new Date(iso + 'T00:00:00');
  const today = new Date('2026-10-23T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
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

    // Regra Sanitária: Status avalia a SOMA de todos os lotes do medicamento
    const medTotalStock = getMedicineTotalStock(item, stockList);
    const minStock = item.minStock || 40;

    let medStatus = 'NORMAL';
    if (medTotalStock === 0) {
      medStatus = 'CRITICO';
    } else if (medTotalStock <= minStock) {
      medStatus = 'BAIXO';
    }

    // Filtro por Status
    let matchesStatus = true;
    if (selectedStatus === 'NORMAL') {
      matchesStatus = medStatus === 'NORMAL';
    } else if (selectedStatus === 'BAIXO') {
      matchesStatus = medStatus === 'BAIXO';
    } else if (selectedStatus === 'CRITICO') {
      matchesStatus = medStatus === 'CRITICO';
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
    const uniqueMeds = new Set(stockList.map(m => m.name)).size;
    footerSummary.textContent = `Exibindo ${filteredList.length} lotes de ${uniqueMeds} medicamentos cadastrados no estoque da UBS.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.name ? item.name.charAt(0).toUpperCase() : 'M';

    // Regra Sanitária: Status avalia a SOMA de todos os lotes do medicamento
    const medTotalStock = getMedicineTotalStock(item, stockList);
    const minStock = item.minStock || 40;

    let statusBadge = '';
    let rowBorderClass = '';
    if (medTotalStock === 0) {
      statusBadge = `<span class="badge-farma-rupture"><span class="material-symbols-outlined" style="font-size: 13px;">cancel</span> Esgotado</span>`;
      rowBorderClass = 'table-danger';
    } else if (medTotalStock <= minStock) {
      statusBadge = `<span class="badge-farma-warning" title="Soma dos lotes: ${medTotalStock} / Mínimo: ${minStock}"><span class="material-symbols-outlined" style="font-size: 13px;">warning</span> Baixo (${medTotalStock}/${minStock})</span>`;
    } else {
      statusBadge = `<span class="badge-farma-optimal" title="Soma total de lotes: ${medTotalStock} unid."><span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span> Normal</span>`;
    }

    // Validade com realces conforme regras sanitárias (< 90d, < 180d, regular)
    const days = getDaysUntil(item.expiryDate || item.expiry);
    let expiryBadge = '';
    if (days < 90) {
      expiryBadge = `
        <span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 d-inline-flex align-items-center gap-1" style="font-size: 11px;" title="Validade crítica: ${days} dias a contar de hoje (< 90 dias)">
          <span class="material-symbols-outlined" style="font-size: 13px;">event_busy</span>
          ${escapeHTML(item.expiry)} (&lt; 90d)
        </span>
      `;
    } else if (days < 180) {
      expiryBadge = `
        <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 d-inline-flex align-items-center gap-1" style="font-size: 11px;" title="Atenção sanitária: ${days} dias a contar de hoje (< 180 dias)">
          <span class="material-symbols-outlined" style="font-size: 13px;">warning</span>
          ${escapeHTML(item.expiry)} (&lt; 180d)
        </span>
      `;
    } else {
      expiryBadge = `
        <span class="badge-expiry-safe" style="font-size: 11px;" title="Validade regular: ${days} dias">
          <span class="material-symbols-outlined" style="font-size: 12px;">event_available</span>
          ${escapeHTML(item.expiry)}
        </span>
      `;
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
          ${expiryBadge}
        </td>

        <!-- Saldo deste Lote -->
        <td class="text-center">
          <strong class="d-block text-dark fs-6">${item.stock}</strong>
          <small class="text-muted" style="font-size: 11px;">${escapeHTML(item.unit)}</small>
        </td>

        <!-- Status / Nível de Abastecimento da Droga -->
        <td class="text-center">
          ${statusBadge}
        </td>

        <!-- Ações: Ajuste Rápido & Ficha do Lote -->
        <td class="text-end">
          <div class="d-flex align-items-center justify-content-end gap-1">
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="-10" title="Deduzir 10 unidades deste lote" style="font-size: 10px; border-radius: 4px;">-10</button>
            <button class="btn btn-outline-secondary btn-xs py-0 px-1 btn-adjust-stock" data-id="${item.id}" data-delta="10" title="Adicionar 10 unidades a este lote" style="font-size: 10px; border-radius: 4px;">+10</button>
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

  const uniqueMedNames = new Set(stockList.map(m => m.name));
  const totalMedicines = uniqueMedNames.size;
  const totalUnits = stockList.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0);

  // Alerta de estoque baixo considera a SOMA de todos os lotes de cada medicamento
  const lowStockCount = Array.from(uniqueMedNames).filter(name => {
    const items = stockList.filter(m => m.name === name);
    const sum = items.reduce((acc, m) => acc + (Number(m.stock) || 0), 0);
    const min = items[0]?.minStock || 40;
    return sum <= min;
  }).length;

  // Lotes com validade próxima (< 90 dias a contar de hoje 23/10/2026)
  const nearExpiryCount = stockList.filter(item => getDaysUntil(item.expiryDate || item.expiry) < 90).length;

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

  item.stock = Math.max(0, (Number(item.stock) || 0) + delta);
  saveStockStorage();
  renderStockTable();
  updateStockStatistics();

  const changeText = delta > 0 ? `+${delta}` : `${delta}`;
  showToast(`Lote ${item.batch} (${item.name}) ajustado: ${changeText} ${item.unit}`, 'info');
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
  const totalStockMed = getMedicineTotalStock(item);

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
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Saldo Físico Deste Lote</strong>
          <span style="font-weight: 700; color: #047857; font-size: 14px;">${item.stock} ${escapeHTML(item.unit)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Estoque Total do Medicamento</strong>
          <span style="font-weight: 700; color: #001c6d; font-size: 14px;">${totalStockMed} ${escapeHTML(item.unit)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Estoque Mínimo de Segurança</strong>
          <span>${item.minStock} ${escapeHTML(item.unit)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Laboratório Fabricante</strong>
          <span>${escapeHTML(item.manufacturer || 'Fornecedor SUS')}</span>
        </div>
        <div style="grid-column: span 2;">
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Localização na UBS</strong>
          <span>${escapeHTML(item.location || 'Farmácia Central')}</span>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 12px; color: #475569;">
        <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: text-bottom; color: #0b3099;">verified_user</span>
        Lote em conformidade com as diretrizes da Anvisa e Rename/SUS. Rastreabilidade PEPS / FEFO.
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
        FarmaStore.resetAll();
        loadStockData();
        showToast('Estoque padrão restaurado com sucesso!', 'info');
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
