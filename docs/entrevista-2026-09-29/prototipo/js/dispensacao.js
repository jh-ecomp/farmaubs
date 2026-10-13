// FarmaUBS - Lógica de Dispensação com Foco na Hierarquia do Medicamento (js/dispensacao.js)

const DISPENSATIONS_STORAGE_KEY = 'farmaubs_ultimas_dispensas';

// Catálogo de Medicamentos em Estoque na UBS com Lote, Validade e Saldo
const INVENTORY_MEDICINES = [
  {
    id: 'inv_1',
    name: 'Paracetamol 500 mg',
    form: 'Comprimido',
    batch: 'LT-2026A1',
    expiry: '30/11/2026',
    expiryRaw: '2026-11-30',
    stock: 350,
    unit: 'unid.'
  },
  {
    id: 'inv_2',
    name: 'Amoxicilina 500 mg',
    form: 'Cápsula',
    batch: 'LT-2025F4',
    expiry: '15/04/2027',
    expiryRaw: '2027-04-15',
    stock: 180,
    unit: 'unid.'
  },
  {
    id: 'inv_3',
    name: 'Losartana Potássica 50 mg',
    form: 'Comprimido',
    batch: 'LT-2026C9',
    expiry: '31/12/2026',
    expiryRaw: '2026-12-31',
    stock: 15,
    unit: 'unid.'
  },
  {
    id: 'inv_4',
    name: 'Dipirona Sódica 500 mg/ml',
    form: 'Solução Oral / Gotas',
    batch: 'LT-2027B2',
    expiry: '20/08/2027',
    expiryRaw: '2027-08-20',
    stock: 85,
    unit: 'frascos'
  },
  {
    id: 'inv_5',
    name: 'Ibuprofeno 600 mg',
    form: 'Comprimido',
    batch: 'LT-2026M8',
    expiry: '10/10/2026',
    expiryRaw: '2026-10-10',
    stock: 120,
    unit: 'unid.'
  },
  {
    id: 'inv_6',
    name: 'Glibenclamida 5 mg',
    form: 'Comprimido',
    batch: 'LT-2027K3',
    expiry: '25/03/2027',
    expiryRaw: '2027-03-25',
    stock: 200,
    unit: 'unid.'
  },
  {
    id: 'inv_7',
    name: 'Omeprazol 20 mg',
    form: 'Cápsula',
    batch: 'LT-2026X1',
    expiry: '18/09/2026',
    expiryRaw: '2026-09-18',
    stock: 90,
    unit: 'unid.'
  },
  {
    id: 'inv_8',
    name: 'Sinvastatina 20 mg',
    form: 'Comprimido',
    batch: 'LT-2027S4',
    expiry: '05/06/2027',
    expiryRaw: '2027-06-05',
    stock: 140,
    unit: 'unid.'
  }
];

// Dados iniciais de demonstração para a lista de últimas dispensas
const DEFAULT_DISPENSATIONS = [
  {
    id: 'disp_1',
    medicine: 'Paracetamol 500 mg',
    form: 'Comprimido',
    batch: 'LT-2026A1',
    expiry: '30/11/2026',
    quantity: 30,
    unit: 'unid.',
    patientDoc: '702 4819 3302 0004',
    posology: '1 cp de 8/8h por 5 dias',
    time: 'Hoje, 11:20'
  },
  {
    id: 'disp_2',
    medicine: 'Amoxicilina 500 mg',
    form: 'Cápsula',
    batch: 'LT-2025F4',
    expiry: '15/04/2027',
    quantity: 21,
    unit: 'unid.',
    patientDoc: '702 4819 3302 0004',
    posology: '1 cap de 8/8h por 7 dias',
    time: 'Hoje, 11:20'
  },
  {
    id: 'disp_3',
    medicine: 'Losartana Potássica 50 mg',
    form: 'Comprimido',
    batch: 'LT-2026C9',
    expiry: '31/12/2026',
    quantity: 60,
    unit: 'unid.',
    patientDoc: '891 0029 4812 0019',
    posology: '1 cp pela manhã em jejum contínuo',
    time: 'Hoje, 10:45'
  },
  {
    id: 'disp_4',
    medicine: 'Dipirona Sódica 500 mg/ml',
    form: 'Solução Oral / Gotas',
    batch: 'LT-2027B2',
    expiry: '20/08/2027',
    quantity: 1,
    unit: 'frasco',
    patientDoc: '',
    posology: '30 gotas em caso de dor ou febre',
    time: 'Hoje, 09:30'
  }
];

// Estado da Aplicação
let dispensationsList = [];
let currentRecipeItems = [];
let pendingEstornoId = null;

document.addEventListener('DOMContentLoaded', () => {
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
 * Inicializa o Combobox com Pesquisa e Filtro em Tempo Real de Medicamentos
 */
function initMedicineCombobox() {
  const medSearchInput = document.getElementById('medSearchInput');
  const selectedMedId = document.getElementById('selectedMedId');
  const medDropdownList = document.getElementById('medDropdownList');
  const btnClearMedSearch = document.getElementById('btnClearMedSearch');
  const medDropdownArrow = document.getElementById('medDropdownArrow');
  const medComboboxWrapper = document.getElementById('medComboboxWrapper');
  const medInfoPanel = document.getElementById('medInfoPanel');
  const infoBatch = document.getElementById('infoBatch');
  const infoExpiry = document.getElementById('infoExpiry');
  const infoStock = document.getElementById('infoStock');
  const unitLabel = document.getElementById('unitLabel');
  const dispenseQuantity = document.getElementById('dispenseQuantity');

  if (!medSearchInput || !medDropdownList) return;

  // Renderiza a lista filtrada no dropdown em tempo real
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
      medDropdownList.innerHTML = `
        <div class="farma-dropdown-empty">
          <span class="material-symbols-outlined d-block text-muted mb-1" style="font-size: 24px;">search_off</span>
          Nenhum medicamento encontrado para <strong>"${escapeHTML(filterText)}"</strong>.
        </div>
      `;
      medDropdownList.style.display = 'block';
      return;
    }

    medDropdownList.innerHTML = filtered.map(med => {
      // Destaque visual no termo pesquisado
      let highlightedName = escapeHTML(med.name);
      if (query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        highlightedName = highlightedName.replace(regex, '<mark class="bg-warning bg-opacity-50 p-0 text-dark fw-bold">$1</mark>');
      }

      return `
        <div class="farma-dropdown-item" data-id="${med.id}">
          <div class="d-flex align-items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size: 18px;">pill</span>
            <div>
              <span class="d-block fw-semibold text-dark" style="font-size: 13px;">${highlightedName}</span>
              <small class="text-muted" style="font-size: 11px;">
                ${escapeHTML(med.form)} &bull; Lote: <strong class="text-secondary">${escapeHTML(med.batch)}</strong>
              </small>
            </div>
          </div>
          <div class="text-end ps-2">
            <span class="badge-expiry-safe d-block mb-1" style="font-size: 10px;">
              Val: ${escapeHTML(med.expiry)}
            </span>
            <small class="fw-semibold text-primary" style="font-size: 11px;">
              Est: ${med.stock} ${escapeHTML(med.unit)}
            </small>
          </div>
        </div>
      `;
    }).join('');

    medDropdownList.style.display = 'block';

    // Eventos de clique para selecionar o medicamento filtrado
    const items = medDropdownList.querySelectorAll('.farma-dropdown-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const medId = item.getAttribute('data-id');
        const med = INVENTORY_MEDICINES.find(m => m.id === medId);
        if (med) selectMedicine(med);
      });
    });
  }

  // Seleciona o medicamento escolhido
  function selectMedicine(med) {
    selectedMedId.value = med.id;
    medSearchInput.value = `${med.name} (${med.form})`;
    medDropdownList.style.display = 'none';
    if (btnClearMedSearch) btnClearMedSearch.style.display = 'block';

    // Exibe painel sanitário com destaque para Lote, Validade e Estoque
    if (infoBatch) infoBatch.textContent = med.batch;
    if (infoExpiry) infoExpiry.textContent = med.expiry;
    if (infoStock) infoStock.textContent = `${med.stock} ${med.unit}`;
    if (unitLabel) unitLabel.textContent = med.unit;
    if (medInfoPanel) medInfoPanel.style.display = 'grid';

    // Sugere quantidade
    if (dispenseQuantity) {
      dispenseQuantity.value = med.unit === 'frascos' ? '1' : '30';
      dispenseQuantity.focus();
    }

    medSearchInput.classList.remove('is-invalid');
  }

  // Limpa a seleção do medicamento
  window.clearMedicineSelection = function() {
    selectedMedId.value = '';
    medSearchInput.value = '';
    if (btnClearMedSearch) btnClearMedSearch.style.display = 'none';
    if (medInfoPanel) medInfoPanel.style.display = 'none';
    medDropdownList.style.display = 'none';
    medSearchInput.focus();
  };

  // Evento de digitação com filtro dinâmico
  medSearchInput.addEventListener('input', () => {
    selectedMedId.value = '';
    if (medInfoPanel) medInfoPanel.style.display = 'none';
    if (btnClearMedSearch) {
      btnClearMedSearch.style.display = medSearchInput.value.length > 0 ? 'block' : 'none';
    }
    renderDropdown(medSearchInput.value);
  });

  // Evento de foco: abre a lista
  medSearchInput.addEventListener('focus', () => {
    renderDropdown(medSearchInput.value);
  });

  // Botão de seta
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

  // Botão de limpar
  if (btnClearMedSearch) {
    btnClearMedSearch.addEventListener('click', (e) => {
      e.stopPropagation();
      window.clearMedicineSelection();
    });
  }

  // Fecha dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (medComboboxWrapper && !medComboboxWrapper.contains(e.target)) {
      medDropdownList.style.display = 'none';
    }
  });

  // Tecla Escape para fechar
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
 * Adiciona um medicamento à lista da receita atual (múltiplos itens na receita)
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

    // Validação se o usuário pesquisou e selecionou o medicamento
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

    // Cria o item da receita
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

    // Limpa a busca para permitir pesquisar e adicionar o próximo medicamento
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
  const recipeEmptyNotice = document.getElementById('recipeEmptyNotice');
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

  // Evento para remover item individual da receita
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

    // Horário formatado
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `Hoje, ${hours}:${minutes}`;

    const newDispensations = [];

    // Adiciona cada item da receita como registro de dispensação com baixa de estoque
    currentRecipeItems.forEach(item => {
      const record = {
        id: 'disp_' + Date.now() + Math.random().toString(36).substr(2, 4),
        medicine: item.name,
        form: item.form,
        batch: item.batch,
        expiry: item.expiry,
        quantity: item.quantity,
        unit: item.unit,
        patientDoc: patientDoc,
        posology: item.posology,
        time: time
      };

      newDispensations.push(record);
      dispensationsList.unshift(record);

      // Baixa no estoque simulado
      const invMed = INVENTORY_MEDICINES.find(m => m.id === item.medId);
      if (invMed) {
        invMed.stock = Math.max(0, invMed.stock - item.quantity);
      }
    });

    saveToStorage();
    renderDispensationsTable(newDispensations[0]?.id);
    updateStatistics();

    showToast(`Dispensação concluída com sucesso! ${currentRecipeItems.length} medicamento(s) baixado(s) no estoque.`, 'success');

    // Limpa a receita atual
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
  try {
    const stored = localStorage.getItem(DISPENSATIONS_STORAGE_KEY);
    if (stored) {
      dispensationsList = JSON.parse(stored);
    } else {
      dispensationsList = [...DEFAULT_DISPENSATIONS];
      saveToStorage();
    }
  } catch (e) {
    console.error('Erro ao ler do LocalStorage:', e);
    dispensationsList = [...DEFAULT_DISPENSATIONS];
  }

  renderDispensationsTable();
  updateStatistics();
}

function saveToStorage() {
  try {
    localStorage.setItem(DISPENSATIONS_STORAGE_KEY, JSON.stringify(dispensationsList));
  } catch (e) {
    console.error('Erro ao salvar no LocalStorage:', e);
  }
}

/**
 * Renderiza a tabela de Últimas Dispensas com foco na Hierarquia do Medicamento
 */
function renderDispensationsTable(highlightedId = null) {
  const tbody = document.getElementById('dispensationsTableBody');
  const emptyState = document.getElementById('emptyTableMessage');
  const badgeCount = document.getElementById('badgeItemCount');
  const footerSummary = document.getElementById('footerRecordSummary');
  const searchFilter = document.getElementById('searchTableInput')?.value.toLowerCase().trim() || '';

  if (!tbody) return;

  const filteredList = dispensationsList.filter(item => {
    if (!searchFilter) return true;
    return (
      item.medicine.toLowerCase().includes(searchFilter) ||
      item.batch.toLowerCase().includes(searchFilter) ||
      (item.patientDoc && item.patientDoc.toLowerCase().includes(searchFilter)) ||
      (item.posology && item.posology.toLowerCase().includes(searchFilter))
    );
  });

  if (badgeCount) {
    badgeCount.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'item' : 'itens'}`;
  }

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    if (footerSummary) footerSummary.textContent = 'Nenhuma dispensa encontrada.';
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (footerSummary) {
    footerSummary.textContent = `Exibindo ${filteredList.length} de ${dispensationsList.length} dispensas recentes.`;
  }

  tbody.innerHTML = filteredList.map(item => {
    const isRowNew = item.id === highlightedId ? 'row-flash' : '';
    const initial = item.medicine ? item.medicine.charAt(0).toUpperCase() : 'M';
    const patientDisplay = item.patientDoc 
      ? `<span class="badge-cnes-sus py-0 px-1 me-1" style="font-size: 10px;">CNS</span>${escapeHTML(item.patientDoc)}`
      : `<span class="badge bg-light text-muted border py-0 px-1" style="font-size: 10px;">Não informado</span>`;

    return `
      <tr class="${isRowNew}" data-id="${item.id}">
        <!-- 1. Qual é o Medicamento & Forma (Protagonista da Hierarquia) -->
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

        <!-- 2. Lote & Data de Vencimento (Informação Sanitária em Destaque) -->
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

        <!-- 5. Horário -->
        <td>
          <span class="text-muted" style="font-size: 12px; white-space: nowrap;">
            ${escapeHTML(item.time)}
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

  const totalDispensations = dispensationsList.length;
  const totalUnits = dispensationsList.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  
  // Agrupamentos por horário aproximado ou lote
  const estimatedRecipes = new Set(dispensationsList.map(item => item.time + (item.patientDoc || 'anon'))).size;

  if (statTotalDispensations) statTotalDispensations.textContent = totalDispensations;
  if (statTotalUnitsDispensed) statTotalUnitsDispensed.textContent = totalUnits.toLocaleString('pt-BR');
  if (statTotalRecipes) statTotalRecipes.textContent = estimatedRecipes;
}

/**
 * Delegação de eventos da tabela (Estorno e Comprovante)
 */
function setupTableEventListeners() {
  const tbody = document.getElementById('dispensationsTableBody');
  const btnReloadMockData = document.getElementById('btnReloadMockData');
  const btnPopulateEmpty = document.getElementById('btnPopulateEmpty');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      // Estorno
      const estornoBtn = e.target.closest('.btn-estorno-item');
      if (estornoBtn) {
        const id = estornoBtn.getAttribute('data-id');
        const medName = estornoBtn.getAttribute('data-name');
        openEstornoModal(id, medName);
        return;
      }

      // Ver Comprovante
      const receiptBtn = e.target.closest('.btn-view-receipt');
      if (receiptBtn) {
        const id = receiptBtn.getAttribute('data-id');
        openReceiptModal(id);
      }
    });
  }

  if (btnReloadMockData) {
    btnReloadMockData.addEventListener('click', () => {
      dispensationsList = [...DEFAULT_DISPENSATIONS];
      saveToStorage();
      renderDispensationsTable();
      updateStatistics();
      showToast('Dispensas de exemplo restauradas!', 'info');
    });
  }

  if (btnPopulateEmpty) {
    btnPopulateEmpty.addEventListener('click', () => {
      dispensationsList = [...DEFAULT_DISPENSATIONS];
      saveToStorage();
      renderDispensationsTable();
      updateStatistics();
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
        Registro: <strong>${escapeHTML(item.time)}</strong>
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

/**
 * Filtro em tempo real na busca
 */
function setupSearchFilter() {
  const searchInput = document.getElementById('searchTableInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderDispensationsTable();
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
