// ==========================================
// Gestor de Assinaturas - App Logic & IndexedDB
// ==========================================

// --- 1. REGISTRO PWA & PERSISTÊNCIA DE ARMAZENAMENTO ---
let deferredInstallPrompt = null;

// Registrar Service Worker real
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.error('Erro no Service Worker:', err));
  });
}

// Solicitar persistência no IndexedDB
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) console.log('Armazenamento persistente habilitado com sucesso.');
  });
}

// Capturar evento de instalação PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.add('show');
});

document.getElementById('btn-install-pwa')?.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('Resultado da instalação:', outcome);
    deferredInstallPrompt = null;
    document.getElementById('install-banner')?.classList.remove('show');
  }
});

document.getElementById('btn-close-install')?.addEventListener('click', () => {
  document.getElementById('install-banner')?.classList.remove('show');
});

// --- 2. INDEXEDDB DATABASE LAYER ---
let db;
const dbName = "AssinaturasPWA_DB";
let allContas = [];
let currentFilter = 'all';
let currentSearch = '';

const initDB = () => {
  const request = indexedDB.open(dbName, 1);

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("contas")) {
      db.createObjectStore("contas", { keyPath: "id", autoIncrement: true });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    loadData();
  };

  request.onerror = (event) => {
    console.error("Erro no IndexedDB:", event.target.error);
    showToast("Erro ao abrir banco de dados local.", true);
  };
};

// --- 3. REGRAS DE NEGÓCIO E FORMATAÇÃO ---
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const updateMonthHeader = () => {
  const now = new Date();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthStr = monthNames[now.getMonth()];
  const el = document.getElementById('current-month-display');
  if (el) el.textContent = `${monthStr} • Dia ${now.getDate()}`;
};

const showToast = (message, isError = false) => {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  
  if (iconEl) {
    if (isError) {
      iconEl.setAttribute('stroke', '#ef4444');
    } else {
      iconEl.setAttribute('stroke', '#10b981');
    }
  }
  
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
};

// Carregar todas as assinaturas do banco
const loadData = () => {
  if (!db) return;
  const transaction = db.transaction(["contas"], "readonly");
  const store = transaction.objectStore("contas");
  const request = store.getAll();

  request.onsuccess = () => {
    allContas = request.result || [];
    renderUI();
  };
};

// Renderizar a tela inteira (Resumo + Lista com filtros)
const renderUI = () => {
  updateMonthHeader();
  const currentDay = new Date().getDate();

  // Ordenar por dia de vencimento
  allContas.sort((a, b) => a.day - b.day);

  // Calcular totais
  let total = 0;
  let totalPaid = 0;
  let totalPending = 0;

  allContas.forEach(conta => {
    const val = Number(conta.value) || 0;
    total += val;
    if (currentDay >= conta.day) {
      totalPaid += val;
    } else {
      totalPending += val;
    }
  });

  // Atualizar dados no Card Resumo
  const totalValEl = document.getElementById('total-value');
  const totalPaidEl = document.getElementById('total-paid');
  const totalPendingEl = document.getElementById('total-pending');
  const countBadgeEl = document.getElementById('subscriptions-count');

  if (totalValEl) totalValEl.innerText = formatCurrency(total);
  if (totalPaidEl) totalPaidEl.innerText = formatCurrency(totalPaid);
  if (totalPendingEl) totalPendingEl.innerText = formatCurrency(totalPending);
  if (countBadgeEl) countBadgeEl.innerText = `${allContas.length} ${allContas.length === 1 ? 'conta' : 'contas'}`;

  // Barra de progresso
  const percentage = total > 0 ? Math.round((totalPaid / total) * 100) : 0;
  const progressBar = document.getElementById('month-progress-bar');
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }

  // Filtragem para exibição
  let filtered = allContas.filter(conta => {
    const isPaid = currentDay >= conta.day;
    if (currentFilter === 'paid' && !isPaid) return false;
    if (currentFilter === 'pending' && isPaid) return false;

    if (currentSearch.trim()) {
      const q = currentSearch.toLowerCase();
      return (conta.name || '').toLowerCase().includes(q);
    }
    return true;
  });

  renderListItems(filtered, currentDay);
};

// Renderizar Itens da Lista
const renderListItems = (contas, currentDay) => {
  const container = document.getElementById('list-container');
  if (!container) return;
  container.innerHTML = '';

  if (contas.length === 0) {
    const isSearching = currentSearch.trim() || currentFilter !== 'all';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
        <div class="empty-title">${isSearching ? 'Nenhuma conta encontrada' : 'Nenhuma assinatura cadastrada'}</div>
        <div class="empty-desc">${isSearching ? 'Tente mudar os filtros ou o termo de busca.' : 'Toque no botão "+ Nova Conta" para adicionar seu primeiro pagamento.'}</div>
      </div>
    `;
    return;
  }

  contas.forEach(conta => {
    const isPaid = currentDay >= conta.day;
    const isToday = currentDay === conta.day;
    const daysDiff = conta.day - currentDay;

    let statusClass = 'pending';
    let statusText = `Em ${daysDiff} dias`;

    if (isToday) {
      statusClass = 'due-today';
      statusText = 'Vence hoje!';
    } else if (isPaid) {
      statusClass = 'paid';
      statusText = 'Pago';
    }

    // Ícone / Letra inicial estilizada
    const firstLetter = (conta.name || 'A').charAt(0).toUpperCase();

    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <div class="item-left">
        <div class="category-avatar">${firstLetter}</div>
        <div class="item-info">
          <div class="item-name">${escapeHTML(conta.name)}</div>
          <div class="item-badges">
            <span class="badge-day">Dia ${conta.day}</span>
            <span class="badge-status ${statusClass}">${statusText}</span>
          </div>
        </div>
      </div>
      <div class="item-right">
        <div class="item-val">${formatCurrency(conta.value)}</div>
        <div class="item-actions">
          <button class="action-btn" onclick="openEditAccount(${conta.id})" title="Editar" aria-label="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button class="action-btn delete" onclick="confirmDeleteAccount(${conta.id}, '${escapeHTML(conta.name)}')" title="Excluir" aria-label="Excluir">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
};

const escapeHTML = (str) => {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
};

// --- 4. FILTROS E BUSCA ---
const setFilter = (filterType) => {
  currentFilter = filterType;
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  renderUI();
};

const handleSearch = (value) => {
  currentSearch = value;
  renderUI();
};

// --- 5. MODAL FORMULÁRIO (NOVA / EDITAR) ---
const openFormModal = (isEdit = false) => {
  const modal = document.getElementById('form-modal');
  const title = document.getElementById('form-modal-title');
  const btnText = document.getElementById('btn-save-text');

  if (!isEdit) {
    document.getElementById('account-form').reset();
    document.getElementById('edit-id').value = '';
    if (title) title.innerText = 'Nova Assinatura';
    if (btnText) btnText.innerText = 'Salvar Assinatura';
  }

  if (modal) modal.classList.add('open');
  setTimeout(() => {
    document.getElementById('input-name')?.focus();
  }, 150);
};

const closeFormModal = () => {
  document.getElementById('form-modal')?.classList.remove('open');
};

const openEditAccount = (id) => {
  const conta = allContas.find(c => c.id === id);
  if (!conta) return;

  document.getElementById('edit-id').value = conta.id;
  document.getElementById('input-name').value = conta.name;
  document.getElementById('input-value').value = conta.value;
  document.getElementById('input-day').value = conta.day;

  const title = document.getElementById('form-modal-title');
  const btnText = document.getElementById('btn-save-text');
  if (title) title.innerText = 'Editar Assinatura';
  if (btnText) btnText.innerText = 'Atualizar Assinatura';

  openFormModal(true);
};

const quickFill = (name, value, day) => {
  document.getElementById('input-name').value = name;
  document.getElementById('input-value').value = value;
  document.getElementById('input-day').value = day;
  document.getElementById('input-value').focus();
};

const handleFormSubmit = (event) => {
  event.preventDefault();
  const editId = document.getElementById('edit-id').value;
  const name = document.getElementById('input-name').value.trim();
  const value = parseFloat(document.getElementById('input-value').value);
  const day = parseInt(document.getElementById('input-day').value, 10);

  if (!name || isNaN(value) || value <= 0 || isNaN(day) || day < 1 || day > 31) {
    showToast("Preencha todos os campos corretamente.", true);
    return;
  }

  const transaction = db.transaction(["contas"], "readwrite");
  const store = transaction.objectStore("contas");

  if (editId) {
    const id = parseInt(editId, 10);
    store.put({ id, name, value, day });
    transaction.oncomplete = () => {
      closeFormModal();
      loadData();
      showToast("Assinatura atualizada!");
    };
  } else {
    store.add({ name, value, day });
    transaction.oncomplete = () => {
      closeFormModal();
      loadData();
      showToast("Assinatura adicionada!");
    };
  }

  transaction.onerror = (e) => {
    console.error("Erro ao salvar:", e.target.error);
    showToast("Erro ao salvar assinatura.", true);
  };
};

const confirmDeleteAccount = (id, name) => {
  if (confirm(`Tem certeza que deseja excluir "${name}"?`)) {
    const transaction = db.transaction(["contas"], "readwrite");
    const store = transaction.objectStore("contas");
    store.delete(id);

    transaction.oncomplete = () => {
      loadData();
      showToast("Assinatura excluída!");
    };
  }
};

// --- 6. MODAL BACKUP & RESTAURAÇÃO ---
const openBackupModal = () => {
  document.getElementById('backup-modal')?.classList.add('open');
};

const closeBackupModal = () => {
  document.getElementById('backup-modal')?.classList.remove('open');
};

const exportBackupData = () => {
  if (!allContas || allContas.length === 0) {
    showToast("Não há assinaturas para exportar.", true);
    return;
  }

  const dataStr = JSON.stringify(allContas, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `assinaturas_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  closeBackupModal();
  showToast("Backup exportado com sucesso!");
};

const importBackupData = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        throw new Error("Formato inválido: o backup deve ser uma lista de contas.");
      }

      if (confirm(`Deseja importar ${imported.length} assinaturas? Elas serão adicionadas ao seu banco de dados.`)) {
        const transaction = db.transaction(["contas"], "readwrite");
        const store = transaction.objectStore("contas");

        imported.forEach(item => {
          const newItem = {
            name: item.name,
            value: parseFloat(item.value) || 0,
            day: parseInt(item.day, 10) || 1
          };
          store.add(newItem);
        });

        transaction.oncomplete = () => {
          loadData();
          closeBackupModal();
          showToast(`${imported.length} assinaturas importadas com sucesso!`);
        };
      }
    } catch (err) {
      console.error("Erro ao importar:", err);
      showToast("Arquivo de backup inválido!", true);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// Fechar ao clicar fora
const handleBackdropClick = (e, modalId) => {
  if (e.target.id === modalId) {
    if (modalId === 'form-modal') closeFormModal();
    if (modalId === 'backup-modal') closeBackupModal();
  }
};

// Atalhos de teclado (Esc para fechar modais)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeFormModal();
    closeBackupModal();
  }
});

// Inicialização
window.addEventListener('DOMContentLoaded', initDB);
