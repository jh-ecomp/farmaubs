// FarmaUBS - Lógica de Dispensação com Foco na Hierarquia do Medicamento (js/dispensacao.js)

// Medicamentos em estoque (lidos do estoque compartilhado: js/estoque-store.js)
let INVENTORY_MEDICINES = [];

function refreshInventory() {
  INVENTORY_MEDICINES = FarmaStore.load().map(m => ({
    id: m.id,
    medId: m.medId || m.id.replace(/_l\d+$/, ''),
    name: `${m.name} ${m.dosage}`,
    baseName: m.name,
    dosage: m.dosage,
    form: m.form,
    batch: m.batch,
    expiry: m.expiry,
    expiryRaw: m.expiryDate,
    stock: m.stock,
    unit: m.unit
  }));
}

/**
 * Agrupa os lotes do inventário por medicamento base e ordena por FEFO
 * (First Expired, First Out - primeiro lote com saldo > 0 e validade mais próxima)
 */
function getMedicineGroups() {
  const groupsMap = new Map();

  INVENTORY_MEDICINES.forEach(med => {
    const key = med.medId;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        medId: key,
        name: med.name,
        baseName: med.baseName,
        dosage: med.dosage,
        form: med.form,
        unit: med.unit,
        lots: [],
        totalStock: 0
      });
    }
    const group = groupsMap.get(key);
    group.lots.push(med);
    group.totalStock += (Number(med.stock) || 0);
  });

  const groups = Array.from(groupsMap.values());

  // Ordenação dos lotes pelo princípio FEFO:
  // 1. Lotes com saldo > 0 têm prioridade sobre lotes esgotados
  // 2. Data de validade mais próxima (menor expiryDate) vem primeiro
  groups.forEach(group => {
    group.lots.sort((a, b) => {
      const stockA = Number(a.stock) || 0;
      const stockB = Number(b.stock) || 0;
      if ((stockA > 0) !== (stockB > 0)) {
        return stockB > 0 ? 1 : -1;
      }
      const expA = a.expiryRaw || a.expiryDate || a.expiry;
      const expB = b.expiryRaw || b.expiryDate || b.expiry;
      return expA.localeCompare(expB);
    });

    // Lote recomendado pelo FEFO (com saldo > 0, ou primeiro se todos zerados)
    group.fefoLot = group.lots.find(l => (Number(l.stock) || 0) > 0) || group.lots[0];
  });

  return groups;
}

// Estado da Aplicação
let dispensationsList = [];
let currentRecipeItems = [];
let pendingEstornoId = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshInventory();
  initUserSession();
  initMedicineCombobox();
  loadDispensationsData();
  setupAddItemToRecipe();
  setupFinalizeRecipe();
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
 * Inicializa o Combobox com Pesquisa em Tempo Real e Seleção FEFO de Medicamentos/Lotes
 */
function initMedicineCombobox() {
  const medSearchInput = document.getElementById('medSearchInput');
  const selectedMedId = document.getElementById('selectedMedId');
  const medDropdownList = document.getElementById('medDropdownList');
  const btnClearMedSearch = document.getElementById('btnClearMedSearch');
  const medDropdownArrow = document.getElementById('medDropdownArrow');
  const medComboboxWrapper = document.getElementById('medComboboxWrapper');
  const medInfoPanel = document.getElementById('medInfoPanel');
  const medBatchSelect = document.getElementById('medBatchSelect');
  const infoExpiry = document.getElementById('infoExpiry');
  const infoExpiryBadge = document.getElementById('infoExpiryBadge');
  const infoStock = document.getElementById('infoStock');
  const unitLabel = document.getElementById('unitLabel');
  const dispenseQuantity = document.getElementById('dispenseQuantity');

  let currentSelectedGroup = null;

  if (!medSearchInput || !medDropdownList) return;

  function renderDropdown(filterText = '') {
    const query = filterText.toLowerCase().trim();
    const groups = getMedicineGroups();

    const filtered = groups.filter(g => {
      if (!query) return true;
      const matchName = g.name.toLowerCase().includes(query);
      const matchForm = g.form.toLowerCase().includes(query);
      const matchBatch = g.lots.some(l => l.batch.toLowerCase().includes(query));
      return matchName || matchForm || matchBatch;
    });

    if (filtered.length === 0) {
      medDropdownList.innerHTML = `
        <div class="farma-dropdown-empty">
          <span class="material-symbols-outlined d-block text-muted mb-1" style="font-size: 24px;">search_off</span>
          Nenhum medicamento encontrado para <strong>"${escapeHTML(filterText)}"</strong>.
        </div>
      `;
      medDropdownList.style.display = 'block';
      return;
    }

    medDropdownList.innerHTML = filtered.map(g => {
      let highlightedName = escapeHTML(g.name);
      if (query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        highlightedName = highlightedName.replace(regex, '<mark class="bg-warning bg-opacity-50 p-0 text-dark fw-bold">$1</mark>');
      }

      return `
        <div class="farma-dropdown-item" data-med-id="${g.medId}">
          <div class="d-flex align-items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size: 18px;">pill</span>
            <div>
              <span class="d-block fw-semibold text-dark" style="font-size: 13px;">${highlightedName}</span>
              <small class="text-muted" style="font-size: 11px;">${escapeHTML(g.form)}</small>
            </div>
          </div>
          <div class="text-end ps-2">
            <small class="fw-semibold text-primary" style="font-size: 11px;">
              Estoque: ${g.totalStock} ${escapeHTML(g.unit)}
            </small>
          </div>
        </div>
      `;
    }).join('');

    medDropdownList.style.display = 'block';

    const items = medDropdownList.querySelectorAll('.farma-dropdown-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const medId = item.getAttribute('data-med-id');
        const groups = getMedicineGroups();
        const group = groups.find(g => g.medId === medId);
        if (group) selectMedicineGroup(group);
      });
    });
  }

  /**
   * Seleciona o medicamento aplicando automaticamente o princípio FEFO
   * e populando o menu suspenso com os lotes disponíveis
   */
  function selectMedicineGroup(group, targetLotId = null) {
    currentSelectedGroup = group;
    const fefoLot = group.fefoLot;
    const activeLot = (targetLotId && group.lots.find(l => l.id === targetLotId)) || fefoLot;

    medSearchInput.value = `${group.name} (${group.form})`;
    medDropdownList.style.display = 'none';
    if (btnClearMedSearch) btnClearMedSearch.style.display = 'block';

    // Popula o seletor com somente os códigos de lote
    populateLotDropdown(group, activeLot);

    // Atualiza os dados no grid 2x2 com os selos restaurados
    updateLotDisplay(activeLot, fefoLot, group);

    if (unitLabel) unitLabel.textContent = group.unit;

    if (dispenseQuantity) {
      dispenseQuantity.value = group.unit === 'frascos' ? '1' : String(Math.min(30, Math.max(1, activeLot.stock || 1)));
      dispenseQuantity.max = String(activeLot.stock);
      dispenseQuantity.focus();
    }

    medSearchInput.classList.remove('is-invalid');
  }

  /**
   * Preenche o seletor mostrando SOMENTE o lote (ex: LT-2026C9)
   */
  function populateLotDropdown(group, activeLot) {
    if (!medBatchSelect) return;

    medBatchSelect.innerHTML = group.lots.map(lot => {
      return `<option value="${lot.id}" ${lot.id === activeLot.id ? 'selected' : ''}>${escapeHTML(lot.batch)}</option>`;
    }).join('');
  }

  /**
   * Atualiza os 4 quadrantes (2 linhas x 2 colunas):
   * 1. Lote + Selo FEFO (FEFO Recomendado / Lote Alternativo)
   * 2. Data de Vencimento (apenas a data) + Selo Sanitário de Prazo (Verde > 180d, Amarelo 90-180d, Vermelho < 90d)
   * 3. Estoque Disponível do Lote
   * 4. Estoque Consolidado na UBS
   */
  function updateLotDisplay(activeLot, fefoLot, group) {
    const parentGroup = group || currentSelectedGroup;
    const refFefo = fefoLot || (parentGroup ? parentGroup.fefoLot : null);

    selectedMedId.value = activeLot.id;

    // 1. Selo FEFO do Lote
    const fefoBadge = document.getElementById('fefoBadge');
    if (fefoBadge && refFefo) {
      const isFefo = (activeLot.id === refFefo.id);
      if (isFefo) {
        fefoBadge.className = 'badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1';
        fefoBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 12px;">verified</span> FEFO Recomendado';
      } else {
        fefoBadge.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-inline-flex align-items-center gap-1';
        fefoBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 12px;">swap_horiz</span> Lote Alternativo';
      }
    }

    // 2. Data de Vencimento (apenas a data com cor conforme prazo: verde > 180d, amarelo 90-180d, vermelho < 90d)
    if (infoExpiry) {
      infoExpiry.textContent = activeLot.expiry;
    }

    const days = FarmaStore.daysUntilExpiry ? FarmaStore.daysUntilExpiry(activeLot.expiryRaw || activeLot.expiry) : 999;
    const badge = document.getElementById('infoExpiryBadge');

    if (badge) {
      if (days < 90) {
        // Vermelho se vence em menos de 90 dias
        badge.className = 'badge-expiry-danger';
      } else if (days <= 180) {
        // Amarelo se vence de 90 até 180 dias
        badge.className = 'badge-expiry-warning';
      } else {
        // Verde se tem mais de 180 dias para o vencimento
        badge.className = 'badge-expiry-safe';
      }
    }

    // 3. Estoque Atual do Lote Selecionado
    if (infoStock) {
      infoStock.textContent = `${activeLot.stock} ${activeLot.unit}`;
    }

    // 4. Estoque Consolidado na UBS (Todos os Lotes)
    const infoTotalStock = document.getElementById('infoTotalStock');
    if (infoTotalStock && parentGroup) {
      const lotsCount = parentGroup.lots ? parentGroup.lots.length : 1;
      const lotsSuffix = lotsCount > 1 ? ` (${lotsCount} lotes)` : ' (lote único)';
      infoTotalStock.textContent = `${parentGroup.totalStock} ${parentGroup.unit}${lotsSuffix}`;
    }

    if (dispenseQuantity) {
      dispenseQuantity.max = String(activeLot.stock);
    }

    if (medInfoPanel) {
      medInfoPanel.style.display = 'grid';
    }
  }

  // Evento de alteração no Menu Suspenso de Lote pelo farmacêutico
  if (medBatchSelect) {
    medBatchSelect.addEventListener('change', () => {
      if (!currentSelectedGroup) return;
      const selectedLotId = medBatchSelect.value;
      const chosenLot = currentSelectedGroup.lots.find(l => l.id === selectedLotId);
      if (chosenLot) {
        updateLotDisplay(chosenLot, currentSelectedGroup.fefoLot, currentSelectedGroup);
        if (dispenseQuantity) {
          const currentVal = parseInt(dispenseQuantity.value, 10) || 0;
          if (currentVal > chosenLot.stock) {
            dispenseQuantity.value = String(Math.max(1, chosenLot.stock));
          }
        }
      }
    });
  }

  window.clearMedicineSelection = function() {
    currentSelectedGroup = null;
    selectedMedId.value = '';
    medSearchInput.value = '';
    if (medBatchSelect) medBatchSelect.innerHTML = '';
    if (btnClearMedSearch) btnClearMedSearch.style.display = 'none';
    if (medInfoPanel) medInfoPanel.style.display = 'none';
    medDropdownList.style.display = 'none';
    medSearchInput.focus();
  };

  medSearchInput.addEventListener('input', () => {
    selectedMedId.value = '';
    if (medInfoPanel) medInfoPanel.style.display = 'none';
    if (btnClearMedSearch) {
      btnClearMedSearch.style.display = medSearchInput.value.length > 0 ? 'block' : 'none';
    }
    renderDropdown(medSearchInput.value);
  });

  medSearchInput.addEventListener('focus', () => {
    renderDropdown(medSearchInput.value);
  });

  if (medDropdownArrow) {
    medDropdownArrow.addEventListener('click', (e) => {
      e.stopPropagation();
      if (medDropdownList.style.display === 'block') {
        medDropdownList.style.display = 'none';
      } else {
        medSearchInput.focus();
        renderDropdown(medSearchInput.value);
      }
    });
  }

  if (btnClearMedSearch) {
    btnClearMedSearch.addEventListener('click', (e) => {
      e.stopPropagation();
      window.clearMedicineSelection();
    });
  }

  document.addEventListener('click', (e) => {
    if (medComboboxWrapper && !medComboboxWrapper.contains(e.target)) {
      medDropdownList.style.display = 'none';
    }
  });

  medSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      medDropdownList.style.display = 'none';
    }
  });
}

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Adiciona um medicamento à lista da receita atual
 */
function setupAddItemToRecipe() {
  const addItemForm = document.getElementById('addItemForm');
  const selectedMedId = document.getElementById('selectedMedId');
  const medSearchInput = document.getElementById('medSearchInput');
  const dispenseQuantity = document.getElementById('dispenseQuantity');
  const posologyInstructions = document.getElementById('posologyInstructions');

  if (!addItemForm) return;

  addItemForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const medId = selectedMedId.value;
    const med = INVENTORY_MEDICINES.find(m => m.id === medId);

    if (!med) {
      e.stopPropagation();
      if (medSearchInput) {
        medSearchInput.classList.add('is-invalid');
        medSearchInput.focus();
      }
      return;
    }

    if (!addItemForm.checkValidity()) {
      e.stopPropagation();
      addItemForm.classList.add('was-validated');
      return;
    }

    const quantity = parseInt(dispenseQuantity.value, 10);
    const posology = posologyInstructions.value.trim();

    // Impede dispensar mais do que o saldo (considerando itens já adicionados à receita)
    const alreadyInRecipe = currentRecipeItems
      .filter(i => i.medId === med.id)
      .reduce((acc, i) => acc + i.quantity, 0);
    const available = med.stock - alreadyInRecipe;
    if (quantity > available) {
      showToast(`Estoque insuficiente de "${med.name}": ${available} ${med.unit} disponíveis.`, 'warning');
      dispenseQuantity.focus();
      return;
    }

    const recipeItem = {
      tempId: 'item_' + Date.now() + Math.random().toString(36).substr(2, 4),
      medId: med.id,
      name: med.name,
      form: med.form,
      batch: med.batch,
      expiry: med.expiry,
      quantity,
      unit: med.unit,
      posology: posology || 'Uso conforme orientação médica'
    };

    currentRecipeItems.push(recipeItem);
    renderCurrentRecipeItems();

    showToast(`"${med.name}" (${quantity} ${med.unit}) adicionado à receita!`, 'info');

    if (window.clearMedicineSelection) {
      window.clearMedicineSelection();
    }
    posologyInstructions.value = '';
    addItemForm.classList.remove('was-validated');

    medSearchInput.focus();
  });
}

/**
 * Renderiza a lista de medicamentos da receita atual
 */
function renderCurrentRecipeItems() {
  const recipeItemsList = document.getElementById('recipeItemsList');
  const recipeActions = document.getElementById('recipeActions');
  const recipeItemBadge = document.getElementById('recipeItemBadge');
  const recipeTotalUnits = document.getElementById('recipeTotalUnits');

  if (!recipeItemsList) return;

  const count = currentRecipeItems.length;
  if (recipeItemBadge) {
    recipeItemBadge.textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  }

  if (count === 0) {
    recipeItemsList.innerHTML = `
      <p class="text-muted small text-center my-3" id="recipeEmptyNotice" style="font-size: 12px;">
        Nenhum medicamento adicionado à receita ainda.<br>Selecione um item acima e clique em <strong>"+ Adicionar Medicamento"</strong>.
      </p>
    `;
    if (recipeActions) recipeActions.style.setProperty('display', 'none', 'important');
    return;
  }

  if (recipeActions) recipeActions.style.setProperty('display', 'flex', 'important');

  const totalUnits = currentRecipeItems.reduce((acc, curr) => acc + curr.quantity, 0);
  if (recipeTotalUnits) {
    recipeTotalUnits.textContent = `${totalUnits} unid.`;
  }

  recipeItemsList.innerHTML = currentRecipeItems.map((item, index) => {
    return `
      <div class="recipe-item-row" data-temp-id="${item.tempId}">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary rounded-circle d-flex align-items-center justify-content-center" style="width: 22px; height: 22px; font-size: 11px; background-color: #001c6d !important;">
            ${index + 1}
          </span>
          <div>
            <strong class="d-block text-dark" style="font-size: 13px;">${escapeHTML(item.name)}</strong>
            <small class="text-muted" style="font-size: 11px;">
              Lote: <span class="fw-semibold text-secondary">${escapeHTML(item.batch)}</span> &bull; 
              Val: <span class="fw-semibold text-success">${escapeHTML(item.expiry)}</span>
            </small>
            ${item.posology ? `<div class="text-muted" style="font-size: 11px; font-style: italic;">"${escapeHTML(item.posology)}"</div>` : ''}
          </div>
        </div>

        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          <span class="badge-farma-optimal" style="font-size: 12px;">
            ${item.quantity} ${escapeHTML(item.unit)}
          </span>
          <button type="button" class="btn btn-sm text-danger p-0 btn-remove-recipe-item" data-temp-id="${item.tempId}" title="Remover este item da receita">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const removeButtons = recipeItemsList.querySelectorAll('.btn-remove-recipe-item');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tempId = btn.getAttribute('data-temp-id');
      currentRecipeItems = currentRecipeItems.filter(item => item.tempId !== tempId);
      renderCurrentRecipeItems();
    });
  });
}

/**
 * Conclui a dispensação de todos os itens da receita atual
 */
function setupFinalizeRecipe() {
  const btnFinalizeRecipe = document.getElementById('btnFinalizeRecipe');
  const patientDocInput = document.getElementById('patientDoc');

  if (!btnFinalizeRecipe) return;

  btnFinalizeRecipe.addEventListener('click', () => {
    if (currentRecipeItems.length === 0) {
      alert('Adicione pelo menos um medicamento à receita antes de concluir.');
      return;
    }

    const patientDoc = patientDocInput ? patientDocInput.value.trim() : '';

    const date = FarmaStore.today();
    const time = FarmaStore.nowTime();
    const recipeId = 'rx_' + Date.now();

    const newDispensations = [];

    currentRecipeItems.forEach(item => {
      const record = {
        id: 'disp_' + Date.now() + Math.random().toString(36).substr(2, 4),
        recipeId: recipeId,
        medId: item.medId,
        medicine: item.name,
        form: item.form,
        batch: item.batch,
        expiry: item.expiry,
        quantity: item.quantity,
        unit: item.unit,
        patientDoc: patientDoc,
        posology: item.posology,
        date: date,
        time: time
      };

      newDispensations.push(record);
      dispensationsList.unshift(record);

      // Baixa no estoque compartilhado
      FarmaStore.adjust(item.medId, -item.quantity);
    });

    refreshInventory();
    saveToStorage();
    renderDispensationsTable(newDispensations[0]?.id);
    updateStatistics();

    showToast(`Dispensação concluída com sucesso! ${currentRecipeItems.length} medicamento(s) baixado(s) no estoque.`, 'success');

    currentRecipeItems = [];
    renderCurrentRecipeItems();
    if (patientDocInput) patientDocInput.value = '';
    const medSearchInput = document.getElementById('medSearchInput');
    if (medSearchInput) medSearchInput.focus();
  });
}

/**
 * Carrega a lista de dispensações do LocalStorage
 */
function loadDispensationsData() {
  dispensationsList = FarmaStore.loadDispensations();
  renderDispensationsTable();
  updateStatistics();
}

function saveToStorage() {
  FarmaStore.saveDispensations(dispensationsList);
}

/**
 * Retorna lista filtrada de dispensações
 */
function getFilteredDispensations() {
  const fromDate = document.getElementById('dispDateFrom')?.value || '';
  const toDate = document.getElementById('dispDateTo')?.value || '';
  const searchFilter = document.getElementById('searchTableInput')?.value.toLowerCase().trim() || '';

  return dispensationsList.filter(item => {
    if (fromDate || toDate) {
      if (!FarmaStore.inRange(item.date, fromDate, toDate)) return false;
    }
    if (!searchFilter) return true;
    return (
      item.medicine.toLowerCase().includes(searchFilter) ||
      item.batch.toLowerCase().includes(searchFilter) ||
      (item.patientDoc && item.patientDoc.toLowerCase().includes(searchFilter)) ||
      (item.posology && item.posology.toLowerCase().includes(searchFilter))
    );
  });
}

/**
 * Renderiza a tabela de Dispensações com base no filtro e pesquisa
 */
function renderDispensationsTable(highlightedId = null) {
  const tbody = document.getElementById('dispensationsTableBody');
  const emptyState = document.getElementById('emptyTableMessage');
  const badgeCount = document.getElementById('badgeItemCount');
  const footerSummary = document.getElementById('footerRecordSummary');

  if (!tbody) return;

  const filteredList = getFilteredDispensations();

  if (badgeCount) {
    badgeCount.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'item' : 'itens'}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhuma dispensa encontrada no período/busca.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${dispensationsList.length} dispensas registradas.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.medicine ? item.medicine.charAt(0).toUpperCase() : 'M';
    const patientDisplay = item.patientDoc 
      ? `<span class="badge-cnes-sus py-0 px-1 me-1" style="font-size: 10px;">CNS</span>${escapeHTML(item.patientDoc)}`
      : `<span class="badge bg-light text-muted border py-0 px-1" style="font-size: 10px;">Não informado</span>`;

    const isToday = item.date === FarmaStore.today();
    const dateDisplay = item.date
      ? (isToday ? `<span class="fw-semibold text-primary">Hoje, ${item.time || ''}</span>` : `<span class="fw-semibold text-dark">${FarmaStore.fmtDate(item.date)}</span> <small class="text-muted d-block" style="font-size: 11px;">${item.time || ''}</small>`)
      : (item.time || '—');

    return `
      <tr class="${isRowNew}" data-id="${item.id}">
        <!-- 1. Qual é o Medicamento & Forma -->
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle d-flex align-items-center justify-content-center fw-bold" style="width: 32px; height: 32px; background-color: rgba(11, 48, 153, 0.1); color: #0b3099; font-size: 13px; flex-shrink: 0;">
              ${initial}
            </div>
            <div>
              <span class="d-block fw-bold text-dark" style="font-size: 14px;">${escapeHTML(item.medicine)}</span>
              <span class="badge-category-tag" style="font-size: 10px;">${escapeHTML(item.form || 'Medicamento')}</span>
              ${item.posology ? `<span class="d-block text-muted text-truncate" style="font-size: 11px; max-width: 220px;" title="${escapeHTML(item.posology)}">${escapeHTML(item.posology)}</span>` : ''}
            </div>
          </div>
        </td>

        <!-- 2. Lote & Data de Vencimento -->
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

        <!-- 3. Quantidade Dispensada -->
        <td class="text-center">
          <span class="badge-farma-optimal px-2 py-1" style="font-size: 12px;">
            ${item.quantity} ${escapeHTML(item.unit || 'un.')}
          </span>
        </td>

        <!-- 4. Cartão SUS (Opcional) -->
        <td>
          <small class="text-secondary" style="font-size: 12px;">
            ${patientDisplay}
          </small>
        </td>

        <!-- 5. Data / Horário -->
        <td>
          <span style="font-size: 12px; white-space: nowrap;">
            ${dateDisplay}
          </span>
        </td>

        <!-- 6. Ações -->
        <td class="text-end">
          <div class="d-flex align-items-center justify-content-end gap-1">
            <button class="btn btn-sm text-primary p-1 btn-view-receipt" data-id="${item.id}" title="Comprovante de Dispensação SUS">
              <span class="material-symbols-outlined" style="font-size: 18px;">receipt</span>
            </button>
            <button class="btn btn-sm text-danger p-1 btn-estorno-item" data-id="${item.id}" data-name="${escapeHTML(item.medicine)}" title="Estornar dispensação (devolver ao estoque)">
              <span class="material-symbols-outlined" style="font-size: 18px;">undo</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Atualiza os contadores das caixas de métricas superiores
 */
function updateStatistics() {
  const statTotalDispensations = document.getElementById('statTotalDispensations');
  const statTotalUnitsDispensed = document.getElementById('statTotalUnitsDispensed');
  const statTotalRecipes = document.getElementById('statTotalRecipes');

  const filtered = getFilteredDispensations();
  const totalDispensations = filtered.length;
  const totalUnits = filtered.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const estimatedRecipes = new Set(filtered.map(item => item.recipeId || (item.date + item.time + (item.patientDoc || 'anon')))).size;

  if (statTotalDispensations) statTotalDispensations.textContent = totalDispensations;
  if (statTotalUnitsDispensed) statTotalUnitsDispensed.textContent = totalUnits.toLocaleString('pt-BR');
  if (statTotalRecipes) statTotalRecipes.textContent = estimatedRecipes;
}

/**
 * Delegação de eventos da tabela (Estorno, Comprovante e Relatório)
 */
function setupTableEventListeners() {
  const tbody = document.getElementById('dispensationsTableBody');
  const btnReloadMockData = document.getElementById('btnReloadMockData');
  const btnPopulateEmpty = document.getElementById('btnPopulateEmpty');
  const btnPrintReport = document.getElementById('btnPrintDispensationsReport');
  const btnClearFilters = document.getElementById('btnClearDispFilters');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const estornoBtn = e.target.closest('.btn-estorno-item');
      if (estornoBtn) {
        const id = estornoBtn.getAttribute('data-id');
        const medName = estornoBtn.getAttribute('data-name');
        openEstornoModal(id, medName);
        return;
      }

      const receiptBtn = e.target.closest('.btn-view-receipt');
      if (receiptBtn) {
        const id = receiptBtn.getAttribute('data-id');
        openReceiptModal(id);
      }
    });
  }

  // Relatório Consolidado de Dispensações
  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      const filtered = getFilteredDispensations();
      const fromDate = document.getElementById('dispDateFrom')?.value || '';
      const toDate = document.getElementById('dispDateTo')?.value || '';
      const totalUnits = filtered.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const recipes = new Set(filtered.map(i => i.recipeId || (i.date + i.time + (i.patientDoc || 'anon')))).size;

      FarmaReport.print({
        title: 'RELATÓRIO DE DISPENSAÇÃO DE MEDICAMENTOS',
        period: FarmaReport.periodText(fromDate, toDate),
        summary: [
          ['Total de Saídas / Itens', `${filtered.length} item(ns)`],
          ['Total de Unidades Baixadas', `${totalUnits.toLocaleString('pt-BR')}`],
          ['Receitas Atendidas', `${recipes}`]
        ],
        groups: {
          title: 'Consolidação por Medicamento',
          head: ['Medicamento', 'Dispensas', 'Total Baixado'],
          rows: FarmaReport.groupByMedicine(filtered),
          aligns: ['left', 'center', 'right']
        },
        detail: {
          title: 'Detalhamento das Dispensações',
          head: ['Data/Hora', 'Medicamento & Forma', 'Lote', 'Qtd.', 'Cartão SUS', 'Posologia'],
          rows: filtered.map(r => [
            `${FarmaStore.fmtDate(r.date)} ${r.time || ''}`,
            r.medicine,
            r.batch,
            `${r.quantity} ${r.unit || 'un.'}`,
            r.patientDoc || 'Não informado',
            r.posology || '—'
          ]),
          aligns: ['left', 'left', 'left', 'center', 'left', 'left']
        }
      });
    });
  }

  // Filtros de Data
  ['dispDateFrom', 'dispDateTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        renderDispensationsTable();
        updateStatistics();
      });
    }
  });

  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      const df = document.getElementById('dispDateFrom');
      const dt = document.getElementById('dispDateTo');
      const si = document.getElementById('searchTableInput');
      if (df) df.value = '';
      if (dt) dt.value = '';
      if (si) si.value = '';
      renderDispensationsTable();
      updateStatistics();
    });
  }

  if (btnReloadMockData) {
    btnReloadMockData.addEventListener('click', () => {
      if (confirm('Deseja recarregar o histórico de demonstração (dezenas de dispensações em setembro e outubro)?')) {
        FarmaStore.resetAll();
        refreshInventory();
        loadDispensationsData();
        showToast('Dispensas de exemplo restauradas com sucesso!', 'info');
      }
    });
  }

  if (btnPopulateEmpty) {
    btnPopulateEmpty.addEventListener('click', () => {
      FarmaStore.resetAll();
      refreshInventory();
      loadDispensationsData();
      showToast('Dispensas carregadas com sucesso!', 'success');
    });
  }
}

/**
 * Configuração dos Modais
 */
function setupModals() {
  // Modal de Estorno
  const deleteModal = document.getElementById('deleteModal');
  const btnCancelDelete = document.getElementById('btnCancelDelete');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');

  if (btnCancelDelete && deleteModal) {
    btnCancelDelete.addEventListener('click', () => {
      deleteModal.style.display = 'none';
      pendingEstornoId = null;
    });

    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        deleteModal.style.display = 'none';
        pendingEstornoId = null;
      }
    });
  }

  if (btnConfirmDelete && deleteModal) {
    btnConfirmDelete.addEventListener('click', () => {
      if (pendingEstornoId) {
        const item = dispensationsList.find(m => m.id === pendingEstornoId);
        const medName = item ? item.medicine : 'Medicamento';
        const qty = item ? item.quantity : 0;

        const invMed = item && INVENTORY_MEDICINES.find(m => m.id === item.medId || m.name === item.medicine);
        if (invMed) {
          FarmaStore.adjust(invMed.id, qty);
          refreshInventory();
        }

        dispensationsList = dispensationsList.filter(m => m.id !== pendingEstornoId);
        saveToStorage();
        renderDispensationsTable();
        updateStatistics();
        showToast(`Dispensação estornada. ${qty} un. de ${medName} devolvidas ao estoque da UBS.`, 'warning');
      }
      deleteModal.style.display = 'none';
      pendingEstornoId = null;
    });
  }

  // Modal de Comprovante
  const receiptModal = document.getElementById('receiptModal');
  const btnCloseReceipt = document.getElementById('btnCloseReceipt');
  const btnOkReceipt = document.getElementById('btnOkReceipt');
  const btnPrintReceipt = document.getElementById('btnPrintReceipt');

  const closeReceipt = () => {
    if (receiptModal) receiptModal.style.display = 'none';
  };

  if (btnCloseReceipt) btnCloseReceipt.addEventListener('click', closeReceipt);
  if (btnOkReceipt) btnOkReceipt.addEventListener('click', closeReceipt);
  if (receiptModal) {
    receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) closeReceipt();
    });
  }

  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => {
      window.print();
    });
  }
}

function openEstornoModal(id, medName) {
  pendingEstornoId = id;
  const modal = document.getElementById('deleteModal');
  const modalDesc = document.getElementById('delete-modal-desc');

  if (modalDesc) {
    modalDesc.innerHTML = `Tem certeza que deseja estornar a dispensação do medicamento <strong>${medName}</strong>? A quantidade será reincorporada ao estoque da UBS.`;
  }

  if (modal) modal.style.display = 'flex';
}

function openReceiptModal(id) {
  const item = dispensationsList.find(m => m.id === id);
  if (!item) return;

  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptContent');

  if (content) {
    content.innerHTML = `
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="font-weight: 700; color: #001c6d; font-size: 14px; margin-bottom: 4px;">
          COMPROVANTE DE DISPENSAÇÃO FARMACÊUTICA &bull; SUS
        </div>
        <div style="font-size: 11px; color: #64748B;">
          Secretaria Municipal de Saúde &bull; SMS Parnaíba/PI &bull; FarmaUBS
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Medicamento</strong>
          <span style="font-weight: 700; color: #001c6d; font-size: 14px;">${escapeHTML(item.medicine)}</span>
          <span style="font-size: 12px; color: #475569;">(${escapeHTML(item.form || 'Medicamento')})</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Quantidade Entregue</strong>
          <span style="font-weight: 700; color: #047857; font-size: 14px;">${item.quantity} ${escapeHTML(item.unit || 'un.')}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Lote</strong>
          <span style="font-weight: 600;">${escapeHTML(item.batch)}</span>
        </div>
        <div>
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Data de Vencimento</strong>
          <span class="badge-expiry-safe" style="font-size: 11px;">Val: ${escapeHTML(item.expiry)}</span>
        </div>
        <div style="grid-column: span 2;">
          <strong style="display: block; font-size: 11px; color: #64748B; text-transform: uppercase;">Cartão SUS do Paciente</strong>
          <span>${item.patientDoc ? escapeHTML(item.patientDoc) : 'Demanda espontânea (Não informado)'}</span>
        </div>
      </div>

      ${item.posology ? `
        <div style="background-color: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 8px;">
          <strong style="display: block; font-size: 11px; color: #475569; text-transform: uppercase; margin-bottom: 2px;">Posologia / Orientações</strong>
          <span style="font-style: italic; color: #1e293b;">"${escapeHTML(item.posology)}"</span>
        </div>
      ` : ''}

      <div style="font-size: 11px; color: #64748B; text-align: right; margin-top: 8px;">
        Registro: <strong>${item.date ? FarmaStore.fmtDate(item.date) + ' às ' : ''}${escapeHTML(item.time || '')}</strong>
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

function setupSearchFilter() {
  const searchInput = document.getElementById('searchTableInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderDispensationsTable();
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
