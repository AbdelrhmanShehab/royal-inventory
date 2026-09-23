const API_BASE = '/api/v1';
let token = ''; // Empty string forces real authentication overlay
let currentGroupId = 1;
let selectedNodeId = null;
let selectedOperationalLocationId = null;
let cachedTreeNodes = [];
let cachedComsysWarehouses = [];
let currentStockData = null;
let activeView = 'dashboard';
let explorerActiveTab = 'stock';
let explorerItemsList = [];
let expCurrentPage = 1;
const expPageSize = 8;
let tfPageSize = 8;
let tfCurrentPage = 1;
let filteredTransfersList = [];
let newTransferLineItems = [];
let localItemsList = [];
let wizardSourceWarehouseStock = [];
let cachedInboundItems = [];
let searchStockCache = null;
let nodeTransactionsList = [];
// ── User Management state ─────────────────────────────────────────────────
let currentUser = null;
let cachedUsersList = [];
let cachedNodesList = [];
let cachedOpLocations = [];
let cachedOpStockSummary = null;

function notify(message, type = 'primary') {
  const toast = document.getElementById('toast-notify');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-message');
  text.innerText = message;
  if (type === 'success') {
    icon.className = 'fa-solid fa-circle-check'; icon.style.color = 'var(--success)';
  } else if (type === 'error') {
    icon.className = 'fa-solid fa-circle-exclamation'; icon.style.color = 'var(--danger)';
  } else {
    icon.className = 'fa-solid fa-circle-info'; icon.style.color = '#38bdf8';
  }
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 7500);
}

async function apiFetch(endpoint, method = 'GET', body = null) {
  const options = {
    method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(API_BASE + endpoint, options);
  if (res.status === 401) {
    token = '';
    document.getElementById('login-overlay').style.display = 'flex';
    notify('انتهت الجلسة — يرجى تسجيل الدخول مجدداً', 'error');
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  return data;
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameInput = document.getElementById('username').value;
  const passwordInput = document.getElementById('password').value;
  const errMsg = document.getElementById('login-error');
  if (errMsg) errMsg.style.display = 'none';

  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });
    const data = await res.json();
    if (data.success && data.data && data.data.accessToken) {
      token = data.data.accessToken;
      const user = data.data.user;
      currentUser = user;
      document.getElementById('user-initials').innerText = user.fullNameAr ? user.fullNameAr.slice(0, 2) : usernameInput.slice(0, 2).toUpperCase();
      document.getElementById('login-overlay').style.display = 'none';
      notify('تم تسجيل الدخول بنجاح!', 'success');

      // Show admin-only menu items and hierarchy management card
      const menuUsers = document.getElementById('menu-users');
      if (menuUsers) {
        menuUsers.style.display = (user.role === 'admin') ? 'block' : 'none';
      }
      const menuPerms = document.getElementById('menu-permissions');
      if (menuPerms) {
        menuPerms.style.display = (user.role === 'admin') ? 'block' : 'none';
      }
      const menuLaundry = document.getElementById('menu-laundry');
      if (menuLaundry) {
        menuLaundry.style.display = (user.role === 'admin' || user.username.includes('laundry')) ? 'block' : 'none';
      }
      const mgmtCard = document.getElementById('hierarchy-mgmt-card');
      if (mgmtCard) {
        mgmtCard.style.display = (user.role === 'admin') ? 'block' : 'none';
      }

      await loadGroups();
      await loadComsysWarehouses();
      await loadLocalItems();
      await loadTree();
      switchView('dashboard');

    } else {
      if (errMsg) {
        errMsg.innerText = data.message || 'بيانات الدخول غير صحيحة';
        errMsg.style.display = 'block';
      }
    }
  } catch (err) {
    console.error(err);
    if (errMsg) {
      errMsg.innerText = 'حدث خطأ في الاتصال بالخادم';
      errMsg.style.display = 'block';
    }
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  token = '';
  document.getElementById('login-overlay').style.display = 'flex';
  notify('تم تسجيل خروج الجلسة الحالية.');
});

async function loadGroups() {
  const res = await apiFetch('/hierarchy/groups');
  if (res.success) {
    const select = document.getElementById('group-select'); select.innerHTML = '';
    res.data.forEach(g => {
      const opt = document.createElement('option'); opt.value = g.id; opt.innerText = g.groupNameAr; select.appendChild(opt);
    });
    if (res.data.length > 0) currentGroupId = res.data[0].id;
  }
}

document.getElementById('group-select').addEventListener('change', async (e) => {
  currentGroupId = parseInt(e.target.value);
  selectedNodeId = null;
  document.getElementById('selected-node-ops').style.display = 'none';
  await loadTree();
});

async function loadComsysWarehouses() {
  const res = await apiFetch('/warehouses?division=fb');
  if (res.success) {
    cachedComsysWarehouses = res.data;
    const select = document.getElementById('comsys-warehouse-select');
    if (select) {
      select.innerHTML = '<option value="">اختر مخزن للربط...</option>';
      cachedComsysWarehouses.forEach(w => {
        const opt = document.createElement('option'); opt.value = w.storeCode; opt.innerText = w.storeCode + ' - ' + w.storeNameAr; select.appendChild(opt);
      });
    }
  }
}

const comsysSelectEl = document.getElementById('comsys-warehouse-select');
if (comsysSelectEl) {
  comsysSelectEl.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const w = cachedComsysWarehouses.find(x => x.storeCode === val);
      if (w) document.getElementById('child-node-name').value = w.storeNameAr;
    } else {
      document.getElementById('child-node-name').value = '';
    }
  });
}

async function loadTree() {
  const res = await apiFetch('/hierarchy/tree?groupId=' + currentGroupId);
  const container = document.getElementById('tree-container');
  container.innerHTML = '';
  if (res.success && res.data && res.data.nodes) {
    cachedTreeNodes = res.data.nodes;
    const nodes = res.data.nodes;
    if (nodes.length === 0) {
      container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); text-align:center;">الشجرة فارغة</div>';
      return;
    }
    nodes.forEach(n => { container.appendChild(buildTreeNodeDOM(n)); });
    if (selectedNodeId) {
      const activeNode = findNodeInTree(nodes, selectedNodeId);
      if (activeNode) selectTreeNode(activeNode);
    } else if (nodes.length > 0) {
      selectTreeNode(nodes[0]);
    }
  }
}

function buildTreeNodeDOM(node) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'tree-node'; nodeEl.id = 'node-' + node.id;
  const header = document.createElement('div');
  header.className = 'node-header ' + (node.nodeType === 'parent' ? 'parent-node' : node.nodeType === 'child' ? 'child-node' : 'operational-node');
  if (selectedNodeId === node.id || (node.nodeType === 'operational' && selectedOperationalLocationId === node.realId)) header.classList.add('active');

  const toggle = document.createElement('span');
  toggle.className = 'toggle-icon';
  if (node.nodeType === 'parent' && node.children && node.children.length > 0) {
    toggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i>'; toggle.classList.add('open');
  }
  header.appendChild(toggle);

  const icon = document.createElement('i');
  let iconClass = 'node-icon ';
  if (node.nodeType === 'parent') iconClass += 'fa-regular fa-folder-open';
  else if (node.nodeType === 'child') iconClass += 'fa-solid fa-warehouse';
  else iconClass += 'fa-solid fa-location-dot';
  icon.className = iconClass;
  if (node.nodeType === 'operational') icon.style.color = 'var(--primary)';
  header.appendChild(icon);

  const name = document.createElement('span'); name.innerText = node.nodeNameAr; header.appendChild(name);

  const stockBadge = document.createElement('span');
  stockBadge.className = 'node-stock-badge';
  stockBadge.innerText = node.totalStock !== undefined ? node.totalStock.toLocaleString() : '0';
  if (node.nodeType === 'operational') {
    stockBadge.style.background = '#eff6ff';
    stockBadge.style.color = '#1d4ed8';
  }
  header.appendChild(stockBadge);
  nodeEl.appendChild(header);

  const childrenBox = document.createElement('div');
  childrenBox.className = 'node-children';
  if (node.children && node.children.length > 0) {
    childrenBox.classList.add('expanded');
    node.children.forEach(c => { childrenBox.appendChild(buildTreeNodeDOM(c)); });
  }
  nodeEl.appendChild(childrenBox);

  // If it's a child node (linked warehouse), fetch its operational locations (sub-warehouses) and render them
  if (node.nodeType === 'child') {
    apiFetch(`/operational/nodes/${node.id}/locations`).then(locRes => {
      if (locRes.success && locRes.data && locRes.data.length > 0) {
        toggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        toggle.classList.add('open');
        childrenBox.classList.add('expanded');

        locRes.data.forEach(loc => {
          const locNode = {
            id: 'op-' + loc.id,
            realId: loc.id,
            nodeNameAr: loc.name,
            nodeType: 'operational',
            parentNodeId: node.id,
            description: loc.description,
            displayOrder: loc.displayOrder,
            totalStock: 0
          };

          // Find current stock summary to set totalStock
          apiFetch(`/operational/nodes/${node.id}/summary`).then(sumRes => {
            if (sumRes.success && sumRes.data && sumRes.data.items) {
              let locSum = 0;
              sumRes.data.items.forEach(itm => {
                const locItm = itm.locations.find(l => l.locationId === loc.id);
                if (locItm) locSum += locItm.balance;
              });
              const badge = nodeEl.querySelector(`#node-op-${loc.id} .node-stock-badge`);
              if (badge) badge.innerText = locSum.toLocaleString();
            }
          });

          childrenBox.appendChild(buildTreeNodeDOM(locNode));
        });
      }
    });
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExp = childrenBox.classList.toggle('expanded');
    toggle.classList.toggle('open');
    if (node.nodeType === 'parent') {
      icon.className = 'node-icon ' + (isExp ? 'fa-regular fa-folder-open' : 'fa-regular fa-folder');
    }
  });
  header.addEventListener('click', () => { selectTreeNode(node); });
  return nodeEl;
}

function selectTreeNode(node) {
  document.querySelectorAll('.node-header').forEach(h => h.classList.remove('active'));

  if (node.nodeType === 'operational') {
    selectedNodeId = node.parentNodeId;
    selectedOperationalLocationId = node.realId;

    // Find the node header in the tree and set it active
    const nodeContainer = document.getElementById('node-op-' + node.realId);
    if (nodeContainer) {
      const selfHeader = nodeContainer.querySelector('.node-header');
      if (selfHeader) selfHeader.classList.add('active');
    }

    // Render the sub-warehouse details panel!
    renderOperationalSubWarehouseView(node);
  } else {
    selectedNodeId = node.id;
    selectedOperationalLocationId = null;

    const nodeContainer = document.getElementById('node-' + node.id);
    if (nodeContainer) {
      const selfHeader = nodeContainer.querySelector('.node-header');
      if (selfHeader) selfHeader.classList.add('active');
    }

    // Restore normal detail view and reset elements
    document.getElementById('stats-grid-area').style.display = 'grid';
    const tabHeadersList = document.querySelector('.table-card .tabs');
    if (tabHeadersList) tabHeadersList.style.display = 'flex';
    document.getElementById('op-location-filter').style.display = 'inline-block';

    // Show normal node ops sidebar panel
    document.getElementById('selected-node-ops').style.display = 'block';

    loadNodeStock(node);
  }
}

async function renderOperationalSubWarehouseView(node) {
  // 1. Fetch parent warehouse name
  const parentNode = findNodeInTree(cachedTreeNodes, node.parentNodeId);
  const parentName = parentNode ? parentNode.nodeNameAr : 'المستودع الرئيسي';

  // 2. Set Breadcrumb and Title
  document.getElementById('node-path').innerText = `المستودعات / ${parentName} / ${node.nodeNameAr}`;
  document.getElementById('selected-node-title').innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> المخزن التشغيلي الفرعي: ${node.nodeNameAr}`;

  // 3. Hide stats grid of parent warehouse
  document.getElementById('stats-grid-area').style.display = 'none';

  // 4. Hide tab button headers list in table-card
  const tabHeadersList = document.querySelector('.table-card .tabs');
  if (tabHeadersList) tabHeadersList.style.display = 'none';

  // 5. Hide sidebar operations
  document.getElementById('selected-node-ops').style.display = 'none';

  // 6. Lock the location filter to ONLY this sub-warehouse BEFORE switching tab.
  // This must happen before switchExplorerTab because that function calls renderOperationalTab()
  // immediately, and we need the filter to be set correctly on the first call.
  const filterSelect = document.getElementById('op-location-filter');
  filterSelect.value = node.realId;
  filterSelect.style.display = 'none';

  // 7. Force view Tab 7 (Operational Distribution)
  // switchExplorerTab will call renderOperationalTab() internally, which will use
  // the filter value set above. No need for a separate call after this.
  switchExplorerTab('operational');
}

async function selectTreeNodeById(nodeId) {
  try {
    const res = await apiFetch('/hierarchy/nodes/' + nodeId);
    if (res.success && res.data) {
      selectTreeNode(res.data);
    }
  } catch (err) {
    console.error('Error selecting node by id', err);
  }
}

function findNodeInTree(nodesList, id) {
  for (const n of nodesList) {
    if (n.id === id) return n;
    if (n.children && n.children.length > 0) {
      const found = findNodeInTree(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findNodeName(id) {
  if (!currentStockData) return 'مستودع';
  return currentStockData.nodeNameAr || 'مستودع';
}

function getChildNodesList(nodesList, result = []) {
  nodesList.forEach(n => {
    result.push(n);
    if (n.children && n.children.length > 0) getChildNodesList(n.children, result);
  });
  return result;
}

async function loadNodeStock(node) {
  document.getElementById('selected-node-title').innerText = node.nodeNameAr;
  const pathEl = document.getElementById('node-path');
  const badgeHtml = node.nodeType === 'parent'
    ? '<span class="badge badge-type-internal_transfer" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd; font-size:11px; margin-right:8px;"><i class="fa-regular fa-folder"></i> مجلد تصنيفي / فندق</span>'
    : '<span class="badge badge-type-consumption" style="background:#dcfce7; color:#15803d; border-color:#bbf7d0; font-size:11px; margin-right:8px;"><i class="fa-solid fa-box-archive"></i> مستودع تشغيلي (كومسيس)</span>';

  pathEl.innerHTML = (node.nodeType === 'parent' ? 'المجلدات / ' + node.nodeNameAr : 'المستودعات / المستودع الرئيسي / ' + node.nodeNameAr) + badgeHtml;

  const tabTx = document.getElementById('tab-btn-transactions');
  const tabMov = document.getElementById('tab-btn-movement');
  const tabStk = document.getElementById('tab-btn-stock');
  const tabSub = document.getElementById('tab-btn-subunits');
  const tabDist = document.getElementById('tab-btn-distribution');
  const tabIR = document.getElementById('tab-btn-inbound-returns');
  const tabOp = document.getElementById('tab-btn-operational');
  const tabLnd = document.getElementById('tab-btn-laundry-node');

  if (node.nodeType === 'parent') {
    if (tabSub) tabSub.style.display = 'block';
    if (tabDist) tabDist.style.display = 'block';
    if (tabMov) tabMov.style.display = 'none';
    if (tabTx) tabTx.style.display = 'none';
    if (tabIR) tabIR.style.display = 'none';
    if (tabOp) tabOp.style.display = 'none';
    if (tabLnd) tabLnd.style.display = 'none';
    tabStk.innerText = 'الأصناف التراكمية';

    // Hide child-only UI elements for parent nodes
    const qcBtn = document.getElementById('quick-consume-btn-area');
    const sideQcBtn = document.getElementById('sidebar-quick-consume-area');
    const draftBanner = document.getElementById('pending-drafts-banner');
    const consumptionCard = document.getElementById('card-consumption-rate-wrap');
    const statsGrid = document.getElementById('stats-grid-area');
    if (qcBtn) qcBtn.style.display = 'none';
    if (sideQcBtn) sideQcBtn.style.display = 'none';
    if (draftBanner) draftBanner.style.display = 'none';
    if (consumptionCard) consumptionCard.style.display = 'none';
    if (statsGrid) statsGrid.style.gridTemplateColumns = '1fr 1fr 1fr';

    // If current active tab is child-only, reset to stock
    if (explorerActiveTab === 'movement' || explorerActiveTab === 'transactions' || explorerActiveTab === 'inbound-returns' || explorerActiveTab === 'operational' || explorerActiveTab === 'laundry-node') {
      switchExplorerTab('stock');
    }
  } else {
    if (tabSub) tabSub.style.display = 'none';
    if (tabDist) tabDist.style.display = 'none';
    if (tabMov) tabMov.style.display = 'block';
    if (tabTx) tabTx.style.display = 'block';
    if (tabIR) tabIR.style.display = 'block';
    if (tabOp) tabOp.style.display = 'block';
    if (tabLnd) tabLnd.style.display = (node.hasLaundryAccess === true) ? 'block' : 'none';
    tabStk.innerText = 'الأصناف الحالية';

    // Show child-only UI elements
    const qcBtn = document.getElementById('quick-consume-btn-area');
    const sideQcBtn = document.getElementById('sidebar-quick-consume-area');
    const consumptionCard = document.getElementById('card-consumption-rate-wrap');
    const statsGrid = document.getElementById('stats-grid-area');
    if (qcBtn) qcBtn.style.display = 'block';
    if (sideQcBtn) sideQcBtn.style.display = 'block';
    if (consumptionCard) consumptionCard.style.display = 'block';
    if (statsGrid) statsGrid.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';

    // Show/hide sidebar ops area
    const sidebarOps = document.getElementById('selected-node-ops');
    if (sidebarOps) sidebarOps.style.display = 'block';

    // Check pending drafts for this node
    checkPendingDraftsForNode(node.id);

    // If current active tab is parent-only, reset to stock
    if (explorerActiveTab === 'subunits' || explorerActiveTab === 'distribution') {
      switchExplorerTab('stock');
    }

    if (explorerActiveTab === 'laundry-node' && !node.hasLaundryAccess) {
      switchExplorerTab('stock');
    }
  }

  try {
    const res = await apiFetch('/hierarchy/nodes/' + node.id + '/stock');
    if (res.success) {
      currentStockData = res.data;

      // Stats Card Labels & Values based on Parent vs Child
      if (node.nodeType === 'parent') {
        document.getElementById('card-total-stock-label').innerText = 'إجمالي المخزون التراكمي';
        document.getElementById('card-item-types-label').innerText = 'تنوع الأصناف التراكمية';
        document.getElementById('card-subunits-label').innerText = 'المستودعات الفرعية التابعة';

        document.getElementById('card-total-stock').innerText = currentStockData.totalStock.toLocaleString();
        document.getElementById('card-item-types').innerText = currentStockData.itemTypesCount;
        document.getElementById('card-subunits').innerText = currentStockData.subunitsCount;
      } else {
        document.getElementById('card-total-stock-label').innerText = 'رصيد مخزون العهدة';
        document.getElementById('card-item-types-label').innerText = 'عدد الأصناف المسجلة';
        document.getElementById('card-subunits-label').innerText = 'القيمة المالية للعهدة';

        document.getElementById('card-total-stock').innerText = currentStockData.totalStock.toLocaleString();
        document.getElementById('card-item-types').innerText = currentStockData.itemTypesCount;

        // Calculate financial value sum
        let totalVal = 0;
        let totalReceived = 0;
        let totalConsumed = 0;
        if (currentStockData.items) {
          currentStockData.items.forEach(itm => {
            totalVal += (itm.qtyOperational || 0) * (itm.unitCost || 0);
            totalReceived += (itm.qtyReceived || 0) + (itm.qtyInternalIn || 0) + (itm.qtyReturnedIn || 0);
            totalConsumed += (itm.qtyConsumed || 0) + (itm.qtyDamaged || 0) + (itm.qtyWasted || 0) + (itm.qtyDisposed || 0);
          });
        }
        document.getElementById('card-subunits').innerText = totalVal.toLocaleString() + ' ج.م';

        // Update consumption rate indicator
        const consumptionPct = totalReceived > 0 ? Math.min(100, Math.round((totalConsumed / totalReceived) * 100)) : 0;
        const consumptionEl = document.getElementById('card-consumption-rate');
        const consumptionBar = document.getElementById('card-consumption-bar');
        const consumptionSub = document.getElementById('card-consumption-sub');
        if (consumptionEl) consumptionEl.innerText = consumptionPct + '%';
        if (consumptionBar) consumptionBar.style.width = consumptionPct + '%';
        if (consumptionSub) consumptionSub.innerText = 'استُهلك ' + totalConsumed.toLocaleString() + ' من ' + totalReceived.toLocaleString() + ' وحدة وارد';
      }

      const progContainer = document.getElementById('progress-container');
      progContainer.innerHTML = '';

      if (currentStockData.subunitStock && currentStockData.subunitStock.length > 0) {
        currentStockData.subunitStock.forEach(sub => {
          const totalStockVal = currentStockData.totalStock || 1;
          const percent = Math.min(100, Math.round((sub.totalStock / totalStockVal) * 100));
          const progCard = document.createElement('div');
          progCard.className = 'progress-card';
          progCard.innerHTML = ' <div class="progress-header"> <span class="name">' + sub.nodeNameAr + '</span> <span class="value">' + sub.totalStock.toLocaleString() + ' وحدة</span> </div> <div class="progress-bar"><div class="progress-fill" style="width: ' + percent + '%;"></div></div> ';
          progContainer.appendChild(progCard);
        });
      } else if (node.nodeType === 'child') {
        const progCard = document.createElement('div');
        progCard.className = 'progress-card';
        progCard.innerHTML = ' <div class="progress-header"><span class="name">' + node.nodeNameAr + '</span><span class="value">' + currentStockData.totalStock.toLocaleString() + ' وحدة</span></div> <div class="progress-bar"><div class="progress-fill" style="width: 100%;"></div></div> ';
        progContainer.appendChild(progCard);
      }

      explorerItemsList = currentStockData.items;
      expCurrentPage = 1;

      if (explorerActiveTab === 'stock') {
        renderExplorerItemsTable();
      } else if (explorerActiveTab === 'movement') {
        renderMovementSummaryReport();
      } else if (explorerActiveTab === 'subunits') {
        renderParentStockDistribution();
      } else if (explorerActiveTab === 'distribution') {
        renderParentStockDistributionBreakdown();
      } else if (explorerActiveTab === 'transactions') {
        renderNodeTransactions(node.id);
      } else if (explorerActiveTab === 'inbound-returns') {
        renderNodeInboundAndReturns(node.id);
      }
    }
  } catch (err) {
    console.error('Error fetching stock', err);
  }
}

function renderParentStockDistribution() {
  const tbody = document.getElementById('parent-subunits-body');
  tbody.innerHTML = '';
  if (!currentStockData.subunitStock || currentStockData.subunitStock.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد مستودعات تابعة لهذا المجلد.</td></tr>';
    return;
  }

  const rows = [];
  currentStockData.subunitStock.forEach(sub => {
    const manager = 'أمين العهدة'; // Default fallback
    rows.push('<tr>' +
      '<td><strong>00' + sub.id + '</strong></td>' +
      '<td style="font-weight:700;"><i class="fa-solid fa-box-archive" style="color:var(--primary); margin-left:8px;"></i>' + sub.nodeNameAr + '</td>' +
      '<td>' + manager + '</td>' +
      '<td><span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> متصل بكومسيس</span></td>' +
      '<td style="color:var(--primary); font-weight:800;">' + sub.totalStock.toLocaleString() + ' وحدة</td>' +
      '<td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="selectTreeNodeById(' + sub.id + ')"><i class="fa-solid fa-arrow-pointer"></i> عرض المستودع</button></td>' +
      '</tr>');
  });
  tbody.innerHTML = rows.join('');
}

async function renderNodeTransactions(nodeId) {
  const tbody = document.getElementById('node-transactions-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل الحركات...</td></tr>';

  try {
    const res = await apiFetch('/transactions/transfers?nodeId=' + nodeId);
    if (res.success) {
      nodeTransactionsList = res.data;
      applyNodeTransactionsFilter();
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--danger);">فشل تحميل المعاملات من الخادم.</td></tr>';
  }
}

function applyNodeTransactionsFilter() {
  const tbody = document.getElementById('node-transactions-body');
  if (!tbody) return;

  const fromDateEl = document.getElementById('tx-from-date');
  const toDateEl = document.getElementById('tx-to-date');
  const typeFilterEl = document.getElementById('tx-type-filter');

  const fromDateVal = fromDateEl ? fromDateEl.value : '';
  const toDateVal = toDateEl ? toDateEl.value : '';
  const typeVal = typeFilterEl ? typeFilterEl.value : 'all';

  const filtered = nodeTransactionsList.filter(t => {
    if (typeVal !== 'all' && t.txnType !== typeVal) return false;

    const txnDateStr = new Date(t.createdAt || t.txnDate).toISOString().split('T')[0];
    if (fromDateVal && txnDateStr < fromDateVal) return false;
    if (toDateVal && txnDateStr > toDateVal) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-info-circle"></i> لا توجد حركات تطابق التصفية المحددة.</td></tr>';
    return;
  }

  const trans = {
    consumption: 'استهلاك تشغيلي',
    internal_transfer: 'تحويل داخلي',
    waste: 'هدر مواد',
    damage: 'تلف سلع',
    return: 'مرتجع للمخزن',
    disposal: 'تكهين واستبعاد'
  };

  const rows = [];
  filtered.forEach(t => {
    const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG');
    let typeBadge = '<span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span>';
    const statusMeta = {
      draft: { label: 'مسودة', class: 'badge-warning', style: 'background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;' },
      pending_approval: { label: 'طلب جديد', class: 'badge-warning', style: 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;' },
      approved: { label: 'معتمد', class: 'badge-success', style: 'background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe;' },
      shipped: { label: 'بالطريق', class: 'badge-success', style: 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;' },
      confirmed: { label: 'مؤكدة', class: 'badge-success', style: 'background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;' },
      cancelled: { label: 'ملغية', class: 'badge-danger', style: 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;' }
    };
    const sm = statusMeta[t.status] || { label: t.status, class: 'badge-warning', style: '' };
    let statusBadge = '<span class="badge ' + sm.class + '" style="font-size:10px; ' + sm.style + '">' + sm.label + '</span>';

    let flowText = '';
    if (t.txnType === 'internal_transfer') {
      flowText = '<span style="font-weight:700;">' + t.fromNodeNameAr + '</span> ➔ <span style="font-weight:700; color:var(--primary);">' + t.toNodeNameAr + '</span>';
    } else if (t.txnType === 'return') {
      flowText = '<span style="font-weight:700;">' + t.fromNodeNameAr + '</span> ➔ <span style="color:var(--text-muted);">المخزن الرئيسي</span>';
    } else {
      flowText = '<span style="font-weight:700;">' + (t.fromNodeNameAr || '-') + '</span>';
    }

    rows.push('<tr>' +
      '<td><strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></td>' +
      '<td>' + typeBadge + '</td>' +
      '<td style="text-align:right; font-size:12px;">' + flowText + '</td>' +
      '<td>' + dateStr + '</td>' +
      '<td>' + (t.creatorUsername || 'النظام') + '</td>' +
      '<td style="text-align:right; font-size:11px;">' + (t.notes || '-') + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="goToTransactionDetails(' + t.txnId + ')"><i class="fa-regular fa-eye"></i> عرض</button></td>' +
      '</tr>');
  });
  tbody.innerHTML = rows.join('');
}

function goToTransactionDetails(txnId) {
  switchView('transfers');
  viewTransferDetails(txnId);
}

function renderExplorerItemsTable() {
  const tbody = document.getElementById('stock-table-body'); tbody.innerHTML = '';
  const filterText = document.getElementById('table-search').value.toLowerCase().trim();
  const filtered = explorerItemsList.filter(item => {
    return item.itemCode.toLowerCase().includes(filterText) || (item.itemNameAr && item.itemNameAr.toLowerCase().includes(filterText));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / expPageSize));
  if (expCurrentPage > totalPages) expCurrentPage = totalPages;
  document.getElementById('pagination-label').innerText = 'صفحة ' + expCurrentPage + ' / ' + totalPages + ' (' + filtered.length + ' صنف)';
  const prevBtn = document.getElementById('btn-exp-prev');
  const nextBtn = document.getElementById('btn-exp-next');
  prevBtn.disabled = expCurrentPage === 1;
  nextBtn.disabled = expCurrentPage === totalPages;
  prevBtn.onclick = () => { expCurrentPage--; renderExplorerItemsTable(); };
  nextBtn.onclick = () => { expCurrentPage++; renderExplorerItemsTable(); };

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>لا توجد عناصر تطابق عوامل التصفية.</p></div></td></tr>';
    return;
  }
  const startIndex = (expCurrentPage - 1) * expPageSize;
  filtered.slice(startIndex, startIndex + expPageSize).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = ' <td><strong>' + (item.itemNameAr || 'صنف') + '</strong></td><td>' + item.itemCode + '</td> <td><span style="font-weight:700; color:var(--primary);">' + item.qtyOperational.toLocaleString() + '</span></td> <td>' + (item.unitNameAr || 'حبة') + '</td><td>' + (item.categoryCode || 'أغذية ومشروبات') + '</td> <td>' + new Date(item.lastUpdated || Date.now()).toLocaleDateString('ar-EG') + '</td> ';
    tbody.appendChild(tr);
  });
}

function renderMovementSummaryReport() {
  const tbody = document.getElementById('movement-report-body'); tbody.innerHTML = '';
  if (!explorerItemsList || explorerItemsList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">لا توجد أصناف مسجلة لهذا المستودع</td></tr>';
    return;
  }

  const fromDateEl = document.getElementById('mov-from-date');
  const toDateEl = document.getElementById('mov-to-date');
  const fromDateVal = fromDateEl ? fromDateEl.value : '';
  const toDateVal = toDateEl ? toDateEl.value : '';

  const filtered = explorerItemsList.filter(item => {
    if (item.lastUpdated) {
      const itemDateStr = new Date(item.lastUpdated).toISOString().split('T')[0];
      if (fromDateVal && itemDateStr < fromDateVal) return false;
      if (toDateVal && itemDateStr > toDateVal) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">لا توجد أصناف تطابق تصفية التاريخ المحددة</td></tr>';
    return;
  }

  let totalPrevQty = 0, totalPrevVal = 0, totalInQty = 0, totalInVal = 0, totalOutQty = 0, totalOutVal = 0, totalCurrQty = 0, totalCurrVal = 0;
  const rows = [];
  filtered.forEach(item => {
    const cost = item.unitCost || 150;
    const prevQty = item.qtyReceived || 0;
    const prevVal = prevQty * cost;
    const inQty = (item.qtyInternalIn || 0) + (item.qtyReturnedIn || 0);
    const inVal = inQty * cost;
    const outQty = (item.qtyConsumed || 0) + (item.qtyDamaged || 0) + (item.qtyWasted || 0) + (item.qtyDisposed || 0) + (item.qtyTransferredOut || 0);
    const outVal = outQty * cost;
    const currQty = item.qtyOperational || 0;
    const currVal = currQty * cost;

    totalPrevQty += prevQty; totalPrevVal += prevVal; totalInQty += inQty; totalInVal += inVal;
    totalOutQty += outQty; totalOutVal += outVal; totalCurrQty += currQty; totalCurrVal += currVal;

    rows.push('<tr> <td>' + item.itemCode + '</td><td style="text-align:right; font-weight:700;">' + (item.itemNameAr || 'صنف') + '</td><td>' + (item.unitNameAr || 'حبة') + '</td> <td style="background:#fcfcfc;">' + prevQty.toLocaleString() + '</td><td style="background:#fcfcfc;">' + prevVal.toLocaleString() + ' ج.م</td> <td style="background:#f7f9fc;">' + inQty.toLocaleString() + '</td><td style="background:#f7f9fc;">' + inVal.toLocaleString() + ' ج.م</td> <td style="background:#fdfdfd;">' + outQty.toLocaleString() + '</td><td style="background:#fdfdfd;">' + outVal.toLocaleString() + ' ج.م</td> <td style="background:#f6fbf9; font-weight:700; color:var(--primary);">' + currQty.toLocaleString() + '</td> <td style="background:#f6fbf9; font-weight:700; color:var(--success);">' + currVal.toLocaleString() + ' ج.م</td> </tr>');
  });
  rows.push('<tr class="total-row"> <td colspan="3" style="text-align:left; font-weight:800; padding:12px;">إجمالي تصنيف المستودع الفرعي:</td> <td>' + totalPrevQty.toLocaleString() + '</td><td>' + totalPrevVal.toLocaleString() + ' ج.م</td> <td>' + totalInQty.toLocaleString() + '</td><td>' + totalInVal.toLocaleString() + ' ج.م</td> <td>' + totalOutQty.toLocaleString() + '</td><td>' + totalOutVal.toLocaleString() + ' ج.م</td> <td style="color:var(--primary);">' + totalCurrQty.toLocaleString() + '</td><td style="color:var(--success);">' + totalCurrVal.toLocaleString() + ' ج.م</td> </tr>');
  tbody.innerHTML = rows.join('');
}

document.getElementById('table-search').addEventListener('input', () => { expCurrentPage = 1; renderExplorerItemsTable(); });

// HIERARCHY TREE MANAGEMENT MODAL CONTROLLERS
async function openHierarchyMgmtModal() {
  const modal = document.getElementById('hierarchy-mgmt-modal');
  const parentFeedback = document.getElementById('hm-parent-feedback');
  const comsysSelect = document.getElementById('hm-comsys-select');
  const deleteConfirmText = document.getElementById('hm-delete-confirm-text');

  const tabFolder = document.getElementById('hm-tab-folder');
  const tabWarehouse = document.getElementById('hm-tab-warehouse');
  const tabOpWarehouse = document.getElementById('hm-tab-op-warehouse');
  const tabDelete = document.getElementById('hm-tab-delete');

  // Reset inputs
  document.getElementById('hm-folder-name').value = '';
  document.getElementById('hm-warehouse-name').value = '';
  document.getElementById('hm-op-name').value = '';
  document.getElementById('hm-op-desc').value = '';
  comsysSelect.value = '';
  const lCheck = document.getElementById('hm-warehouse-laundry');
  if (lCheck) lCheck.checked = false;

  let selectedNode = null;

  // Get current active node name and type
  if (selectedNodeId) {
    try {
      const res = await apiFetch('/hierarchy/nodes/' + selectedNodeId);
      if (res.success && res.data) {
        selectedNode = res.data;
        parentFeedback.innerHTML = `<i class="fa-solid fa-folder-open"></i> العقدة الحالية المختارة: <strong>${selectedNode.nodeNameAr}</strong>`;
        deleteConfirmText.innerHTML = `هل أنت متأكد من حذف وفك ربط العقدة <strong>"${selectedNode.nodeNameAr}"</strong> بالكامل؟`;
      }
    } catch (err) {
      parentFeedback.innerText = 'العقدة الحالية في الشجرة: تم اختيار عقدة';
    }
  } else {
    parentFeedback.innerHTML = `<i class="fa-solid fa-home"></i> لم يتم اختيار عقدة (سيتم الإضافة كـ <strong>مجلد رئيسي Root</strong> في أعلى الشجرة)`;
    deleteConfirmText.innerText = 'يرجى اختيار العقدة المراد حذفها أولاً من شجرة التسلسل.';
  }

  // Load Comsys warehouses dropdown
  comsysSelect.innerHTML = '<option value="">جاري تحميل المستودعات الفعالة...</option>';
  try {
    const res = await apiFetch('/master-data/warehouses');
    if (res.success && res.data) {
      let optHtml = '<option value="">اختر مخزن للربط...</option>';
      res.data.forEach(w => {
        optHtml += `<option value="${w.storeCode}">${w.storeCode} - ${w.storeNameAr}</option>`;
      });
      comsysSelect.innerHTML = optHtml;
    } else {
      comsysSelect.innerHTML = '<option value="">فشل جلب المستودعات</option>';
    }
  } catch (err) {
    comsysSelect.innerHTML = '<option value="">خطأ في الاتصال بالخادم</option>';
  }

  // Control tabs visibility based on selectedNode type
  if (!selectedNode) {
    tabFolder.style.display = 'inline-block';
    tabWarehouse.style.display = 'inline-block';
    tabOpWarehouse.style.display = 'none';
    tabDelete.style.display = 'none';
    switchHierarchyMgmtTab('folder');
  } else if (selectedNode.nodeType === 'parent') {
    tabFolder.style.display = 'inline-block';
    tabWarehouse.style.display = 'inline-block';
    tabOpWarehouse.style.display = 'none';
    tabDelete.style.display = 'inline-block';
    switchHierarchyMgmtTab('folder');
  } else if (selectedNode.nodeType === 'child') {
    tabFolder.style.display = 'none';
    tabWarehouse.style.display = 'none';
    tabOpWarehouse.style.display = 'inline-block';
    tabDelete.style.display = 'inline-block';
    switchHierarchyMgmtTab('op-warehouse');
  }

  modal.style.display = 'flex';
}

function switchHierarchyMgmtTab(tabName) {
  const tabs = ['hm-tab-folder', 'hm-tab-warehouse', 'hm-tab-op-warehouse', 'hm-tab-delete'];
  const forms = ['hm-form-folder', 'hm-form-warehouse', 'hm-form-op-warehouse', 'hm-delete-area'];

  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      if (t === 'hm-tab-' + tabName) {
        el.classList.add('active');
        el.style.borderBottom = '2px solid var(--primary)';
        el.style.color = 'var(--text-main)';
      } else {
        el.classList.remove('active');
        el.style.borderBottom = 'none';
        el.style.color = 'var(--text-muted)';
      }
    }
  });

  forms.forEach(f => {
    const el = document.getElementById(f);
    if (el) {
      el.style.display = (f === 'hm-form-' + tabName || (tabName === 'delete' && f === 'hm-delete-area')) ? 'flex' : 'none';
    }
  });
}

async function submitHierarchyFolder(e) {
  e.preventDefault();
  const name = document.getElementById('hm-folder-name').value.trim();
  if (!name) return;

  const body = {
    groupId: currentGroupId,
    parentNodeId: selectedNodeId || null,
    nodeNameAr: name,
    nodeType: 'parent',
    managerName: 'مشرف المجلد',
    isActive: true,
    division: 'fb'
  };

  try {
    const res = await apiFetch('/hierarchy/nodes', 'POST', body);
    if (res.success) {
      notify('تم إضافة المجلد الافتراضي بنجاح', 'success');
      closeOpModal('hierarchy-mgmt-modal');
      await loadTree();
    } else {
      notify(`فشل إضافة المجلد: ${res.message}`, 'error');
    }
  } catch (err) {
    notify('حدث خطأ أثناء إضافة المجلد الافتراضي', 'error');
  }
}

async function submitHierarchyWarehouse(e) {
  e.preventDefault();
  const storeCode = document.getElementById('hm-comsys-select').value;
  const name = document.getElementById('hm-warehouse-name').value.trim();
  const hasLaundry = document.getElementById('hm-warehouse-laundry')?.checked || false;
  if (!storeCode || !name) return;

  const body = {
    comsysStoreCode: storeCode,
    groupId: currentGroupId,
    parentNodeId: selectedNodeId || null,
    nodeNameAr: name,
    nodeType: 'child',
    managerName: 'أمين العهدة',
    isActive: true,
    division: 'fb',
    hasLaundryAccess: hasLaundry
  };

  try {
    const res = await apiFetch('/hierarchy/nodes', 'POST', body);
    if (res.success) {
      notify('تم ربط مخزن كومسيس بنجاح وتوليد الأرصدة التشغيلية!', 'success');
      closeOpModal('hierarchy-mgmt-modal');
      await loadTree();
    } else {
      notify(`فشل ربط المخزن: ${res.message}`, 'error');
    }
  } catch (err) {
    notify('حدث خطأ أثناء ربط المخزن المالي', 'error');
  }
}

async function submitHierarchyOpWarehouse(e) {
  e.preventDefault();
  const name = document.getElementById('hm-op-name').value.trim();
  const description = document.getElementById('hm-op-desc').value.trim();
  if (!name) return;

  const body = {
    name,
    description,
    displayOrder: 0
  };

  try {
    const res = await apiFetch(`/operational/nodes/${selectedNodeId}/locations`, 'POST', { ...body, tenantId: 1, isActive: true });
    if (res.success) {
      notify('تم إضافة المخزن التشغيلي الفرعي بنجاح', 'success');
      closeOpModal('hierarchy-mgmt-modal');
      await loadTree();
    } else {
      notify(`فشل إضافة المخزن الفرعي: ${res.message}`, 'error');
    }
  } catch (err) {
    notify('حدث خطأ أثناء إضافة المخزن الفرعي التشغيلي', 'error');
  }
}

async function deleteSelectedNode() {
  if (!selectedNodeId) {
    notify('يرجى اختيار مجلد أو مخزن من الشجرة لحذفه أولاً', 'warn');
    return;
  }
  if (!confirm('هل أنت متأكد من رغبتك في حذف وفك ربط العقدة المحددة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

  try {
    const res = await apiFetch('/hierarchy/nodes/' + selectedNodeId, 'DELETE');
    if (res.success) {
      notify('تم حذف وفك ربط العقدة بنجاح', 'success');
      selectedNodeId = null;
      closeOpModal('hierarchy-mgmt-modal');
      await loadTree();
    } else {
      notify(`فشل حذف العقدة: ${res.message}`, 'error');
    }
  } catch (err) {
    notify('حدث خطأ أثناء محاولة حذف العقدة', 'error');
  }
}

function renderTransfersEmptyState() {
  const total = filteredTransfersList.length;
  document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; flex-direction:column; justify-content:space-between; height:100%;"> <div> <div class="selected-node-path">العمليات / سجل الحركات</div><div class="selected-node-title" style="margin-bottom:25px;">مركز العمليات والعهدة الفرعية</div> <div class="stats-grid" style="margin-bottom: 30px; text-align:right;"> <div class="stat-card"><h3>إجمالي الحركات</h3><div class="value">' + total + '</div></div> </div> </div> <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex-grow:1; text-align:center; color:var(--text-muted); gap:15px; padding:40px 20px;"> <div style="font-size:64px; color:#cbd5e1;"><i class="fa-solid fa-arrow-right-arrow-left"></i></div> <h3 style="font-weight:800; color:var(--text-main); font-size:16px;">متابعة العهد والعمليات الفرعية</h3> <p style="max-width:440px; font-size:13px; line-height:1.6; margin-bottom: 5px;">هذا القسم يغطي تدفق كافة العمليات (الاستهلاك، الهدر، التالف، التخريد، التحويلات والمرتجعات) الخاصة بالمطابخ والمستودعات الفرعية. اختر حركة من القائمة الجانبية لعرض تدفقها الرسومي.</p> <button class="btn" onclick="showNewTransferForm()"><i class="fa-solid fa-plus"></i> تسجيل حركة جديدة</button> </div> </div> ';
}

async function loadTransfers() {
  tfCurrentPage = 1;
  let list = [];
  try {
    const res = await apiFetch('/transactions/transfers');
    if (res.success) list = res.data;
  } catch (err) {
    console.error('Error loading general transfers:', err);
  }

  try {
    const laundryRes = await apiFetch('/laundry/transfers');
    if (laundryRes.success && laundryRes.data) {
      laundryRes.data.forEach(t => {
        list.push({
          txnId: 'LND-' + t.id,
          txnType: 'laundry_transfer',
          createdAt: t.createdAt,
          txnDate: t.createdAt,
          notes: t.notes,
          status: t.status === 'draft' ? 'draft' : (t.status === 'sent' ? 'shipped' : 'confirmed'),
          fromNodeId: t.fromWarehouseId,
          fromNodeNameAr: t.fromWarehouseName,
          toNodeId: null,
          toNodeNameAr: 'مركز الغسيل والتعقيم',
          creatorUsername: 'المخزن',
          lines: t.items ? t.items.map(itm => ({
            itemCode: itm.itemCode,
            itemNameAr: itm.itemNameAr,
            quantity: itm.sentQty,
            unitCost: itm.unitCost || 0
          })) : []
        });
      });
    }
  } catch (err) {
    console.error('Error loading laundry transfers:', err);
  }

  filteredTransfersList = list;
  filteredTransfersList.sort((a, b) => new Date(b.createdAt || b.txnDate) - new Date(a.createdAt || a.txnDate));

  renderTransfersList();
  renderTransfersEmptyState();
}

async function loadLocalItems() {
  const res = await apiFetch('/master-data/items');
  if (res.success) localItemsList = res.data;
}

function renderTransfersList() {
  const container = document.getElementById('tf-list-cards-container'); container.innerHTML = '';
  const filterText = document.getElementById('tf-search').value.toLowerCase().trim();
  const statusFilter = document.getElementById('tf-status-filter').value;
  const typeFilter = document.getElementById('tf-type-filter').value;

  const fromDateEl = document.getElementById('tf-from-date');
  const toDateEl = document.getElementById('tf-to-date');
  const fromDateVal = fromDateEl ? fromDateEl.value : '';
  const toDateVal = toDateEl ? toDateEl.value : '';

  const items = filteredTransfersList.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.txnType !== typeFilter) return false;

    const txnDateStr = new Date(t.createdAt || t.txnDate).toISOString().split('T')[0];
    if (fromDateVal && txnDateStr < fromDateVal) return false;
    if (toDateVal && txnDateStr > toDateVal) return false;

    return t.txnId.toString().includes(filterText) || (t.notes || '').toLowerCase().includes(filterText) || (t.fromNodeNameAr || '').toLowerCase().includes(filterText);
  });

  const totalPages = Math.max(1, Math.ceil(items.length / tfPageSize));
  if (tfCurrentPage > totalPages) tfCurrentPage = totalPages;
  document.getElementById('tf-pagination-label').innerText = 'صفحة ' + tfCurrentPage + ' / ' + totalPages + ' (' + items.length + ')';
  document.getElementById('btn-tf-prev').disabled = tfCurrentPage === 1;
  document.getElementById('btn-tf-next').disabled = tfCurrentPage === totalPages;

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 30px 10px;"><i class="fa-solid fa-folder-open" style="font-size:24px; color:#cbd5e1; margin-bottom:5px;"></i><p style="font-size:12px;">لا توجد حركات مسجلة تطابق التصفية.</p></div>';
    return;
  }
  const startIndex = (tfCurrentPage - 1) * tfPageSize;
  const trans = { consumption: 'استهلاك تشغيلي', internal_transfer: 'تحويل داخلي', laundry_transfer: 'شحن للمغسلة', waste: 'هدر مواد', damage: 'تلف سلع', return: 'مرتجع للمخزن', disposal: 'تكهين واستبعاد' };

  const statusMeta = {
    draft: { label: 'مسودة', class: 'badge-warning', style: 'background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;' },
    pending_approval: { label: 'طلب جديد', class: 'badge-warning', style: 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;' },
    approved: { label: 'معتمد', class: 'badge-success', style: 'background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe;' },
    shipped: { label: 'بالطريق', class: 'badge-success', style: 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;' },
    confirmed: { label: 'مؤكدة', class: 'badge-success', style: 'background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;' },
    cancelled: { label: 'ملغية', class: 'badge-danger', style: 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;' }
  };

  items.slice(startIndex, startIndex + tfPageSize).forEach(t => {
    const card = document.createElement('div'); card.className = 'transfer-card'; card.id = 'tf-card-' + t.txnId;
    const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    let flowText = t.txnType === 'internal_transfer' ? 'تحويل: ' + t.fromNodeNameAr + ' ➔ ' + t.toNodeNameAr : (t.txnType === 'return' ? 'مرتجع: ' + t.fromNodeNameAr + ' ➔ الرئيسي' : trans[t.txnType] + ': ' + (t.fromNodeNameAr || 'مخزن'));

    const sm = statusMeta[t.status] || { label: t.status, class: 'badge-warning', style: '' };

    card.innerHTML = ' <div class="transfer-card-header"><span class="transfer-card-ref">OP-2026-' + String(t.txnId).padStart(3, "0") + '</span><span class="transfer-card-date">' + dateStr + '</span></div> <div style="font-size: 11px; font-weight: 700; color: #475569; direction: rtl; margin-top:2px;">' + flowText + '</div> <div class="transfer-card-footer" style="margin-top: 5px;"><span class="badge badge-type-' + t.txnType + '" style="font-size:9px;">' + trans[t.txnType] + '</span><span class="badge ' + sm.class + '" style="font-size:9px; ' + sm.style + '">' + sm.label + '</span></div> ';
    card.addEventListener('click', () => {
      document.querySelectorAll('.transfer-card').forEach(c => c.classList.remove('active')); card.classList.add('active'); viewTransferDetails(t.txnId);
    });
    container.appendChild(card);
  });
}

function changeTransfersPage(dir) { tfCurrentPage += dir; renderTransfersList(); }

async function confirmTransferLog(id) {
  if (!confirm('هل متأكد من ترحيل وتأكيد هذه الحركة التشغيلية وتعديل رصيد العهدة الفرعي فوراً؟')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/confirm', 'POST');
    if (res.success) {
      notify('تم ترحيل وتأكيد الحركة وتحديث الأرصدة التشغيلية بنجاح!', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
      await loadTree();
    }
  } catch (err) {
    notify(err.message || 'خطأ أثناء ترحيل الحركة', 'error');
  }
}

async function submitForApprovalLog(id) {
  if (!confirm('هل تريد إرسال هذا الطلب لموافقة الإدارة العامة؟')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/submit-approval', 'POST');
    if (res.success) {
      notify(res.message || 'تم إرسال الطلب بنجاح', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
    }
  } catch (err) { notify(err.message || 'خطأ أثناء إرسال الطلب', 'error'); }
}

async function approveTransferLog(id) {
  if (!confirm('هل أنت متأكد من اعتماد وموافقة هذا الطلب؟')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/approve', 'POST');
    if (res.success) {
      notify(res.message || 'تم اعتماد الطلب بنجاح', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
    }
  } catch (err) { notify(err.message || 'خطأ أثناء اعتماد الطلب', 'error'); }
}

async function dispatchTransferLog(id) {
  if (!confirm('هل أنت متأكد من شحن البضاعة وتنزيلها من رصيد عهدة المصدر؟')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/dispatch', 'POST');
    if (res.success) {
      notify(res.message || 'تم شحن الطلب بنجاح', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
      await loadTree();
    }
  } catch (err) { notify(err.message || 'خطأ أثناء شحن الطلب', 'error'); }
}

async function receiveTransferLog(id) {
  if (!confirm('هل تؤكد استلام البضاعة وإضافتها إلى رصيد عهدة الوجهة؟')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/receive', 'POST');
    if (res.success) {
      notify(res.message || 'تم تأكيد الاستلام بنجاح', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
      await loadTree();
    }
  } catch (err) { notify(err.message || 'خطأ أثناء تأكيد الاستلام', 'error'); }
}

async function cancelTransferLog(id) {
  if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟ (إذا تم الشحن سيتم إرجاع الأرصدة)')) return;
  try {
    const res = await apiFetch('/transactions/transfers/' + id + '/cancel', 'POST');
    if (res.success) {
      notify(res.message || 'تم إلغاء الطلب بنجاح', 'success');
      const trRes = await apiFetch('/transactions/transfers');
      if (trRes.success) filteredTransfersList = trRes.data;
      renderTransfersList();
      viewTransferDetails(id);
      await loadTree();
    }
  } catch (err) { notify(err.message || 'خطأ أثناء إلغاء الطلب', 'error'); }
}

async function viewTransferDetails(id) {
  let t;
  const isLaundry = typeof id === 'string' && id.startsWith('LND-');
  if (isLaundry) {
    const laundryId = id.replace('LND-', '');
    const res = await apiFetch('/laundry/transfers/' + laundryId);
    if (!res.success) return;
    const lData = res.data;
    t = {
      txnId: id,
      txnType: 'laundry_transfer',
      createdAt: lData.createdAt,
      txnDate: lData.createdAt,
      notes: lData.notes,
      status: lData.status === 'draft' ? 'draft' : (lData.status === 'sent' ? 'shipped' : 'confirmed'),
      fromNodeId: lData.fromWarehouseId,
      fromNodeNameAr: lData.fromWarehouseName,
      toNodeId: null,
      toNodeNameAr: 'مركز الغسيل والتعقيم',
      creatorUsername: 'المخزن',
      confirmedAt: (lData.status === 'received' || lData.status === 'partially_received') ? lData.createdAt : null,
      lines: lData.items ? lData.items.map(itm => ({
        itemCode: itm.itemCode,
        itemNameAr: itm.itemNameAr,
        quantity: itm.sentQty,
        unitCost: itm.unitCost || 100
      })) : []
    };
  } else {
    const res = await apiFetch('/transactions/transfers/' + id);
    if (!res.success) return;
    t = res.data;
  }

  let totalQty = 0, totalCost = 0;
  t.lines.forEach(l => { totalQty += l.quantity; totalCost += (l.quantity * l.unitCost); });
  const trans = {
    consumption: 'استهلاك تشغيلي',
    internal_transfer: 'تحويل داخلي',
    laundry_transfer: 'شحن للمغسلة',
    waste: 'هدر خامات ومواد',
    damage: 'تلف سلع ومواد',
    return: 'مرتجع مستودع رئيسي',
    disposal: 'تكهين واستبعاد أصول'
  };
  const configs = {
    consumption: { icon: 'fa-utensils', sourceName: t.fromNodeNameAr, destName: 'صالة الخدمة والتشغيل', sourceLabel: 'مستودع العهدة (من)', destLabel: 'الجهة المستهلكة (إلى)', color: '#3b82f6', speed: '2s' },
    waste: { icon: 'fa-trash-can', sourceName: t.fromNodeNameAr, destName: 'سلة المهملات والتوالف', sourceLabel: 'مستودع العهدة (من)', destLabel: 'حاوية الهدر (إلى)', color: '#ef4444', speed: '2.5s' },
    damage: { icon: 'fa-triangle-exclamation', sourceName: t.fromNodeNameAr, destName: 'مخزن المواد التالفة', sourceLabel: 'مستودع العهدة (من)', destLabel: 'سجل التوالف (إلى)', color: '#f59e0b', speed: '2.2s' },
    disposal: { icon: 'fa-ban', sourceName: t.fromNodeNameAr, destName: 'ساحة الخردة / التخريد', sourceLabel: 'مستودع العهدة (من)', destLabel: 'استبعاد نهائي (إلى)', color: '#64748b', speed: '3s' },
    return: { icon: 'fa-boxes-stacked', sourceName: t.fromNodeNameAr, destName: t.toNodeNameAr || 'المخزن الرئيسي 001', sourceLabel: 'العهدة الفرعية (من)', destLabel: 'مستودع كومسيس الرئيسي (إلى)', color: '#a855f7', speed: '1.5s' },
    internal_transfer: { icon: 'fa-box-archive', sourceName: t.fromNodeNameAr, destName: t.toNodeNameAr, sourceLabel: 'مستودع المصدر (من)', destLabel: 'مستودع الوجهة (إلى)', color: '#10b981', speed: '1.2s' },
    laundry_transfer: { icon: 'fa-soap', sourceName: t.fromNodeNameAr, destName: 'مركز الغسيل والتعقيم بالمغسلة', sourceLabel: 'مستودع المصدر (من)', destLabel: 'المغسلة (إلى)', color: '#2563eb', speed: '1.2s' }
  };
  const flow = configs[t.txnType];

  const statusLabels = {
    draft: 'مسودة',
    pending_approval: 'بانتظار الموافقة',
    approved: 'معتمد',
    shipped: 'بالطريق',
    confirmed: 'مكتمل ومؤكد',
    cancelled: 'ملغي'
  };

  const statusMeta = {
    draft: { label: 'مسودة', class: 'badge-warning', style: 'background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;' },
    pending_approval: { label: 'طلب جديد', class: 'badge-warning', style: 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;' },
    approved: { label: 'معتمد', class: 'badge-success', style: 'background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe;' },
    shipped: { label: 'بالطريق', class: 'badge-success', style: 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;' },
    confirmed: { label: 'مكتمل ومؤكد', class: 'badge-success', style: 'background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;' },
    cancelled: { label: 'ملغي', class: 'badge-danger', style: 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;' }
  };
  const sm = statusMeta[t.status] || { label: t.status, class: 'badge-warning', style: '' };

  // Generates a beautiful HTML stepper
  let stepperHtml = '';
  if (t.status === 'cancelled') {
    stepperHtml = `
          <div style="display:flex; align-items:center; justify-content:center; gap:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:12px; color:#ef4444; font-weight:700; width:100%; text-align:center; font-size:13px; margin-bottom:20px;">
            <i class="fa-solid fa-circle-xmark" style="font-size:18px;"></i>
            تم إلغاء هذه المعاملة بنجاح وعكس أي أثر مالي أو مخزني
          </div>`;
  } else {
    if (t.txnType === 'laundry_transfer') {
      const steps = [
        { key: 'draft', label: 'طلب جديد', icon: 'fa-regular fa-file-lines' },
        { key: 'shipped', label: 'بالطريق للمغسلة', icon: 'fa-solid fa-truck-fast' },
        { key: 'confirmed', label: 'تم الاستلام بالكامل', icon: 'fa-solid fa-boxes-packing' }
      ];
      const currentIdx = steps.findIndex(s => s.key === t.status);
      stepperHtml = '<div style="display:flex; align-items:center; width:100%; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:20px; direction:rtl;">';
      steps.forEach((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        const color = isCompleted ? '#10b981' : (isActive ? 'var(--primary)' : '#94a3b8');
        const bg = isCompleted ? '#dcfce7' : (isActive ? '#e0f2fe' : '#f1f5f9');
        const icon = isCompleted ? '<i class="fa-solid fa-check"></i>' : `<i class="${step.icon}"></i>`;

        stepperHtml += `
              <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; position:relative;">
                <div style="width:34px; height:34px; border-radius:50%; background:${bg}; color:${color}; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; z-index:2; transition: all 0.3s ease;">
                   ${icon}
                </div>
                <span style="font-size:10px; font-weight:700; color:${isActive ? 'var(--text-main)' : 'var(--text-muted)'};">${step.label}</span>
              </div>`;

        if (idx < steps.length - 1) {
          const lineColor = idx < currentIdx ? '#10b981' : '#e2e8f0';
          stepperHtml += `<div style="flex-grow:1; height:3px; background:${lineColor}; margin-top:-20px; z-index:1;"></div>`;
        }
      });
      stepperHtml += '</div>';
    } else {
      const isTransfer = t.txnType === 'internal_transfer' || t.txnType === 'return';
      if (isTransfer) {
        const steps = [
          { key: 'draft', label: 'طلب جديد', icon: 'fa-regular fa-file-lines' },
          { key: 'pending_approval', label: 'موافقة الإدارة', icon: 'fa-solid fa-user-check' },
          { key: 'approved', label: 'معتمد للشحن', icon: 'fa-solid fa-stamp' },
          { key: 'shipped', label: 'بالطريق', icon: 'fa-solid fa-truck-fast' },
          { key: 'confirmed', label: 'تم الاستلام', icon: 'fa-solid fa-boxes-packing' }
        ];
        const currentIdx = steps.findIndex(s => s.key === t.status);

        stepperHtml = '<div style="display:flex; align-items:center; width:100%; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:20px; direction:rtl;">';
        steps.forEach((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          const color = isCompleted ? '#10b981' : (isActive ? 'var(--primary)' : '#94a3b8');
          const bg = isCompleted ? '#dcfce7' : (isActive ? '#e0f2fe' : '#f1f5f9');
          const icon = isCompleted ? '<i class="fa-solid fa-check"></i>' : `<i class="${step.icon}"></i>`;

          stepperHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; position:relative;">
                  <div style="width:34px; height:34px; border-radius:50%; background:${bg}; color:${color}; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; z-index:2; transition: all 0.3s ease;">
                    ${icon}
                  </div>
                  <span style="font-size:10px; font-weight:700; color:${isActive ? 'var(--text-main)' : 'var(--text-muted)'};">${step.label}</span>
                </div>`;

          if (idx < steps.length - 1) {
            const lineColor = idx < currentIdx ? '#10b981' : '#e2e8f0';
            stepperHtml += `<div style="flex-grow:1; height:3px; background:${lineColor}; margin-top:-20px; z-index:1;"></div>`;
          }
        });
        stepperHtml += '</div>';
      } else {
        // Simple 2 steps
        const steps = [
          { key: 'draft', label: 'مسودة', icon: 'fa-regular fa-file-lines' },
          { key: 'confirmed', label: 'مكتمل ومؤكد', icon: 'fa-solid fa-circle-check' }
        ];
        const currentIdx = steps.findIndex(s => s.key === t.status);
        stepperHtml = '<div style="display:flex; align-items:center; width:100%; justify-content:space-between; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:20px; direction:rtl;">';
        steps.forEach((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isActive = idx === currentIdx;
          const color = isCompleted ? '#10b981' : (isActive ? 'var(--primary)' : '#94a3b8');
          const bg = isCompleted ? '#dcfce7' : (isActive ? '#e0f2fe' : '#f1f5f9');
          const icon = isCompleted ? '<i class="fa-solid fa-check"></i>' : `<i class="${step.icon}"></i>`;

          stepperHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; position:relative;">
                  <div style="width:34px; height:34px; border-radius:50%; background:${bg}; color:${color}; border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; z-index:2; transition: all 0.3s ease;">
                    ${icon}
                  </div>
                  <span style="font-size:10px; font-weight:700; color:${isActive ? 'var(--text-main)' : 'var(--text-muted)'};">${step.label}</span>
                </div>`;

          if (idx < steps.length - 1) {
            const lineColor = idx < currentIdx ? '#10b981' : '#e2e8f0';
            stepperHtml += `<div style="flex-grow:1; height:3px; background:${lineColor}; margin-top:-20px; z-index:1;"></div>`;
          }
        });
        stepperHtml += '</div>';
      }
    }
  }

  // Action card buttons logic
  let actionsHtml = '';
  if (t.txnType === 'laundry_transfer') {
    if (t.status === 'confirmed') {
      actionsHtml = `
            <div style="color:var(--success); font-size:44px;"><i class="fa-solid fa-circle-check"></i></div>
            <div style="font-weight:800; color:var(--success); font-size:13px;">تم فحص واستلام الشحنة وتفريغها بالمغسلة بنجاح!</div>`;
    } else if (t.status === 'shipped') {
      actionsHtml = `
            <div style="color:#0ea5e9; font-size:44px;"><i class="fa-solid fa-truck-fast"></i></div>
            <div style="font-weight:800; color:#0284c7; font-size:13px;">الشحنة بالطريق للمغسلة — بانتظار فحصها واستلامها من مسؤول المغسلة</div>`;
    } else {
      actionsHtml = `
            <div style="color:#64748b; font-size:44px;"><i class="fa-solid fa-file-signature"></i></div>
            <div style="font-weight:800; color:#64748b; font-size:13px;">الشحنة مسودة — بانتظار الشحن للمغسلة</div>`;
    }
  } else {
    const isTransfer = t.txnType === 'internal_transfer' || t.txnType === 'return';

    if (t.status === 'confirmed') {
      actionsHtml = `
            <div style="color:var(--success); font-size:44px;"><i class="fa-solid fa-circle-check"></i></div>
            <div style="font-weight:800; color:var(--success); font-size:13px;">تم تأكيد المعاملة واكتمال ترحيل الأرصدة</div>`;
    } else if (t.status === 'cancelled') {
      actionsHtml = `
            <div style="color:#ef4444; font-size:44px;"><i class="fa-solid fa-circle-xmark"></i></div>
            <div style="font-weight:800; color:#ef4444; font-size:13px;">هذه المعاملة ملغاة</div>`;
    } else {
      // Active transaction state
      const canSubmit = currentUser && ['admin', 'manager', 'warehouse_manager', 'warehouse_head'].includes(currentUser.role);
      const canApprove = currentUser && ['admin', 'manager', 'warehouse_manager'].includes(currentUser.role);
      if (t.status === 'draft') {
        if (isTransfer) {
          if (canSubmit) {
            actionsHtml += `<button class="btn" style="width:100%; background:linear-gradient(135deg,#6366f1,#8b5cf6); font-size:13px; margin-bottom:8px;" onclick="submitForApprovalLog(${t.txnId})"><i class="fa-solid fa-paper-plane"></i> إرسال لموافقة الإدارة</button>`;
          } else {
            actionsHtml += `<div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:10px; color:#64748b; font-size:12px; margin-bottom:8px; font-weight:700;"><i class="fa-solid fa-lock"></i> الطلب مسودة — يتم إرساله للموافقة من قِبل مدير المستودع</div>`;
          }
        } else {
          actionsHtml += `<button class="btn" style="width:100%; background:var(--success); font-size:13px; margin-bottom:8px;" onclick="confirmTransferLog(${t.txnId})"><i class="fa-solid fa-circle-check"></i> ترحيل وتأكيد الأرصدة</button>`;
        }
      } else if (t.status === 'pending_approval') {
        if (canApprove) {
          actionsHtml += `<button class="btn" style="width:100%; background:linear-gradient(135deg,#10b981,#059669); font-size:13px; margin-bottom:8px;" onclick="approveTransferLog(${t.txnId})"><i class="fa-solid fa-thumbs-up"></i> اعتماد وموافقة الطلب</button>`;
        } else {
          actionsHtml += `<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px; color:#d97706; font-size:12px; margin-bottom:8px; font-weight:700;"><i class="fa-solid fa-hourglass-half"></i> الطلب بانتظار موافقة مدير المستودع</div>`;
        }
      } else if (t.status === 'approved') {
        const isSourceNode = currentUser && (
          ['admin', 'manager'].includes(currentUser.role) ||
          (currentUser.nodeIds && currentUser.nodeIds.includes(t.fromNodeId)) ||
          currentUser.nodeId === t.fromNodeId
        );
        if (isSourceNode) {
          actionsHtml += `<button class="btn" style="width:100%; background:linear-gradient(135deg,#0ea5e9,#0284c7); font-size:13px; margin-bottom:8px;" onclick="dispatchTransferLog(${t.txnId})"><i class="fa-solid fa-truck-fast"></i> شحن وتسليم البضاعة</button>`;
        } else {
          actionsHtml += `<div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:8px; padding:10px; color:#4f46e5; font-size:12px; margin-bottom:8px; font-weight:700;"><i class="fa-solid fa-hourglass-half"></i> بانتظار شحن البضاعة من مخزن المصدر</div>`;
        }
      } else if (t.status === 'shipped') {
        const isDestNode = currentUser && (
          ['admin', 'manager'].includes(currentUser.role) ||
          (currentUser.nodeIds && currentUser.nodeIds.includes(t.toNodeId)) ||
          currentUser.nodeId === t.toNodeId
        );
        if (isDestNode) {
          actionsHtml += `<button class="btn" style="width:100%; background:linear-gradient(135deg,#10b981,#059669); font-size:13px; margin-bottom:8px;" onclick="receiveTransferLog(${t.txnId})"><i class="fa-solid fa-circle-check"></i> تأكيد الاستلام والتفريغ</button>`;
        } else {
          actionsHtml += `<div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px; color:#0284c7; font-size:12px; margin-bottom:8px; font-weight:700;"><i class="fa-solid fa-truck"></i> الشحنة بالطريق — بانتظار تأكيد الاستلام بالوجهة</div>`;
        }
      }

      // Cancel action (allow cancelling before confirmed state)
      actionsHtml += `<button class="btn btn-secondary" style="width:100%; border-color:#ef4444; color:#ef4444; font-size:12px;" onclick="cancelTransferLog(${t.txnId})"><i class="fa-solid fa-ban"></i> إلغاء المستند</button>`;
    }
  }

  document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"> <div><div class="selected-node-path">العمليات / تفاصيل مستند العمليات</div><div class="selected-node-title" style="font-size:22px;">مستند ' + trans[t.txnType] + ' OP-2026-' + String(t.txnId).padStart(3, "0") + '</div></div> <button class="btn btn-secondary" onclick="renderTransfersEmptyState()"><i class="fa-solid fa-xmark"></i> إغلاق</button> </div> ' + stepperHtml + ' <div class="flow-diagram-container"> <div class="flow-node"><i class="fa-solid fa-building" style="background: rgba(37, 99, 235, 0.1); color: var(--primary);"></i><span class="flow-node-name" title="' + flow.sourceName + '">' + flow.sourceName + '</span><span class="flow-node-type">' + flow.sourceLabel + '</span></div> <div class="flow-arrow-container"><svg width="100%" height="20" style="overflow: visible;"><line x1="0" y1="10" x2="100%" y2="10" stroke-width="4" stroke-dasharray="10 8" style="animation: strokeAnim ' + flow.speed + ' infinite linear; stroke: ' + flow.color + ';" /></svg></div> <div class="flow-node"><i class="fa-solid ' + flow.icon + '" style="background: ' + flow.color + '15; color: ' + flow.color + ';"></i><span class="flow-node-name" title="' + flow.destName + '">' + flow.destName + '</span><span class="flow-node-type">' + flow.destLabel + '</span></div> </div> <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:20px; text-align:right;"> <div class="table-card" style="padding: 20px; display:flex; flex-direction:column; gap:12px;"> <div style="font-size:14px; font-weight:800; border-bottom:1px solid #f1f5f9; padding-bottom:8px; color:var(--text-main);">بيانات المعاملة التشغيلية</div> <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px;"> <div><span style="color:var(--text-muted);">رقم المستند:</span> <strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></div> <div><span style="color:var(--text-muted);">نوع المستند:</span> <span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span></div> <div><span style="color:var(--text-muted);">حالة المستند:</span> <span class="badge" style="' + sm.style + '">' + sm.label + '</span></div> <div><span style="color:var(--text-muted);">تاريخ الإنشاء:</span> <strong style="font-size:11px;">' + new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG') + '</strong></div> <div><span style="color:var(--text-muted);">المسؤول / منشئ الحركة:</span> <strong style="color:var(--primary); font-weight:800;"><i class="fa-solid fa-user-gear"></i> ' + (t.creatorUsername || 'النظام') + '</strong></div> <div><span style="color:var(--text-muted);">تاريخ التأكيد النهائي:</span> <strong style="font-size:11px;">' + (t.confirmedAt ? new Date(t.confirmedAt).toLocaleDateString('ar-EG') : '-') + '</strong></div> </div> <div style="font-size:13px; margin-top:5px; border-top:1px solid #f1f5f9; padding-top:10px;"><span style="color:var(--text-muted);">سبب الحركة / الملاحظات:</span><p style="background:#f8fafc; padding:10px 15px; border-radius:8px; margin-top:5px; font-style:italic; border:1px solid #e2e8f0; font-size:12px;">' + (t.notes || 'لا يوجد ملاحظات') + '</p></div> </div> <div class="table-card" style="padding: 20px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; text-align:center;"> <div style="font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:4px;">إجراءات المعاملة</div> ' + actionsHtml + ' </div> </div> <div class="table-card" style="padding:20px;"> <div style="font-size:14px; font-weight:800; margin-bottom:12px; color:var(--text-main);">أصناف مستند الحركة</div> <div style="overflow-x: auto; border:1px solid var(--card-border); border-radius:12px;"> <table style="width:100%; border-collapse:collapse;"> <thead><tr style="background:#f8fafc;"><th style="padding:10px;">كود الصنف</th><th style="padding:10px;">اسم الصنف</th><th style="padding:10px;">الكمية</th><th style="padding:10px;">سعر التكلفة</th><th style="padding:10px;">الإجمالي</th></tr></thead> <tbody> ' + t.lines.map(l => '<tr><td>' + l.itemCode + '</td><td><strong>' + (l.itemNameAr || 'صنف') + '</strong></td><td><span style="font-weight:700; color:var(--primary);">' + l.quantity.toLocaleString() + '</span></td><td>' + l.unitCost.toLocaleString() + ' ج.م</td><td><strong>' + (l.quantity * l.unitCost).toLocaleString() + ' ج.م</strong></td></tr>').join('') + ' <tr style="background:#f8fafc; font-weight:800; border-top:2px solid var(--card-border);"><td colspan="2" style="text-align:left; padding:12px;">الإجمالي العام:</td><td style="color:var(--primary); padding:12px;">' + totalQty.toLocaleString() + ' وحدة</td><td>-</td><td style="color:#0f172a; padding:12px;">' + totalCost.toLocaleString() + ' ج.م</td></tr> </tbody> </table> </div> </div> ';
}

function showNewTransferForm() {
  document.querySelectorAll('.transfer-card').forEach(c => c.classList.remove('active'));
  document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"> <div><div class="selected-node-path">العمليات / تسجيل قيد جديد</div><div class="selected-node-title" style="font-size:22px;">تسجيل عملية تشغيلية جديدة بالعهدة</div></div> <button class="btn btn-secondary" onclick="renderTransfersEmptyState()"><i class="fa-solid fa-xmark"></i> إلغاء</button> </div> <div class="table-card" style="padding: 24px; text-align:right;"> <form id="tf-wizard-form" style="display:flex; flex-direction:column; gap:16px;"> <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;"> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">نوع المعاملة التشغيلية</label><select id="tf-wizard-type" class="table-select" style="width:100%; padding:10px;" required><option value="op_allocate">صرف وتوزيع داخلي للمخزن التشغيلي (Allocate)</option><option value="op_consume">استهلاك من مخزن تشغيلي فرعي (Consume)</option><option value="op_return">إرجاع فائض من مخزن تشغيلي فرعي (Return)</option><option value="op_adjustment">تسوية رصيد مخزن تشغيلي فرعي (Adjustment)</option><option value="consumption">استهلاك تشغيلي (Consumption)</option><option value="internal_transfer">تحويل داخلي (Internal Transfer)</option><option value="laundry_transfer">شحن للمغسلة (Send to Laundry)</option><option value="waste">هدر خامات ومواد (Waste)</option><option value="damage">تلف سلع (Damage)</option><option value="return">مرتجع مستودع رئيسي (Return)</option><option value="disposal">تكهين واستبعاد أصول (Disposal)</option></select></div> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">مستودع العهدة المصدر</label><select id="tf-wizard-source-node" class="table-select" style="width:100%; padding:10px;" required><option value="">اختر المخزن المسؤول...</option></select></div> </div> <div id="wizard-dynamic-fields-container" style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:12px; display:none;"></div> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">تفاصيل إضافية / ملاحظات المستند</label><input type="text" id="tf-wizard-notes" class="input-control" placeholder="أدخل سبب المعاملة..." required style="padding:10px 15px;"></div> <div style="border-top: 1px solid #f1f5f9; padding-top:16px; margin-top:5px;"> <div style="font-size:14px; font-weight:700; margin-bottom:12px; color:var(--primary); display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-square-plus"></i> إضافة أصناف الحركة</div> <div style="display:grid; grid-template-columns: 1fr 100px 120px 60px; gap:12px; align-items:flex-end;"> <div class="form-group" style="margin-bottom:0; display:flex; flex-direction:column; gap:4px;"><label style="font-size:12px; display:flex; justify-content:space-between; align-items:center; font-weight:700;"><span>البحث واختيار الصنف</span><span id="tf-wizard-available-stock-indicator" style="color:var(--success); font-weight:800; font-size:11px; display:none;"></span></label><input type="text" id="tf-wizard-item-search" class="input-control" placeholder="🔍 اكتب كود أو اسم الصنف للبحث..." style="padding:6px 10px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box;"><select id="tf-wizard-item-select" class="table-select" style="width:100%; padding:9px;"><option value="">اختر صنف للعملية...</option></select></div> <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">الكمية</label><input type="number" id="tf-wizard-item-qty" class="input-control" placeholder="الكمية" style="padding:9px;" step="any"></div> <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">سعر التكلفة (ج.م)</label><input type="number" id="tf-wizard-item-cost" class="input-control" placeholder="التكلفة" style="padding:9px;" step="any"></div> <button type="button" class="btn" style="padding:10px 0; height: 40px; display:flex; align-items:center; justify-content:center;" onclick="addTransferLineItem()"><i class="fa-solid fa-plus"></i></button> </div> <div id="tf-wizard-item-restriction-warning" style="font-size:11px; color:var(--danger); font-weight:700; margin-top:5px; display:none;"><i class="fa-solid fa-triangle-exclamation"></i> تم تصفية الأصناف طبقاً لنوع الحركة لحماية جودة البيانات.</div> </div> <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px; margin-top:5px;"><table style="font-size:13px; width:100%; border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px; border-bottom:1px solid #e2e8f0;">اسم الصنف</th><th style="padding:10px; border-bottom:1px solid #e2e8f0;">الكمية</th><th style="padding:10px; border-bottom:1px solid #e2e8f0;">التكلفة</th><th style="padding:10px; border-bottom:1px solid #e2e8f0; width:60px; text-align:center;">حذف</th></tr></thead><tbody id="tf-wizard-lines-body"><tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لم يتم إضافة أصناف للحركة بعد</td></tr></tbody></table></div> <div style="display:flex; gap:12px; justify-content:flex-end; border-top:1px solid #f1f5f9; padding-top:16px; margin-top:10px;"><button type="submit" class="btn" style="padding:10px 24px;"><i class="fa-solid fa-floppy-disk"></i> حفظ الحركة التشغيلية</button><button type="button" class="btn btn-secondary" style="padding:10px 20px;" onclick="renderTransfersEmptyState()">إلغاء</button></div> </form> </div> ';
  newTransferLineItems = []; populateModalNodeDropdowns(); setupWizardListeners();

  document.getElementById('tf-wizard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('tf-wizard-type').value, fromNodeId = document.getElementById('tf-wizard-source-node').value, notes = document.getElementById('tf-wizard-notes').value;
    if (!fromNodeId) { alert('الرجاء اختيار المستودع المصدر'); return; }
    if (newTransferLineItems.length === 0) { alert('الرجاء إضافة صنف واحد للحركة'); return; }

    // Check if it's one of the operational sub-warehouse transaction types
    if (['op_allocate', 'op_consume', 'op_return', 'op_adjustment'].includes(type)) {
      const locId = document.getElementById('tf-wizard-op-location')?.value;
      if (!locId) { alert('الرجاء اختيار المخزن التشغيلي الفرعي للوجهة/المصدر'); return; }

      const endpoint = type === 'op_allocate' ? 'allocate' : type === 'op_consume' ? 'consume' : type === 'op_return' ? 'return' : 'adjustment';
      const promises = newTransferLineItems.map(item => {
        return apiFetch(`/operational/locations/${locId}/${endpoint}`, 'POST', {
          itemCode: item.itemCode,
          quantity: parseFloat(item.quantity),
          notes: notes || 'عملية توزيع داخلي من مركز العمليات'
        });
      });

      try {
        const results = await Promise.all(promises);
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          notify(`فشل تسجيل بعض المعاملات: ${failed.map(f => f.message).join(', ')}`, 'error');
        } else {
          notify('تم تسجيل عمليات الصرف والتوزيع الداخلي للموقع بنجاح!', 'success');
          renderTransfersEmptyState();
          await loadTransfers();
        }
      } catch (err) {
        notify('حدث خطأ أثناء الاتصال بالخادم لحفظ المعاملة التشغيلية', 'error');
      }
      return;
    }

    if (type === 'laundry_transfer') {
      const serviceType = document.getElementById('tf-wizard-service-type')?.value || 'washing';
      const serviceText = serviceType === 'ironing' ? 'كي ومكواة' : 'غسيل وتعقيم';
      const notesText = `[نوع الخدمة: ${serviceText}] - ${notes}`;

      const body = {
        fromWarehouseId: parseInt(fromNodeId),
        notes: notesText,
        items: newTransferLineItems.map(l => ({
          itemCode: l.itemCode,
          itemNameAr: l.itemNameAr,
          sentQty: l.quantity,
          unitCode: l.unitNameAr || 'PCS',
          unitCost: l.unitCost || 0
        }))
      };
      try {
        const res = await apiFetch('/laundry/transfers', 'POST', body);
        if (res.success) {
          const transferId = res.data.transferId;
          // Auto dispatch it to the laundry
          await apiFetch(`/laundry/transfers/${transferId}/send`, 'POST', {});
          notify('تم شحن وإرسال البياضات للمغسلة بنجاح وجاري النقل للفرز!', 'success');
          renderTransfersEmptyState();
        }
      } catch (err) {
        notify('خطأ عند شحن البياضات للمغسلة: ' + err.message, 'error');
      }
      return;
    }

    let toNodeId = null, extraNotes = notes;
    if (type === 'internal_transfer') {
      const val = document.getElementById('tf-dest-node').value; if (!val) { alert('الرجاء اختيار مستودع الوجهة'); return; }
      toNodeId = parseInt(val);
    } else if (type === 'return') { toNodeId = 1; }
    else if (type === 'consumption') { extraNotes = '[مركز التكلفة: ' + document.getElementById('tf-cost-center').value + '] - ' + notes; }
    else if (type === 'waste') { extraNotes = '[سبب الهدر: ' + document.getElementById('tf-waste-reason').value + '] - ' + notes; }
    else if (type === 'damage') { extraNotes = '[سبب التلف: ' + document.getElementById('tf-damage-reason').value + '] - ' + notes; }
    else if (type === 'disposal') { extraNotes = '[تقرير التكهين: ' + document.getElementById('tf-disposal-ref').value + '] - ' + notes; }

    const body = { txnType: type, fromNodeId: parseInt(fromNodeId), toNodeId, notes: extraNotes, lines: newTransferLineItems };
    try {
      const res = await apiFetch('/transactions/transfers', 'POST', body);
      if (res.success) {
        notify('تم حفظ مسودة الحركة التشغيلية بنجاح!', 'success');
        await loadTransfers(); viewTransferDetails(res.data.txnId);
      }
    } catch (err) { notify('خطأ عند إنشاء المستند', 'error'); }
  });
}

function populateModalNodeDropdowns() {
  const sel = document.getElementById('tf-wizard-source-node'); if (!sel) return;
  sel.innerHTML = '<option value="">اختر المخزن المسؤول...</option>';
  apiFetch('/hierarchy/tree').then(res => {
    if (res.success && res.data) {
      const rootNodes = res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []);
      const list = getChildNodesList(rootNodes);
      const opts = ['<option value="">اختر المخزن المسؤول...</option>'];
      list.forEach(c => { opts.push('<option value="' + c.id + '">' + c.nodeNameAr + '</option>'); });
      sel.innerHTML = opts.join('');
    }
  });
}

function setupWizardListeners() {
  const typeSel = document.getElementById('tf-wizard-type'), srcSel = document.getElementById('tf-wizard-source-node'), container = document.getElementById('wizard-dynamic-fields-container'), itemSel = document.getElementById('tf-wizard-item-select'), warningText = document.getElementById('tf-wizard-item-restriction-warning');
  if (!typeSel || !srcSel) return;
  const update = () => {
    const type = typeSel.value, srcVal = srcSel.value; container.style.display = 'block';

    const populateItemDropdown = (query = '') => {
      let filtered = localItemsList, restricted = false;
      if (type === 'consumption' || type === 'waste' || type === 'op_consume') { filtered = localItemsList.filter(i => i.itemType === 'consumable'); restricted = true; }
      else if (type === 'return' || type === 'op_return') { filtered = localItemsList.filter(i => i.itemType === 'returnable' || i.itemType === 'durable'); restricted = true; }
      else if (type === 'disposal') { filtered = localItemsList.filter(i => i.itemType === 'durable'); restricted = true; }
      warningText.style.display = restricted ? 'block' : 'none';

      // Only show items that have stock greater than zero
      filtered = filtered.filter(i => {
        const stockItem = wizardSourceWarehouseStock.find(si => si.itemCode === i.itemCode);
        return stockItem && stockItem.qtyOperational > 0;
      });

      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(i => i.itemCode.toLowerCase().includes(q) || (i.itemNameAr && i.itemNameAr.toLowerCase().includes(q)));
      }

      const opts = ['<option value="">اختر صنف للعملية...</option>'];
      filtered.forEach(i => {
        const stockItem = wizardSourceWarehouseStock.find(si => si.itemCode === i.itemCode);
        const qty = stockItem ? stockItem.qtyOperational : 0;
        opts.push('<option value="' + i.itemCode + '">' + i.itemCode + ' - ' + i.itemNameAr + ' (المتاح بالعهدة: ' + qty.toLocaleString() + ' ' + (i.unitNameAr || 'حبة') + ')</option>');
      });
      itemSel.innerHTML = opts.join('');
    };

    // Fetch source warehouse stock in real-time
    if (srcVal) {
      apiFetch('/hierarchy/nodes/' + srcVal + '/stock').then(res => {
        if (res.success) {
          wizardSourceWarehouseStock = res.data.items || [];
          populateItemDropdown();
          updateAvailableStockDisplay();
        } else {
          wizardSourceWarehouseStock = [];
          populateItemDropdown();
          updateAvailableStockDisplay();
        }
      }).catch(err => {
        console.error('Error fetching source stock', err);
        wizardSourceWarehouseStock = [];
        populateItemDropdown();
        updateAvailableStockDisplay();
      });
    } else {
      wizardSourceWarehouseStock = [];
      populateItemDropdown();
      updateAvailableStockDisplay();
    }

    if (type === 'consumption') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">مركز التكلفة / الجهة المستهلكة</label><input type="text" id="tf-cost-center" class="input-control" placeholder="مثال: بوفيه العشاء..." required style="padding:10px;"></div>';
    } else if (['op_allocate', 'op_consume', 'op_return', 'op_adjustment'].includes(type)) {
      container.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
          <label style="font-weight:700;">المخزن التشغيلي الفرعي (التوزيع الداخلي)</label>
          <select id="tf-wizard-op-location" class="table-select" style="width:100%; padding:10px;" required>
            <option value="">جاري تحميل الفروع التشغيلية...</option>
          </select>
        </div>
      `;
      // Populate locations
      if (srcVal) {
        apiFetch(`/operational/nodes/${srcVal}/locations`).then(locRes => {
          const locSel = document.getElementById('tf-wizard-op-location');
          if (locSel) {
            const opts = ['<option value="">اختر المخزن التشغيلي الفرعي...</option>'];
            if (locRes.success && locRes.data && locRes.data.length > 0) {
              locRes.data.forEach(loc => {
                opts.push(`<option value="${loc.id}">${loc.name}</option>`);
              });
            } else {
              opts.push('<option value="">لا يوجد مخازن تشغيلية مضافة لهذا المستودع</option>');
            }
            locSel.innerHTML = opts.join('');
            locSel.addEventListener('change', updateAvailableStockDisplay);
          }
        });
      }
    } else if (type === 'internal_transfer') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">المستودع المستقبل (الوجهة)</label><select id="tf-dest-node" class="table-select" style="width:100%; padding:10px;" required><option value="">اختر مخزن الوجهة...</option></select></div>';
      const dSel = document.getElementById('tf-dest-node');
      apiFetch('/hierarchy/tree?ignoreScope=true').then(res => {
        if (res.success && res.data) {
          let allNodesList = [];
          if (Array.isArray(res.data)) {
            res.data.forEach(group => { if (group.nodes) allNodesList.push(...group.nodes); });
          } else if (res.data.nodes) {
            allNodesList = res.data.nodes;
          }
          const list = getChildNodesList(allNodesList);
          const opts = ['<option value="">اختر مخزن الوجهة...</option>'];
          list.forEach(c => { if (c.id.toString() !== srcVal) opts.push('<option value="' + c.id + '">' + c.nodeNameAr + '</option>'); });
          dSel.innerHTML = opts.join('');
        }
      });
    } else if (type === 'laundry_transfer') {
      container.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-weight:700;">المستقبل (الوجهة)</label>
            <input type="text" class="input-control" value="المغسلة + (كود 136)" readonly style="padding:10px; background:#e2e8f0; font-weight:700;">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-weight:700;">نوع الخدمة المطلوبة</label>
            <select id="tf-wizard-service-type" class="table-select" style="width:100%; padding:10px;" required>
              <option value="washing">غسيل وتعقيم (Washing)</option>
              <option value="ironing">كي ومكواة (Ironing)</option>
            </select>
          </div>
        </div>
      `;
    } else if (type === 'waste') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">سبب الهدر</label><select id="tf-waste-reason" class="table-select" style="width:100%; padding:10px;" required><option value="expired">انتهاء الصلاحية</option><option value="cooler_failure">عطل في التبريد</option><option value="other">أخرى...</option></select></div>';
    } else if (type === 'damage') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">سبب التلف</label><input type="text" id="tf-damage-reason" class="input-control" placeholder="سبب التلف..." required style="padding:10px;"></div>';
    } else if (type === 'return') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">المستودع الرئيسي المستقبل</label><input type="text" class="input-control" value="المخزن الرئيسي للأغذية والمشروبات 001" readonly style="padding:10px; background:#e2e8f0; font-weight:700;"></div>';
    } else if (type === 'disposal') {
      container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">رقم تقرير التخريد واللجنة</label><input type="text" id="tf-disposal-ref" class="input-control" placeholder="تقرير لجنة التكهين رقم..." required style="padding:10px;"></div>';
    } else { container.style.display = 'none'; }

    newTransferLineItems = []; renderTransferLineItemsTable();

    const itemSearch = document.getElementById('tf-wizard-item-search');
    if (itemSearch) {
      itemSearch.value = '';
      const newSearch = itemSearch.cloneNode(true);
      itemSearch.parentNode.replaceChild(newSearch, itemSearch);
      newSearch.addEventListener('input', (e) => {
        populateItemDropdown(e.target.value.trim());
      });
    }
  };
  typeSel.addEventListener('change', update);
  srcSel.addEventListener('change', update);
  itemSel.addEventListener('change', updateAvailableStockDisplay);
  update();
}

function renderTransferLineItemsTable() {
  const tbody = document.getElementById('tf-wizard-lines-body'); if (!tbody) return; tbody.innerHTML = '';
  if (newTransferLineItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لم يتم إضافة أصناف للحركة بعد</td></tr>'; return;
  }
  const rows = [];
  newTransferLineItems.forEach((l, idx) => {
    rows.push('<tr> <td style="padding:10px; border-bottom:1px solid #e2e8f0;"><strong>' + l.itemNameAr + '</strong></td> <td style="padding:10px; border-bottom:1px solid #e2e8f0;"><span style="font-weight:700; color:var(--primary);">' + l.quantity + '</span> ' + l.unitNameAr + '</td> <td style="padding:10px; border-bottom:1px solid #e2e8f0;">' + l.unitCost + ' ج.م</td> <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;"><button type="button" class="btn btn-secondary" style="padding:5px 10px; color:var(--danger); border-color:var(--danger);" onclick="removeTransferLineItem(' + idx + ')"><i class="fa-solid fa-trash-can"></i></button></td> </tr>');
  });
  tbody.innerHTML = rows.join('');
}

function addTransferLineItem() {
  const itemSel = document.getElementById('tf-wizard-item-select'), qtyIn = document.getElementById('tf-wizard-item-qty'), costIn = document.getElementById('tf-wizard-item-cost');
  if (!itemSel || !qtyIn || !costIn) return;
  const code = itemSel.value, qty = parseFloat(qtyIn.value), cost = parseFloat(costIn.value);
  if (!code || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) { alert('الرجاء إدخال بيانات صحيحة'); return; }

  // Validate available stock limit check
  const matchedStock = wizardSourceWarehouseStock.find(i => i.itemCode === code);
  const availQty = matchedStock ? matchedStock.qtyOperational : 0;

  const existing = newTransferLineItems.find(l => l.itemCode === code);
  const totalRequested = qty + (existing ? existing.quantity : 0);

  if (totalRequested > availQty) {
    notify('الكمية المطلوبة تتجاوز الرصيد المتوفر بالعهدة (' + availQty + ')!', 'error');
    alert('خطأ: الكمية المطلوبة تتجاوز الرصيد المتوفر بالعهدة (' + availQty + ')');
    return;
  }

  const item = localItemsList.find(i => i.itemCode === code); if (!item) return;
  if (existing) existing.quantity += qty;
  else newTransferLineItems.push({ itemCode: code, itemNameAr: item.itemNameAr, quantity: qty, unitCost: cost, unitNameAr: item.unitNameAr || 'حبة' });

  itemSel.value = ''; qtyIn.value = ''; costIn.value = '';

  const indicator = document.getElementById('tf-wizard-available-stock-indicator');
  if (indicator) { indicator.style.display = 'none'; indicator.innerText = ''; }

  renderTransferLineItemsTable();
}

function removeTransferLineItem(idx) { newTransferLineItems.splice(idx, 1); renderTransferLineItemsTable(); }
function toggleTransferModal(show) { const m = document.getElementById('create-transfer-modal'); if (m) m.style.display = show ? 'flex' : 'none'; }
function toggleDetailsModal(show) { const m = document.getElementById('transfer-details-modal'); if (m) m.style.display = show ? 'flex' : 'none'; }

async function renderDashboard() {
  try {
    const txRes = await apiFetch('/transactions/transfers');
    const itemsRes = await apiFetch('/master-data/items');
    const stockRes = await apiFetch('/hierarchy/stock?groupId=' + currentGroupId);

    let txns = txRes.success ? txRes.data : [];
    let items = itemsRes.success ? itemsRes.data : [];

    let totalVal = 0;
    let totalTx = txns.length;
    let monthlyCons = 0;

    let categoriesStock = {};
    let totalQty = 0;

    if (stockRes.success) {
      stockRes.data.forEach(itm => {
        const cost = 150; // Fallback cost as used in report
        const qty = itm.qtyOperational || 0;
        totalVal += qty * cost;
        totalQty += qty;

        const cat = itm.categoryCode || 'أغذية ومشروبات';
        categoriesStock[cat] = (categoriesStock[cat] || 0) + qty;
      });
    }

    txns.forEach(t => {
      if (t.txnType === 'consumption' && t.status === 'confirmed') {
        t.lines.forEach(l => {
          monthlyCons += (l.quantity || 0) * (l.unitCost || 0);
        });
      }
    });

    document.getElementById('db-total-value').innerText = totalVal.toLocaleString() + ' ج.م';
    document.getElementById('db-total-txns').innerText = totalTx;
    document.getElementById('db-monthly-consumption').innerText = monthlyCons.toLocaleString() + ' ج.م';

    const body = document.getElementById('db-recent-txns-body'); body.innerHTML = '';
    const trans = { consumption: 'استهلاك تشغيلي', internal_transfer: 'تحويل داخلي', waste: 'هدر مواد', damage: 'تلف سلع', return: 'مرتجع للمخزن', disposal: 'تكهين واستبعاد' };

    const recentRows = [];
    txns.slice(0, 5).forEach(t => {
      const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG');
      let typeBadge = '<span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span>';
      const statusMeta = {
        draft: { label: 'مسودة', class: 'badge-warning', style: 'background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1;' },
        pending_approval: { label: 'طلب جديد', class: 'badge-warning', style: 'background:#fffbeb; color:#d97706; border:1px solid #fde68a;' },
        approved: { label: 'معتمد', class: 'badge-success', style: 'background:#eef2ff; color:#4f46e5; border:1px solid #c7d2fe;' },
        shipped: { label: 'بالطريق', class: 'badge-success', style: 'background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd;' },
        confirmed: { label: 'مؤكدة', class: 'badge-success', style: 'background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;' },
        cancelled: { label: 'ملغية', class: 'badge-danger', style: 'background:#fef2f2; color:#dc2626; border:1px solid #fecaca;' }
      };
      const sm = statusMeta[t.status] || { label: t.status, class: 'badge-warning', style: '' };
      let statusBadge = '<span class="badge ' + sm.class + '" style="font-size:10px; ' + sm.style + '">' + sm.label + '</span>';
      recentRows.push('<tr style="cursor:pointer;" onclick="goToTransactionDetails(' + t.txnId + ')"> ' +
        '<td><strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></td>' +
        '<td>' + typeBadge + '</td>' +
        '<td>' + (t.fromNodeNameAr || t.nodeNameAr || 'مستودع فرعي') + '</td>' +
        '<td style="font-size:11px;">' + dateStr + '</td>' +
        '<td>' + statusBadge + '</td> ' +
        '</tr>');
    });
    body.innerHTML = recentRows.join('');

    const dist = document.getElementById('db-distribution-container'); dist.innerHTML = '';
    const colors = ['#0066ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7']; let colorIdx = 0;

    const distRows = [];
    for (const c in categoriesStock) {
      const qty = categoriesStock[c];
      const pct = Math.round((qty / (totalQty || 1)) * 100);
      const col = colors[colorIdx++ % colors.length];
      distRows.push('<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px;"><span style="font-weight:700;">' + c + '</span><span style="font-weight:800; color:' + col + ';">' + qty.toLocaleString() + ' وحدة (' + pct + '%)</span></div> <div class="progress-bar" style="height:6px;"><div class="progress-fill" style="width:' + pct + '%; background-color:' + col + ';"></div></div>');
    }
    dist.innerHTML = distRows.join('');
  } catch (err) {
    console.error('Error rendering dashboard', err);
  }
}

function initSearchView() {
  searchStockCache = null;
  const sel = document.getElementById('search-view-warehouse'); sel.innerHTML = '<option value="all">كل المستودعات الفرعية</option>';
  apiFetch('/hierarchy/tree').then(res => {
    if (res.success) {
      const list = getChildNodesList(res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []));
      const opts = ['<option value="all">كل المستودعات الفرعية</option>'];
      list.forEach(c => { opts.push('<option value="' + c.id + '">' + c.nodeNameAr + '</option>'); });
      sel.innerHTML = opts.join('');
    }
  });
  document.getElementById('search-view-input').value = ''; sel.value = 'all'; document.getElementById('search-view-type').value = 'all';
  renderSearchResults(false);
  document.getElementById('search-view-input').oninput = () => { renderSearchResults(true); };
  sel.onchange = () => { renderSearchResults(true); };
  document.getElementById('search-view-type').onchange = () => { renderSearchResults(true); };
}

async function renderSearchResults(useCache = false) {
  const tbody = document.getElementById('search-view-results-body');
  const q = document.getElementById('search-view-input').value.toLowerCase().trim(), wh = document.getElementById('search-view-warehouse').value, ty = document.getElementById('search-view-type').value;

  try {
    if (!useCache || !searchStockCache) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</td></tr>';
      const stockRes = await apiFetch('/hierarchy/stock?groupId=' + currentGroupId);
      if (!stockRes.success) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">فشل تحميل البيانات من الخادم</td></tr>';
        return;
      }
      searchStockCache = stockRes.data;
    }

    const res = [];
    searchStockCache.forEach(item => {
      if (item.qtyOperational <= 0) return;
      if (wh !== 'all' && item.nodeId.toString() !== wh) return;
      if (q && !item.itemCode.toLowerCase().includes(q) && !item.itemNameAr.toLowerCase().includes(q)) return;
      if (ty !== 'all' && item.itemType !== ty) return;
      res.push({ code: item.itemCode, name: item.itemNameAr, whName: item.nodeNameAr, qty: item.qtyOperational, unit: item.unitNameAr || 'حبة', type: item.itemType, cost: item.unitCost || 0 });
    });

    tbody.innerHTML = '';
    if (res.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>لا توجد نتائج بحث.</p></div></td></tr>'; return;
    }
    const trans = { consumable: 'استهلاكي', returnable: 'مستعار', durable: 'أصل مستديم' }, badges = { consumable: 'badge-type-consumption', returnable: 'badge-type-return', durable: 'badge-type-disposal' };
    const rows = [];
    res.forEach(r => {
      rows.push('<tr> <td>' + r.code + '</td><td style="font-weight:700;">' + r.name + '</td><td>' + r.whName + '</td><td><span style="font-weight:700; color:var(--primary);">' + r.qty.toLocaleString() + '</span></td><td>' + r.unit + '</td><td><span class="badge ' + badges[r.type] + '">' + trans[r.type] + '</span></td><td>' + (r.cost ? r.cost.toLocaleString() + ' ج.م' : '0 ج.م') + '</td> </tr>');
    });
    tbody.innerHTML = rows.join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">حدث خطأ أثناء تحميل نتائج البحث.</td></tr>';
  }
}

async function renderLowStockView() {
  const tbody = document.getElementById('low-stock-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب النواقص...</td></tr>';

  try {
    const stockRes = await apiFetch('/hierarchy/stock?groupId=' + currentGroupId);
    if (!stockRes.success) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">فشل جلب النواقص من الخادم.</td></tr>';
      return;
    }

    const res = [];
    const limit = 50; let low = 0, total = 0;

    stockRes.data.forEach(i => {
      const qty = i.qtyOperational || 0;
      total++;
      if (qty < limit) { res.push({ code: i.itemCode, name: i.itemNameAr, whName: i.nodeNameAr, qty, limit }); low++; }
    });

    document.getElementById('low-stock-count').innerText = low;
    document.getElementById('low-stock-percent').innerText = (total ? Math.round(low / total * 100) : 0) + '%';

    tbody.innerHTML = '';
    if (res.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="color:var(--success);"><i class="fa-solid fa-circle-check" style="font-size:32px;"></i><p>كل المستودعات آمنة!</p></div></td></tr>'; return;
    }
    const rows = [];
    res.sort((a, b) => a.qty - b.qty).forEach(r => {
      rows.push('<tr> <td>' + r.code + '</td><td style="font-weight:700;">' + r.name + '</td><td>' + r.whName + '</td><td><span style="font-weight:800; color:' + (r.qty === 0 ? 'var(--danger)' : 'var(--warning)') + ';">' + r.qty.toLocaleString() + '</span></td><td>' + r.limit + '</td><td><span class="badge ' + (r.qty === 0 ? 'badge-danger' : 'badge-warning') + '">' + (r.qty === 0 ? 'نفاد تام' : 'منخفض') + '</span></td> </tr>');
    });
    tbody.innerHTML = rows.join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">حدث خطأ أثناء تحميل النواقص.</td></tr>';
  }
}

document.getElementById('btn-sync-all').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-all'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> جاري تحديث الأرصدة...';
  try {
    const res = await apiFetch('/sync/run', 'POST', { division: 'fb' });
    if (res.success) {
      notify('تم مزامنة أرصدة كومسيس بنجاح!', 'success');
      searchStockCache = null;
      if (activeView === 'explorer') { await loadTree(); if (selectedNodeId) loadNodeStock({ id: selectedNodeId, nodeNameAr: document.getElementById('selected-node-title').innerText }); }
      else if (activeView === 'transfers') await loadTransfers();
      else if (activeView === 'dashboard') renderDashboard();
      else if (activeView === 'search') renderSearchResults();
      else if (activeView === 'low') renderLowStockView();
    }
  } catch (err) { notify('فشلت مزامنة قاعدة البيانات', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> تحديث'; }
});

function switchView(viewName) {
  activeView = viewName;
  document.getElementById('menu-dashboard').classList.remove('active');
  document.getElementById('menu-explorer').classList.remove('active');
  document.getElementById('menu-search').classList.remove('active');
  document.getElementById('menu-low').classList.remove('active');
  document.getElementById('menu-transfers').classList.remove('active');
  document.getElementById('menu-inbound').classList.remove('active');
  const menuLaundry = document.getElementById('menu-laundry');
  if (menuLaundry) menuLaundry.classList.remove('active');
  const menuUsers = document.getElementById('menu-users');
  if (menuUsers) menuUsers.classList.remove('active');
  const menuPerms = document.getElementById('menu-permissions');
  if (menuPerms) menuPerms.classList.remove('active');

  document.getElementById('explorer-view').style.display = 'none';
  document.getElementById('transfers-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('search-view').style.display = 'none';
  document.getElementById('low-view').style.display = 'none';
  document.getElementById('inbound-view').style.display = 'none';
  const laundryView = document.getElementById('laundry-view');
  if (laundryView) laundryView.style.display = 'none';
  const usersView = document.getElementById('users-view');
  if (usersView) usersView.style.display = 'none';
  const permView = document.getElementById('permissions-view');
  if (permView) permView.style.display = 'none';

  if (viewName === 'explorer') {
    document.getElementById('menu-explorer').classList.add('active');
    document.getElementById('explorer-view').style.display = 'grid';
    loadTree();
  } else if (viewName === 'transfers') {
    document.getElementById('menu-transfers').classList.add('active');
    document.getElementById('transfers-view').style.display = 'grid';
    loadTransfers();
    loadLocalItems();
  } else if (viewName === 'laundry') {
    if (menuLaundry) menuLaundry.classList.add('active');
    if (laundryView) laundryView.style.display = 'grid';
    renderLaundryView();
  } else if (viewName === 'dashboard') {
    document.getElementById('menu-dashboard').classList.add('active');
    document.getElementById('dashboard-view').style.display = 'grid';
    renderDashboard();
  } else if (viewName === 'search') {
    document.getElementById('menu-search').classList.add('active');
    document.getElementById('search-view').style.display = 'grid';
    initSearchView();
  } else if (viewName === 'low') {
    document.getElementById('menu-low').classList.add('active');
    document.getElementById('low-view').style.display = 'grid';
    renderLowStockView();
  } else if (viewName === 'inbound') {
    document.getElementById('menu-inbound').classList.add('active');
    document.getElementById('inbound-view').style.display = 'grid';
    loadInboundTransactions();
  } else if (viewName === 'users') {
    if (menuUsers) menuUsers.classList.add('active');
    if (usersView) usersView.style.display = 'grid';
    loadUsersView();
  } else if (viewName === 'permissions') {
    if (menuPerms) menuPerms.classList.add('active');
    if (permView) permView.style.display = 'grid';
    loadPermissionsMatrix();
  }
}

function switchExplorerTab(tabName) {
  explorerActiveTab = tabName;
  document.getElementById('tab-btn-stock').classList.remove('active');
  document.getElementById('tab-btn-movement').classList.remove('active');
  document.getElementById('tab-btn-transactions').classList.remove('active');

  const tabSub = document.getElementById('tab-btn-subunits');
  if (tabSub) tabSub.classList.remove('active');
  const tabDist = document.getElementById('tab-btn-distribution');
  if (tabDist) tabDist.classList.remove('active');
  const tabIR = document.getElementById('tab-btn-inbound-returns');
  if (tabIR) tabIR.classList.remove('active');
  const tabOp = document.getElementById('tab-btn-operational');
  if (tabOp) tabOp.classList.remove('active');
  const tabLnd = document.getElementById('tab-btn-laundry-node');
  if (tabLnd) tabLnd.classList.remove('active');

  document.getElementById('explorer-stock-tab-content').style.display = 'none';
  document.getElementById('explorer-movement-tab-content').style.display = 'none';
  document.getElementById('explorer-subunits-tab-content').style.display = 'none';
  document.getElementById('explorer-distribution-tab-content').style.display = 'none';
  document.getElementById('explorer-transactions-tab-content').style.display = 'none';
  const contentIR = document.getElementById('explorer-inbound-returns-tab-content');
  if (contentIR) contentIR.style.display = 'none';
  const contentOp = document.getElementById('explorer-operational-tab-content');
  if (contentOp) contentOp.style.display = 'none';
  const contentLnd = document.getElementById('explorer-laundry-node-tab-content');
  if (contentLnd) contentLnd.style.display = 'none';

  if (tabName === 'stock') {
    document.getElementById('tab-btn-stock').classList.add('active');
    document.getElementById('explorer-stock-tab-content').style.display = 'block';
    renderExplorerItemsTable();
  } else if (tabName === 'movement') {
    document.getElementById('tab-btn-movement').classList.add('active');
    document.getElementById('explorer-movement-tab-content').style.display = 'block';
    renderMovementSummaryReport();
  } else if (tabName === 'subunits') {
    if (tabSub) tabSub.classList.add('active');
    document.getElementById('explorer-subunits-tab-content').style.display = 'block';
    renderParentStockDistribution();
  } else if (tabName === 'distribution') {
    if (tabDist) tabDist.classList.add('active');
    document.getElementById('explorer-distribution-tab-content').style.display = 'block';
    renderParentStockDistributionBreakdown();
  } else if (tabName === 'transactions') {
    document.getElementById('tab-btn-transactions').classList.add('active');
    document.getElementById('explorer-transactions-tab-content').style.display = 'block';
    if (selectedNodeId) renderNodeTransactions(selectedNodeId);
  } else if (tabName === 'inbound-returns') {
    if (tabIR) tabIR.classList.add('active');
    if (contentIR) contentIR.style.display = 'block';
    if (selectedNodeId) renderNodeInboundAndReturns(selectedNodeId);
  } else if (tabName === 'operational') {
    if (tabOp) tabOp.classList.add('active');
    if (contentOp) contentOp.style.display = 'block';
    renderOperationalTab();
  } else if (tabName === 'laundry-node') {
    if (tabLnd) tabLnd.classList.add('active');
    if (contentLnd) contentLnd.style.display = 'block';
    if (selectedNodeId) renderLaundryNodeTab(selectedNodeId);
  }
}

function updateAvailableStockDisplay() {
  const typeSel = document.getElementById('tf-wizard-type');
  const srcSel = document.getElementById('tf-wizard-source-node');
  const itemSel = document.getElementById('tf-wizard-item-select');
  const indicator = document.getElementById('tf-wizard-available-stock-indicator');
  const costIn = document.getElementById('tf-wizard-item-cost');

  if (!itemSel || !indicator || !typeSel || !srcSel) return;

  const type = typeSel.value;
  const srcVal = srcSel.value;
  const code = itemSel.value;

  if (!code || !srcVal) {
    indicator.style.display = 'none';
    indicator.innerText = '';
    return;
  }

  // Pre-fill cost input if matched item exists in source stock
  const matchedStock = wizardSourceWarehouseStock.find(i => i.itemCode === code);
  if (costIn && matchedStock && matchedStock.unitCost) {
    costIn.value = matchedStock.unitCost;
  }

  if (['op_allocate', 'op_consume', 'op_return', 'op_adjustment'].includes(type)) {
    const locSel = document.getElementById('tf-wizard-op-location');
    const locId = locSel ? locSel.value : null;

    if (!locId && type !== 'op_allocate') {
      indicator.style.display = 'none';
      return;
    }

    apiFetch(`/operational/nodes/${srcVal}/summary`).then(res => {
      if (res.success && res.data && res.data.items) {
        const itm = res.data.items.find(i => i.itemCode === code);
        if (itm) {
          if (type === 'op_allocate') {
            const avail = itm.availableToAllocate || 0;
            indicator.style.display = 'inline-block';
            indicator.innerHTML = `<i class="fa-solid fa-circle-info"></i> الرصيد المتاح للصرف: ${avail.toLocaleString()} ${itm.unitNameAr || ''}`;
          } else {
            const locItm = itm.locations.find(l => l.locationId === parseInt(locId));
            const bal = locItm ? locItm.balance : 0;
            indicator.style.display = 'inline-block';
            indicator.innerHTML = `<i class="fa-solid fa-circle-info"></i> رصيد المخزن التشغيلي: ${bal.toLocaleString()} ${itm.unitNameAr || ''}`;
          }
        } else {
          indicator.style.display = 'inline-block';
          indicator.innerHTML = `<i class="fa-solid fa-circle-info"></i> الرصيد المتاح: 0`;
        }
      }
    });
  } else {
    const availQty = matchedStock ? matchedStock.qtyOperational : 0;
    indicator.style.display = 'inline-block';
    indicator.innerHTML = '<i class="fa-solid fa-circle-info"></i> الرصيد المتوفر بالعهدة: ' + availQty.toLocaleString() + ' وحدة';
  }
}

function renderParentStockDistributionBreakdown() {
  const tbody = document.getElementById('parent-distribution-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!currentStockData || !currentStockData.distributions || currentStockData.distributions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد حركات أو توزيعات مسجلة للمستودعات التابعة.</td></tr>';
    return;
  }

  const typeTrans = { consumable: 'استهلاكي', returnable: 'مستعار', durable: 'أصل مستديم' };
  const typeBadges = { consumable: 'badge-type-consumption', returnable: 'badge-type-return', durable: 'badge-type-disposal' };

  const rows = [];
  currentStockData.distributions.forEach(d => {
    const typeBadge = '<span class="badge ' + (typeBadges[d.itemType] || 'badge-type-consumption') + '">' + (typeTrans[d.itemType] || 'استهلاكي') + '</span>';
    rows.push('<tr>' +
      '<td style="font-weight:700;"><i class="fa-solid fa-warehouse" style="color:var(--primary); margin-left:8px;"></i>' + d.nodeNameAr + '</td>' +
      '<td>' + d.itemCode + '</td>' +
      '<td><strong>' + d.itemNameAr + '</strong></td>' +
      '<td>' + typeBadge + '</td>' +
      '<td>' + d.qtyReceived.toLocaleString() + ' ' + d.unitNameAr + '</td>' +
      '<td style="color:var(--primary); font-weight:700;">' + d.qtyConsumed.toLocaleString() + ' ' + d.unitNameAr + '</td>' +
      '<td style="color:var(--danger); font-weight:700;">' + d.qtyDamaged.toLocaleString() + ' ' + d.unitNameAr + '</td>' +
      '<td style="color:var(--success); font-weight:800;">' + d.qtyOperational.toLocaleString() + ' ' + d.unitNameAr + '</td>' +
      '</tr>');
  });
  tbody.innerHTML = rows.join('');
}

window.quickInitiateReturn = (itemCode, maxQty, cost) => {
  // 1. Switch to transfers view
  switchView('transfers');
  // 2. Open new transfer form
  showNewTransferForm();

  // 3. Set transaction type to 'return'
  const typeSel = document.getElementById('tf-wizard-type');
  if (typeSel) {
    typeSel.value = 'return';
    typeSel.dispatchEvent(new Event('change'));
  }

  // 4. Set source warehouse to the selected node
  const srcSel = document.getElementById('tf-wizard-source-node');
  if (srcSel) {
    srcSel.value = selectedNodeId;
    srcSel.dispatchEvent(new Event('change'));
  }

  // 5. Select the item in the select dropdown
  setTimeout(() => {
    const itemSel = document.getElementById('tf-wizard-item-select');
    if (itemSel) {
      itemSel.value = itemCode;
      itemSel.dispatchEvent(new Event('change'));
    }

    // 6. Set quantity and cost fields
    const qtyIn = document.getElementById('tf-wizard-item-qty');
    if (qtyIn) qtyIn.value = maxQty;

    const costIn = document.getElementById('tf-wizard-item-cost');
    if (costIn) costIn.value = cost;

    notify('تم تجهيز طلب الإرجاع تلقائياً للصنف المختار. اضغط على زر الإضافة (+) لإكمال الحركة.', 'info');
  }, 500);
};

async function renderNodeInboundAndReturns(nodeId) {
  const returnsBody = document.getElementById('node-returns-body');
  const inboundBody = document.getElementById('node-inbound-history-body');

  if (returnsBody) {
    returnsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...</td></tr>';
  }
  if (inboundBody) {
    inboundBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:15px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل التوريدات...</td></tr>';
  }

  const fromDateEl = document.getElementById('ir-from-date');
  const toDateEl = document.getElementById('ir-to-date');
  const fromDateVal = fromDateEl ? fromDateEl.value : '';
  const toDateVal = toDateEl ? toDateEl.value : '';

  // 1. Populate Returnable Items in Hand from currentStockData.items
  if (returnsBody) {
    let returnables = (currentStockData && currentStockData.items)
      ? currentStockData.items.filter(item => (item.itemType === 'returnable' || item.itemType === 'durable') && item.qtyOperational > 0)
      : [];

    // Apply date range filter if any
    returnables = returnables.filter(item => {
      if (item.lastUpdated) {
        const itemDateStr = new Date(item.lastUpdated).toISOString().split('T')[0];
        if (fromDateVal && itemDateStr < fromDateVal) return false;
        if (toDateVal && itemDateStr > toDateVal) return false;
      }
      return true;
    });

    if (returnables.length === 0) {
      returnsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted);"><i class="fa-solid fa-circle-check" style="color:var(--success); margin-left:5px;"></i> لا توجد عهد مستعارة أو أصول معلقة تتطلب الإرجاع حالياً تطابق التصفية.</td></tr>';
    } else {
      const typeTrans = { consumable: 'استهلاكي', returnable: 'مستعار/مرتجع', durable: 'أصل مستديم' };
      const rows = [];
      returnables.forEach(item => {
        rows.push('<tr>' +
          '<td>' + item.itemCode + '</td>' +
          '<td style="font-weight:700;">' + item.itemNameAr + '</td>' +
          '<td><span class="badge badge-type-return">' + typeTrans[item.itemType] + '</span></td>' +
          '<td style="color:#b91c1c; font-weight:800;">' + item.qtyOperational.toLocaleString() + ' ' + (item.unitNameAr || 'حبة') + '</td>' +
          '<td><button type="button" class="btn" style="padding:4px 8px; font-size:11px; background:#b91c1c; color:#fff;" onclick="quickInitiateReturn(\'' + item.itemCode + '\', ' + item.qtyOperational + ', ' + (item.unitCost || 150) + ')"><i class="fa-solid fa-arrow-right-from-bracket"></i> إرجاع للمخزن الرئيسي</button></td>' +
          '</tr>');
      });
      returnsBody.innerHTML = rows.join('');
    }
  }

  // 2. Fetch all inbound items (filterDate=all) and filter for selected nodeId
  try {
    const res = await apiFetch('/sync/comsys-inbound?filterDate=all');
    if (res.success && inboundBody) {
      let nodeInbound = res.data.filter(item => String(item.toNodeId) === String(nodeId));

      // Apply date range filter
      nodeInbound = nodeInbound.filter(item => {
        if (item.moveDate) {
          const moveDateStr = new Date(item.moveDate).toISOString().split('T')[0];
          if (fromDateVal && moveDateStr < fromDateVal) return false;
          if (toDateVal && moveDateStr > toDateVal) return false;
        }
        return true;
      });

      if (nodeInbound.length === 0) {
        inboundBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">لم يتم استلام أي شحنات تطابق تصفية التاريخ المحددة لهذا المستودع.</td></tr>';
      } else {
        const typeTrans = { consumable: 'استهلاكي', returnable: 'مستعار', durable: 'أصل مستديم' };
        const typeBadges = { consumable: 'badge-type-consumption', returnable: 'badge-type-return', durable: 'badge-type-disposal' };
        const rows = [];
        nodeInbound.forEach(item => {
          const typeBadge = '<span class="badge ' + (typeBadges[item.itemType] || 'badge-type-consumption') + '">' + (typeTrans[item.itemType] || 'استهلاكي') + '</span>';
          const dateStr = new Date(item.moveDate).toLocaleDateString('ar-EG') + ' ' +
            new Date(item.moveDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          rows.push('<tr>' +
            '<td><strong>' + item.txnId + '</strong></td>' +
            '<td>' + item.itemCode + '</td>' +
            '<td style="font-weight:700;">' + item.itemNameAr + '</td>' +
            '<td style="color:var(--primary); font-weight:800;">' + item.quantity.toLocaleString() + ' ' + (item.unitNameAr || 'حبة') + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '<td>' + item.fromWarehouseNameAr + '</td>' +
            '<td style="font-size:11px;">' + dateStr + '</td>' +
            '</tr>');
        });
        inboundBody.innerHTML = rows.join('');
      }
    }
  } catch (err) {
    console.error(err);
    if (inboundBody) {
      inboundBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">فشل تحميل سجل الوارد من الخادم.</td></tr>';
    }
  }
}

async function loadInboundTransactions() {
  const tbody = document.getElementById('inbound-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب الوارد اليومي من المخزن الرئيسي...</td></tr>';

  try {
    const res = await apiFetch('/sync/comsys-inbound?filterDate=all');
    if (res.success) {
      cachedInboundItems = res.data;

      const destFilter = document.getElementById('inbound-dest-filter');
      if (destFilter && destFilter.options.length <= 1) {
        const treeRes = await apiFetch('/hierarchy/tree');
        if (treeRes.success) {
          const rootNodes = treeRes.data.nodes || (Array.isArray(treeRes.data) ? treeRes.data.flatMap(g => g.nodes) : []);
          const children = [];
          getChildNodesList(rootNodes, children);
          children.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = c.nodeNameAr;
            destFilter.appendChild(opt);
          });
        }
      }

      renderInboundTransactions();
    } else {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--danger);">فشل جلب الحركات من الخادم.</td></tr>';
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--danger);">حدث خطأ في الاتصال بالخادم.</td></tr>';
  }
}

function renderInboundTransactions() {
  const tbody = document.getElementById('inbound-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = document.getElementById('inbound-search-input').value.toLowerCase().trim();
  const typeVal = document.getElementById('inbound-type-filter').value;
  const destVal = document.getElementById('inbound-dest-filter').value;

  const fromDateEl = document.getElementById('inbound-from-date');
  const toDateEl = document.getElementById('inbound-to-date');
  const fromDateVal = fromDateEl ? fromDateEl.value : '';
  const toDateVal = toDateEl ? toDateEl.value : '';

  const filtered = cachedInboundItems.filter(item => {
    if (searchVal) {
      const matchCode = item.itemCode && item.itemCode.toLowerCase().includes(searchVal);
      const matchName = item.itemNameAr && item.itemNameAr.toLowerCase().includes(searchVal);
      const matchTxn = item.txnId && item.txnId.toLowerCase().includes(searchVal);
      if (!matchCode && !matchName && !matchTxn) return false;
    }
    if (typeVal !== 'all' && item.itemType !== typeVal) return false;
    if (destVal !== 'all' && String(item.toNodeId) !== destVal) return false;

    if (item.moveDate) {
      const moveDateStr = new Date(item.moveDate).toISOString().split('T')[0];
      if (fromDateVal && moveDateStr < fromDateVal) return false;
      if (toDateVal && moveDateStr > toDateVal) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">' +
      '<div class="empty-state"><i class="fa-solid fa-boxes-stacked" style="font-size:48px;"></i>' +
      '<p style="margin-top:10px;">لا يوجد وارد مطابق لعوامل التصفية المحددة.</p></div></td></tr>';
    return;
  }

  const typeTrans = { consumable: 'استهلاكي', returnable: 'مستعار', durable: 'أصل مستديم' };
  const typeBadges = { consumable: 'badge-type-consumption', returnable: 'badge-type-return', durable: 'badge-type-disposal' };

  const rows = [];
  filtered.forEach(item => {
    const typeBadge = '<span class="badge ' + (typeBadges[item.itemType] || 'badge-type-consumption') + '">' + (typeTrans[item.itemType] || 'استهلاكي') + '</span>';
    const dateStr = new Date(item.moveDate).toLocaleDateString('ar-EG') + ' ' +
      new Date(item.moveDate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    rows.push('<tr>' +
      '<td><strong>' + item.txnId + '</strong></td>' +
      '<td><span class="badge badge-secondary" style="background:#e2e8f0; color:#475569;">' + item.docType + '</span></td>' +
      '<td>' + item.itemCode + '</td>' +
      '<td style="font-weight:700;">' + item.itemNameAr + '</td>' +
      '<td style="color:var(--primary); font-weight:800;">' + item.quantity.toLocaleString() + ' ' + (item.unitNameAr || 'حبة') + '</td>' +
      '<td>' + typeBadge + '</td>' +
      '<td>' + item.fromWarehouseNameAr + '</td>' +
      '<td style="font-weight:700;"><i class="fa-solid fa-warehouse" style="color:var(--primary); margin-left:5px;"></i>' + item.toNodeNameAr + '</td>' +
      '<td style="font-size:11px; font-weight:700;">' + dateStr + '</td>' +
      '</tr>');
  });
  tbody.innerHTML = rows.join('');
}

// ================================================================
// ⚡ FEATURE 1: QUICK CONSUME — Fast consumption without wizard
// ================================================================

function openQuickConsumeModal() {
  if (!selectedNodeId || !currentStockData) {
    notify('يرجى اختيار مستودع فعال أولاً', 'error');
    return;
  }

  const modal = document.getElementById('quick-consume-modal');
  const whName = document.getElementById('qc-warehouse-name');
  const itemSel = document.getElementById('qc-item-select');
  const qtyIn = document.getElementById('qc-qty');
  const notesIn = document.getElementById('qc-notes');
  const stockInd = document.getElementById('qc-stock-indicator');

  if (whName) whName.innerText = 'مستودع: ' + (currentStockData.nodeNameAr || document.getElementById('selected-node-title').innerText);
  if (qtyIn) qtyIn.value = '';
  if (notesIn) notesIn.value = '';
  if (stockInd) stockInd.style.display = 'none';

  // Populate items from currentStockData (consumable only for quick consume)
  if (itemSel && currentStockData.items) {
    const consumableItems = currentStockData.items.filter(i => i.qtyOperational > 0);
    const opts = ['<option value="">اختر صنف من عهدة المستودع...</option>'];
    consumableItems.forEach(i => {
      opts.push('<option value="' + i.itemCode + '" data-qty="' + i.qtyOperational + '" data-cost="' + (i.unitCost || 0) + '">' +
        i.itemCode + ' — ' + (i.itemNameAr || 'صنف') + ' | الرصيد: ' + i.qtyOperational.toLocaleString() + ' ' + (i.unitNameAr || 'حبة') +
        '</option>');
    });
    itemSel.innerHTML = opts.join('');
  }

  if (modal) modal.style.display = 'flex';
}

function closeQuickConsumeModal() {
  const modal = document.getElementById('quick-consume-modal');
  if (modal) modal.style.display = 'none';
}

function updateQuickConsumeStock() {
  const itemSel = document.getElementById('qc-item-select');
  const stockInd = document.getElementById('qc-stock-indicator');
  const stockText = document.getElementById('qc-stock-text');
  if (!itemSel || !stockInd) return;

  const selected = itemSel.options[itemSel.selectedIndex];
  if (!selected || !selected.value) {
    stockInd.style.display = 'none';
    return;
  }

  const qty = parseFloat(selected.getAttribute('data-qty') || 0);
  stockInd.style.display = 'flex';
  if (qty === 0) {
    stockInd.style.background = '#fef2f2';
    stockInd.style.borderColor = '#fecaca';
    stockInd.style.color = '#b91c1c';
    if (stockText) stockText.innerText = '⚠️ الرصيد صفر — لا يمكن الصرف';
  } else {
    stockInd.style.background = '#f0fdf4';
    stockInd.style.borderColor = '#86efac';
    stockInd.style.color = '#166534';
    if (stockText) stockText.innerText = 'الرصيد المتوفر: ' + qty.toLocaleString() + ' وحدة';
  }
}

async function confirmQuickConsume() {
  const itemSel = document.getElementById('qc-item-select');
  const qtyIn = document.getElementById('qc-qty');
  const notesIn = document.getElementById('qc-notes');
  const confirmBtn = document.getElementById('qc-confirm-btn');

  if (!itemSel || !qtyIn) return;

  const itemCode = itemSel.value;
  const qty = parseFloat(qtyIn.value);
  const notes = notesIn ? notesIn.value : '';

  if (!itemCode) { notify('يرجى اختيار الصنف أولاً', 'error'); return; }
  if (isNaN(qty) || qty <= 0) { notify('يرجى إدخال كمية صحيحة أكبر من صفر', 'error'); return; }

  // Check stock availability
  const selected = itemSel.options[itemSel.selectedIndex];
  const availQty = parseFloat(selected ? selected.getAttribute('data-qty') || 0 : 0);
  if (qty > availQty) {
    notify('الكمية (' + qty + ') تتجاوز الرصيد المتوفر (' + availQty + ')!', 'error');
    return;
  }

  const item = currentStockData.items ? currentStockData.items.find(i => i.itemCode === itemCode) : null;
  const unitCost = item ? (item.unitCost || 0) : 0;

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
  }

  try {
    // Step 1: Create draft
    const draftRes = await apiFetch('/transactions/transfers', 'POST', {
      txnType: 'consumption',
      fromNodeId: selectedNodeId,
      toNodeId: null,
      notes: notes || 'استهلاك سريع',
      lines: [{ itemCode, quantity: qty, unitCode: null, unitCost }]
    });

    if (!draftRes.success) {
      notify('فشل إنشاء الحركة: ' + (draftRes.message || 'خطأ غير معروف'), 'error');
      return;
    }

    const txnId = draftRes.data.txnId;

    // Step 2: Immediately confirm (post تلقائي)
    const confirmRes = await apiFetch('/transactions/transfers/' + txnId + '/confirm', 'POST');

    if (confirmRes.success) {
      notify('✅ تم صرف ' + qty.toLocaleString() + ' وحدة من ' + (item ? item.itemNameAr : itemCode) + ' وتحديث الرصيد فوراً!', 'success');
      closeQuickConsumeModal();

      // Refresh data
      const nodeData = { id: selectedNodeId, nodeNameAr: document.getElementById('selected-node-title').innerText, nodeType: 'child' };
      await loadNodeStock(nodeData);
      await loadTree();
    } else {
      notify('فشل ترحيل الحركة: ' + (confirmRes.message || 'خطأ'), 'error');
    }
  } catch (err) {
    console.error(err);
    notify('حدث خطأ في الاتصال بالخادم', 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> تأكيد الاستهلاك الفوري';
    }
  }
}

// ================================================================
// ⚠️ FEATURE 2: PENDING DRAFTS — Check & confirm all at once
// ================================================================

let pendingDraftsForNode = [];

async function checkPendingDraftsForNode(nodeId) {
  const banner = document.getElementById('pending-drafts-banner');
  const countText = document.getElementById('pending-drafts-count-text');
  if (!banner) return;

  try {
    const res = await apiFetch('/transactions/transfers?nodeId=' + nodeId);
    if (res.success) {
      // Filter only draft transactions from this node as source (outgoing)
      const drafts = res.data.filter(t => t.status === 'draft' && t.fromNodeId === nodeId);
      pendingDraftsForNode = drafts;

      if (drafts.length > 0) {
        banner.style.display = 'block';
        const trans = { consumption: 'استهلاك', internal_transfer: 'تحويل داخلي', waste: 'هدر', damage: 'تلف', return: 'مرتجع', disposal: 'تكهين' };
        const typeNames = [...new Set(drafts.map(d => trans[d.txnType] || d.txnType))].join('، ');
        if (countText) countText.innerText = 'يوجد ' + drafts.length + ' مستند معلق (' + typeNames + ') — الأرقام في الرصيد غير محدثة';
      } else {
        banner.style.display = 'none';
        pendingDraftsForNode = [];
      }
    }
  } catch (err) {
    console.error('Error checking pending drafts', err);
    banner.style.display = 'none';
  }
}

function openConfirmAllDraftsModal() {
  const modal = document.getElementById('confirm-all-drafts-modal');
  const listEl = document.getElementById('pending-drafts-list');
  if (!modal || !listEl) return;

  if (pendingDraftsForNode.length === 0) {
    notify('لا توجد مسودات معلقة لهذا المستودع', 'info');
    return;
  }

  const trans = { consumption: 'استهلاك تشغيلي', internal_transfer: 'تحويل داخلي', waste: 'هدر مواد', damage: 'تلف سلع', return: 'مرتجع للمخزن', disposal: 'تكهين' };
  const items = pendingDraftsForNode.map(d => {
    const dateStr = new Date(d.createdAt || d.txnDate).toLocaleDateString('ar-EG');
    return '<div class="pending-draft-item">' +
      '<div>' +
      '<div class="draft-ref">OP-2026-' + String(d.txnId).padStart(3, '0') + '</div>' +
      '<div class="draft-info">' + (trans[d.txnType] || d.txnType) + ' — ' + dateStr + '</div>' +
      '</div>' +
      '<span class="badge badge-warning"><i class="fa-solid fa-hourglass-half"></i> مسودة</span>' +
      '</div>';
  });

  listEl.innerHTML = items.join('');
  modal.style.display = 'flex';
}

function closeConfirmAllDraftsModal() {
  const modal = document.getElementById('confirm-all-drafts-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmAllPendingDrafts() {
  const btn = document.getElementById('btn-confirm-all-drafts');
  if (!btn) return;

  if (pendingDraftsForNode.length === 0) {
    notify('لا توجد مسودات للترحيل', 'info');
    closeConfirmAllDraftsModal();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الترحيل...';

  let successCount = 0, failCount = 0;

  for (const draft of pendingDraftsForNode) {
    try {
      const res = await apiFetch('/transactions/transfers/' + draft.txnId + '/confirm', 'POST');
      if (res.success) successCount++;
      else failCount++;
    } catch (e) {
      failCount++;
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> ترحيل وتأكيد الكل الآن';

  closeConfirmAllDraftsModal();

  if (successCount > 0) {
    notify('✅ تم ترحيل ' + successCount + ' مستند بنجاح! الأرصدة محدثة.', 'success');
    // Refresh
    const nodeData = { id: selectedNodeId, nodeNameAr: document.getElementById('selected-node-title').innerText, nodeType: 'child' };
    await loadNodeStock(nodeData);
    await loadTree();

    // Also reload transfers list if on that view
    const trRes = await apiFetch('/transactions/transfers');
    if (trRes.success) filteredTransfersList = trRes.data;
  }
  if (failCount > 0) {
    notify('فشل ترحيل ' + failCount + ' مستند — راجع السجلات', 'error');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  // Prompt for real credentials initially
  document.getElementById('login-overlay').style.display = 'flex';

  // Bind Transaction filters
  const txFromDate = document.getElementById('tx-from-date');
  const txToDate = document.getElementById('tx-to-date');
  if (txFromDate) txFromDate.addEventListener('input', applyNodeTransactionsFilter);
  if (txToDate) txToDate.addEventListener('input', applyNodeTransactionsFilter);

  const txTypeFilter = document.getElementById('tx-type-filter');
  if (txTypeFilter) txTypeFilter.addEventListener('change', applyNodeTransactionsFilter);

  const btnClearTxFilters = document.getElementById('btn-clear-tx-filters');
  if (btnClearTxFilters) {
    btnClearTxFilters.addEventListener('click', () => {
      if (txFromDate) txFromDate.value = '';
      if (txToDate) txToDate.value = '';
      if (txTypeFilter) txTypeFilter.value = 'all';
      applyNodeTransactionsFilter();
    });
  }

  // Bind Operations Center sidebar list filters
  const tfStatusFilter = document.getElementById('tf-status-filter');
  const tfTypeFilter = document.getElementById('tf-type-filter');
  const tfFromDate = document.getElementById('tf-from-date');
  const tfToDate = document.getElementById('tf-to-date');
  const tfSearch = document.getElementById('tf-search');

  if (tfStatusFilter) tfStatusFilter.addEventListener('change', () => { tfCurrentPage = 1; renderTransfersList(); });
  if (tfTypeFilter) tfTypeFilter.addEventListener('change', () => { tfCurrentPage = 1; renderTransfersList(); });
  if (tfFromDate) tfFromDate.addEventListener('input', () => { tfCurrentPage = 1; renderTransfersList(); });
  if (tfToDate) tfToDate.addEventListener('input', () => { tfCurrentPage = 1; renderTransfersList(); });
  if (tfSearch) tfSearch.addEventListener('input', () => { tfCurrentPage = 1; renderTransfersList(); });

  // Bind Movement Summary filters
  const movFromDate = document.getElementById('mov-from-date');
  const movToDate = document.getElementById('mov-to-date');
  if (movFromDate) movFromDate.addEventListener('input', renderMovementSummaryReport);
  if (movToDate) movToDate.addEventListener('input', renderMovementSummaryReport);

  const btnClearMovFilters = document.getElementById('btn-clear-mov-filters');
  if (btnClearMovFilters) {
    btnClearMovFilters.addEventListener('click', () => {
      if (movFromDate) movFromDate.value = '';
      if (movToDate) movToDate.value = '';
      renderMovementSummaryReport();
    });
  }

  // Bind Explorer Inbound & Returns filters
  const irFromDate = document.getElementById('ir-from-date');
  const irToDate = document.getElementById('ir-to-date');
  if (irFromDate) irFromDate.addEventListener('input', () => { if (selectedNodeId) renderNodeInboundAndReturns(selectedNodeId); });
  if (irToDate) irToDate.addEventListener('input', () => { if (selectedNodeId) renderNodeInboundAndReturns(selectedNodeId); });

  const btnClearIrFilters = document.getElementById('btn-clear-ir-filters');
  if (btnClearIrFilters) {
    btnClearIrFilters.addEventListener('click', () => {
      if (irFromDate) irFromDate.value = '';
      if (irToDate) irToDate.value = '';
      if (selectedNodeId) renderNodeInboundAndReturns(selectedNodeId);
    });
  }

  // Bind Inbound filters
  const inboundSearch = document.getElementById('inbound-search-input');
  if (inboundSearch) inboundSearch.addEventListener('input', renderInboundTransactions);

  const inboundType = document.getElementById('inbound-type-filter');
  if (inboundType) inboundType.addEventListener('change', renderInboundTransactions);

  const inboundDest = document.getElementById('inbound-dest-filter');
  if (inboundDest) inboundDest.addEventListener('change', renderInboundTransactions);

  const inboundFromDate = document.getElementById('inbound-from-date');
  const inboundToDate = document.getElementById('inbound-to-date');
  if (inboundFromDate) inboundFromDate.addEventListener('input', renderInboundTransactions);
  if (inboundToDate) inboundToDate.addEventListener('input', renderInboundTransactions);

  // Bind User Management forms
  const createUserForm = document.getElementById('create-user-form');
  if (createUserForm) createUserForm.addEventListener('submit', submitCreateUser);

  const editUserForm = document.getElementById('edit-user-form');
  if (editUserForm) editUserForm.addEventListener('submit', submitEditUser);

  const resetPwForm = document.getElementById('reset-pw-form');
  if (resetPwForm) resetPwForm.addEventListener('submit', submitResetPassword);
});

// ════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT MODULE
// ════════════════════════════════════════════════════════════════════════════

const ROLE_META = {
  admin: { label: 'مدير النظام', color: '#6366f1', bg: '#eef2ff', icon: '👑' },
  manager: { label: 'مدير عام', color: '#0ea5e9', bg: '#f0f9ff', icon: '🏢' },
  warehouse_manager: { label: 'مدير مستودع', color: '#8b5cf6', bg: '#f5f3ff', icon: '🏬' },
  warehouse_head: { label: 'رئيس عهدة', color: '#10b981', bg: '#f0fdf4', icon: '📦' },
  accountant: { label: 'محاسب', color: '#f59e0b', bg: '#fffbeb', icon: '💼' },
  staff: { label: 'موظف مستودع', color: '#64748b', bg: '#f8fafc', icon: '👷' },
};

async function loadUsersView() {
  try {
    const [usersRes, nodesRes] = await Promise.all([
      apiFetch('/users'),
      apiFetch('/hierarchy/tree?ignoreScope=true'),
    ]);

    if (usersRes.success) {
      cachedUsersList = usersRes.data;
    }

    // Flatten all nodes from all groups
    cachedNodesList = [];
    if (nodesRes.success && nodesRes.data) {
      function flattenNodes(list) {
        list.forEach(n => {
          cachedNodesList.push({ id: n.id, nameAr: n.nodeNameAr, type: n.nodeType });
          if (n.children && n.children.length > 0) flattenNodes(n.children);
        });
      }

      if (Array.isArray(nodesRes.data)) {
        nodesRes.data.forEach(group => {
          if (group.nodes) flattenNodes(group.nodes);
        });
      } else if (nodesRes.data.nodes) {
        flattenNodes(nodesRes.data.nodes);
      }
    }

    renderUsersTable();
    populateNodeDropdowns();
  } catch (err) {
    console.error('loadUsersView error', err);
    notify('فشل تحميل بيانات المستخدمين', 'error');
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody || !cachedUsersList.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">لا يوجد مستخدمون مسجلون في النظام بعد.</td></tr>';
    return;
  }

  const searchQ = (document.getElementById('users-search')?.value || '').toLowerCase().trim();
  const roleF = document.getElementById('users-role-filter')?.value || 'all';
  const statusF = document.getElementById('users-status-filter')?.value || 'all';

  const filtered = cachedUsersList.filter(u => {
    if (roleF !== 'all' && u.role !== roleF) return false;
    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
    if (statusF === 'active' && (!u.isActive || isLocked)) return false;
    if (statusF === 'inactive' && u.isActive) return false;
    if (statusF === 'locked' && !isLocked) return false;
    if (searchQ) {
      const combined = (u.fullNameAr + u.username + u.nodeNameAr).toLowerCase();
      if (!combined.includes(searchQ)) return false;
    }
    return true;
  });

  // Update stats
  const total = cachedUsersList.length;
  const active = cachedUsersList.filter(u => u.isActive && !(u.lockedUntil && new Date(u.lockedUntil) > new Date())).length;
  const inactive = cachedUsersList.filter(u => !u.isActive).length;
  const locked = cachedUsersList.filter(u => u.lockedUntil && new Date(u.lockedUntil) > new Date()).length;
  document.getElementById('stat-total-users').innerText = total;
  document.getElementById('stat-active-users').innerText = active;
  document.getElementById('stat-inactive-users').innerText = inactive;
  document.getElementById('stat-locked-users').innerText = locked;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-magnifying-glass"></i> لا يوجد مستخدمون يطابقون التصفية المحددة.</td></tr>';
    return;
  }

  const rows = filtered.map(u => {
    const meta = ROLE_META[u.role] || ROLE_META.staff;
    const initials = u.fullNameAr ? u.fullNameAr.slice(0, 2) : u.username.slice(0, 2).toUpperCase();
    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();

    let statusBadge;
    if (isLocked) {
      statusBadge = '<span style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700;"><i class="fa-solid fa-lock" style="font-size:9px;"></i> مقفول</span>';
    } else if (u.isActive) {
      statusBadge = '<span style="background:#f0fdf4; color:#15803d; border:1px solid #86efac; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-check" style="font-size:9px;"></i> نشط</span>';
    } else {
      statusBadge = '<span style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:700;"><i class="fa-solid fa-circle-pause" style="font-size:9px;"></i> معطل</span>';
    }

    const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '<span style="color:var(--text-muted);">لم يسجل دخول بعد</span>';

    const canDelete = u.username !== 'admin';
    const deleteBtn = canDelete
      ? `<button class="btn btn-secondary" style="padding:5px 8px; color:var(--danger); border-color:var(--danger);" onclick="confirmDeleteUser(${u.id}, '${u.username}')" title="حذف الحساب"><i class="fa-solid fa-trash-can"></i></button>`
      : '<button class="btn btn-secondary" style="padding:5px 8px; opacity:0.3;" disabled title="لا يمكن حذف المدير الأساسي"><i class="fa-solid fa-trash-can"></i></button>';

    return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,${meta.color}22,${meta.color}44); border:2px solid ${meta.color}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:${meta.color}; flex-shrink:0;">${initials}</div>
                <div>
                  <div style="font-weight:700; font-size:13px;">${u.fullNameAr}</div>
                  <div style="font-size:11px; color:var(--text-muted);">ID: ${u.id}</div>
                </div>
              </div>
            </td>
            <td><span style="font-family:monospace; font-size:12px; background:#f1f5f9; border-radius:6px; padding:3px 8px; font-weight:700;">@${u.username}</span></td>
            <td>
              <span style="background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.color}44; border-radius:20px; padding:4px 12px; font-size:11px; font-weight:800; white-space:nowrap;">
                ${meta.icon} ${meta.label}
              </span>
            </td>
            <td style="font-size:12px;">
              ${u.nodeNameAr ? `<span style="display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-warehouse" style="color:var(--primary); font-size:10px;"></i> ${u.nodeNameAr}</span>` : '<span style="color:var(--text-muted);">—</span>'}
            </td>
            <td>${statusBadge}</td>
            <td style="font-size:12px; color:var(--text-muted);">${lastLogin}</td>
            <td>
              <div style="display:flex; gap:5px; flex-wrap:nowrap;">
                <button class="btn btn-secondary" style="padding:5px 8px;" onclick="openEditUserModal(${u.id})" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-secondary" style="padding:5px 8px; color:#ef4444; border-color:#ef4444;" onclick="openResetPwModal(${u.id}, '${u.username}')" title="إعادة تعيين كلمة المرور"><i class="fa-solid fa-key"></i></button>
                ${deleteBtn}
              </div>
            </td>
          </tr>`;
  });

  tbody.innerHTML = rows.join('');
}

function populateNodeDropdowns() {
  const opts = ['<option value="">بدون مستودع محدد</option>'];
  cachedNodesList.forEach(n => {
    const icon = n.type === 'parent' ? '📁' : '🏪';
    opts.push(`<option value="${n.id}">${icon} ${n.nameAr}</option>`);
  });
  const html = opts.join('');
  const cuNode = document.getElementById('cu-node');
  const euNode = document.getElementById('eu-node');
  if (cuNode) cuNode.innerHTML = html;
  if (euNode) euNode.innerHTML = html;

  // Populate checklist containers for other allowed warehouses
  const renderChecklist = (containerId, prefix) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    let chkHtml = '';
    cachedNodesList.forEach(n => {
      const icon = n.type === 'parent' ? '📁' : '🏪';
      chkHtml += `
            <div style="display:flex; align-items:center; gap:8px; user-select:none;">
              <input type="checkbox" id="${prefix}-chk-${n.id}" class="${prefix}-other-node-chk" value="${n.id}" style="width:15px; height:15px; cursor:pointer;">
              <label for="${prefix}-chk-${n.id}" style="font-size:12px; cursor:pointer; font-weight:normal; margin:0;">${icon} ${n.nameAr}</label>
            </div>
          `;
    });
    container.innerHTML = chkHtml || '<div style="color:var(--text-muted); font-size:12px;">لا يوجد مستودعات متاحة</div>';
  };
  renderChecklist('cu-other-nodes-container', 'cu');
  renderChecklist('eu-other-nodes-container', 'eu');
}

// ── CREATE USER ──────────────────────────────────────────────────────────

function openCreateUserModal() {
  document.getElementById('cu-username').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-fullname').value = '';
  document.getElementById('cu-role').value = '';
  document.getElementById('cu-active').checked = true;
  populateNodeDropdowns(); // always refresh before opening
  const cuNode = document.getElementById('cu-node');
  if (cuNode) cuNode.value = '';

  // Uncheck all custom nodes
  const chks = document.querySelectorAll('.cu-other-node-chk');
  chks.forEach(c => c.checked = false);

  document.getElementById('create-user-modal').style.display = 'flex';
}

function closeCreateUserModal() {
  document.getElementById('create-user-modal').style.display = 'none';
}

function onRoleChangeCreate() {
  // No extra UI changes needed — node is always visible
}

async function submitCreateUser(e) {
  e.preventDefault();
  const username = document.getElementById('cu-username').value.trim();
  const password = document.getElementById('cu-password').value;
  const fullNameAr = document.getElementById('cu-fullname').value.trim();
  const role = document.getElementById('cu-role').value;
  const nodeIdRaw = document.getElementById('cu-node').value;
  const nodeId = nodeIdRaw ? parseInt(nodeIdRaw) : null;

  // Collect all checked checkbox values
  const nodeIds = Array.from(document.querySelectorAll('.cu-other-node-chk:checked')).map(c => parseInt(c.value));

  const isActive = document.getElementById('cu-active').checked;

  if (!username || !password || !fullNameAr || !role) {
    notify('يرجى تعبئة جميع الحقول المطلوبة', 'error');
    return;
  }

  try {
    const res = await apiFetch('/users', 'POST', { username, password, fullNameAr, role, nodeId, nodeIds, isActive });
    if (res.success) {
      notify('تم إنشاء حساب المستخدم بنجاح!', 'success');
      closeCreateUserModal();
      loadUsersView();
    } else {
      notify(res.message || 'فشل إنشاء الحساب', 'error');
    }
  } catch (err) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}

// ── EDIT USER ─────────────────────────────────────────────────────────────

function openEditUserModal(userId) {
  const user = cachedUsersList.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('eu-user-id').value = user.id;
  document.getElementById('eu-username-label').innerText = '@' + user.username;
  document.getElementById('eu-fullname').value = user.fullNameAr;
  document.getElementById('eu-role').value = user.role;
  document.getElementById('eu-active').checked = user.isActive;

  populateNodeDropdowns(); // always refresh before opening
  const euNode = document.getElementById('eu-node');
  if (euNode) euNode.value = user.nodeId || '';

  // Check current user node assignments
  const chks = document.querySelectorAll('.eu-other-node-chk');
  chks.forEach(c => {
    c.checked = user.nodeIds && user.nodeIds.includes(parseInt(c.value));
  });

  document.getElementById('edit-user-modal').style.display = 'flex';
}

function closeEditUserModal() {
  document.getElementById('edit-user-modal').style.display = 'none';
}

async function submitEditUser(e) {
  e.preventDefault();
  const userId = parseInt(document.getElementById('eu-user-id').value);
  const fullNameAr = document.getElementById('eu-fullname').value.trim();
  const role = document.getElementById('eu-role').value;
  const nodeIdRaw = document.getElementById('eu-node').value;
  const nodeId = nodeIdRaw ? parseInt(nodeIdRaw) : null;

  // Collect all checked checkbox values
  const nodeIds = Array.from(document.querySelectorAll('.eu-other-node-chk:checked')).map(c => parseInt(c.value));

  const isActive = document.getElementById('eu-active').checked;

  if (!fullNameAr || !role) {
    notify('يرجى تعبئة جميع الحقول المطلوبة', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/users/${userId}`, 'PUT', { fullNameAr, role, nodeId, nodeIds, isActive });
    if (res.success) {
      notify('تم تحديث بيانات المستخدم بنجاح!', 'success');
      closeEditUserModal();
      loadUsersView();
    } else {
      notify(res.message || 'فشل تحديث البيانات', 'error');
    }
  } catch (err) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}

// ── RESET PASSWORD ────────────────────────────────────────────────────────

function openResetPwModal(userId, username) {
  document.getElementById('rp-user-id').value = userId;
  document.getElementById('rp-username-label').innerText = '@' + username;
  document.getElementById('rp-new-password').value = '';
  document.getElementById('reset-pw-modal').style.display = 'flex';
}

function closeResetPwModal() {
  document.getElementById('reset-pw-modal').style.display = 'none';
}

async function submitResetPassword(e) {
  e.preventDefault();
  const userId = parseInt(document.getElementById('rp-user-id').value);
  const newPassword = document.getElementById('rp-new-password').value;

  if (!newPassword || newPassword.length < 6) {
    notify('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/users/${userId}/reset-password`, 'PATCH', { newPassword });
    if (res.success) {
      notify('تم إعادة تعيين كلمة المرور بنجاح!', 'success');
      closeResetPwModal();
    } else {
      notify(res.message || 'فشل إعادة تعيين كلمة المرور', 'error');
    }
  } catch (err) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}

// ── DELETE USER ───────────────────────────────────────────────────────────

async function confirmDeleteUser(userId, username) {
  if (!confirm(`هل أنت متأكد من حذف حساب "${username}" نهائياً من النظام؟`)) return;
  try {
    const res = await apiFetch(`/users/${userId}`, 'DELETE');
    if (res.success) {
      notify('تم حذف الحساب بنجاح', 'success');
      loadUsersView();
    } else {
      notify(res.message || 'فشل حذف الحساب', 'error');
    }
  } catch (err) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// PERMISSIONS MATRIX — Admin only
// ═══════════════════════════════════════════════════════════════════════════

const PERMISSION_LABELS = {
  create_draft: { ar: 'إنشاء مسودة حركة', icon: 'fa-file-circle-plus', color: '#6366f1' },
  submit_approval: { ar: 'إرسال للموافقة', icon: 'fa-paper-plane', color: '#8b5cf6' },
  approve_transfer: { ar: 'اعتماد وموافقة الطلب', icon: 'fa-thumbs-up', color: '#10b981' },
  dispatch_transfer: { ar: 'شحن وتسليم البضاعة', icon: 'fa-truck-fast', color: '#0ea5e9' },
  receive_transfer: { ar: 'استلام وتأكيد الوارد', icon: 'fa-box-open', color: '#06b6d4' },
  cancel_transfer: { ar: 'إلغاء مستند / حركة', icon: 'fa-ban', color: '#ef4444' },
  confirm_transfer: { ar: 'تأكيد وترحيل الأرصدة', icon: 'fa-circle-check', color: '#22c55e' },
  quick_consume: { ar: 'الصرف السريع (استهلاك)', icon: 'fa-bolt', color: '#f59e0b' },
  view_all_nodes: { ar: 'عرض كل المستودعات', icon: 'fa-sitemap', color: '#64748b' },
  manage_nodes: { ar: 'إدارة شجرة المستودعات', icon: 'fa-folder-tree', color: '#f97316' },
  manage_users: { ar: 'إدارة المستخدمين', icon: 'fa-users-gear', color: '#a855f7' },
  run_sync: { ar: 'تشغيل مزامنة كومسيس', icon: 'fa-rotate', color: '#3b82f6' },
  view_reports: { ar: 'عرض التقارير والتحليلات', icon: 'fa-chart-bar', color: '#0891b2' },
  manage_permissions: { ar: 'إدارة مصفوفة الصلاحيات', icon: 'fa-shield-halved', color: '#dc2626' },
};

const ROLE_LABELS_UI = {
  admin: { ar: 'مدير النظام', color: '#6366f1', bg: '#eef2ff', icon: '🛡️' },
  manager: { ar: 'مدير عام', color: '#0ea5e9', bg: '#e0f2fe', icon: '👤' },
  warehouse_manager: { ar: 'مدير مستودع', color: '#10b981', bg: '#d1fae5', icon: '🏪' },
  warehouse_head: { ar: 'رئيس عهدة', color: '#f59e0b', bg: '#fef3c7', icon: '📋' },
  accountant: { ar: 'محاسب', color: '#64748b', bg: '#f1f5f9', icon: '📈' },
  staff: { ar: 'موظف مستودع', color: '#94a3b8', bg: '#f8fafc', icon: '👷' },
};

let permissionsCurrentMatrix = {};   // loaded from API
let permissionsPendingChanges = {};  // role -> permKey -> bool (unsaved)

async function loadPermissionsMatrix() {
  const head = document.getElementById('permissions-matrix-head');
  const body = document.getElementById('permissions-matrix-body');
  head.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل مصفوفة الصلاحيات...</td></tr>';
  body.innerHTML = '';
  permissionsPendingChanges = {};
  updateChangeLog();

  try {
    const res = await apiFetch('/admin/permissions');
    if (!res.success) { notify('فشل تحميل الصلاحيات', 'error'); return; }
    permissionsCurrentMatrix = res.data;
    renderPermissionsMatrix();
  } catch (e) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}

function renderPermissionsMatrix() {
  const roles = Object.keys(ROLE_LABELS_UI);
  const permKeys = Object.keys(PERMISSION_LABELS);
  const head = document.getElementById('permissions-matrix-head');
  const body = document.getElementById('permissions-matrix-body');

  // ── Build header row ────────────────────────────────────────────────────
  let headHtml = '<tr>';
  headHtml += '<th style="background:#1e293b; color:#fff; padding:14px 18px; text-align:right; font-size:13px; border-radius:0; position:sticky; right:0; z-index:2; min-width:220px;">الصلاحية</th>';
  for (const role of roles) {
    const rl = ROLE_LABELS_UI[role];
    headHtml += `<th style="background:#1e293b; color:#fff; padding:12px 16px; text-align:center; font-size:12px; min-width:120px;">
          <div style="background:${rl.bg}; color:${rl.color}; border-radius:8px; padding:6px 10px; display:inline-block; font-weight:800; line-height:1.4;">
            ${rl.icon} ${rl.ar}
          </div>
        </th>`;
  }
  headHtml += '</tr>';
  head.innerHTML = headHtml;

  // ── Build body rows ─────────────────────────────────────────────────────
  let bodyHtml = '';
  permKeys.forEach((permKey, idx) => {
    const pl = PERMISSION_LABELS[permKey];
    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    bodyHtml += `<tr style="background:${rowBg}; transition:background 0.15s;" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background='${rowBg}'">`;

    // Row label
    bodyHtml += `<td style="padding:14px 18px; font-weight:700; font-size:13px; position:sticky; right:0; background:${rowBg}; z-index:1; border-right:3px solid ${pl.color}20;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:32px; height:32px; background:${pl.color}18; border-radius:8px; display:flex; align-items:center; justify-content:center; color:${pl.color}; font-size:13px; flex-shrink:0;">
              <i class="fa-solid ${pl.icon}"></i>
            </span>
            <span>${pl.ar}</span>
          </div>
        </td>`;

    // Cells per role
    for (const role of roles) {
      const isAdminProtected = role === 'admin' && permKey === 'manage_permissions';
      const currentVal = permissionsCurrentMatrix[role]?.[permKey] ?? false;
      const pendingVal = permissionsPendingChanges[role]?.[permKey];
      const effectiveVal = pendingVal !== undefined ? pendingVal : currentVal;
      const hasPending = pendingVal !== undefined && pendingVal !== currentVal;

      bodyHtml += `<td style="text-align:center; padding:10px;">`;
      if (isAdminProtected) {
        bodyHtml += `<span title="محمي دائماً" style="font-size:18px; color:#10b981;"><i class="fa-solid fa-lock"></i></span>`;
      } else {
        const cellColor = effectiveVal ? '#10b981' : '#e2e8f0';
        const cellBorder = effectiveVal ? '#059669' : '#cbd5e1';
        const pendingRing = hasPending ? 'outline:3px solid #f59e0b; outline-offset:2px;' : '';
        bodyHtml += `<button
              onclick="togglePermission('${role}','${permKey}', this)"
              data-role="${role}" data-perm="${permKey}" data-val="${effectiveVal}"
              style="width:36px; height:36px; border-radius:9px; border:2px solid ${cellBorder}; background:${cellColor}; cursor:pointer; transition:all 0.18s; display:inline-flex; align-items:center; justify-content:center; color:${effectiveVal ? '#fff' : '#94a3b8'}; ${pendingRing}"
              title="${effectiveVal ? 'مسموح — اضغط لمنع' : 'ممنوع — اضغط للسماح'}"
            >
              <i class="fa-solid ${effectiveVal ? 'fa-check' : 'fa-xmark'}" style="font-size:14px;"></i>
            </button>`;
      }
      bodyHtml += '</td>';
    }
    bodyHtml += '</tr>';
  });
  body.innerHTML = bodyHtml;
}

function togglePermission(role, permKey, btn) {
  const currentVal = permissionsCurrentMatrix[role]?.[permKey] ?? false;
  if (!permissionsPendingChanges[role]) permissionsPendingChanges[role] = {};

  const prevPending = permissionsPendingChanges[role][permKey];
  const newVal = prevPending !== undefined ? !prevPending : !currentVal;

  // If back to original, remove from pending
  if (newVal === currentVal) {
    delete permissionsPendingChanges[role][permKey];
    if (Object.keys(permissionsPendingChanges[role]).length === 0) {
      delete permissionsPendingChanges[role];
    }
  } else {
    permissionsPendingChanges[role][permKey] = newVal;
  }

  // Update button visually
  const effectiveVal = permissionsPendingChanges[role]?.[permKey] ?? currentVal;
  const hasPending = permissionsPendingChanges[role]?.[permKey] !== undefined;
  btn.style.background = effectiveVal ? '#10b981' : '#e2e8f0';
  btn.style.borderColor = effectiveVal ? '#059669' : '#cbd5e1';
  btn.style.color = effectiveVal ? '#fff' : '#94a3b8';
  btn.style.outline = hasPending ? '3px solid #f59e0b' : 'none';
  btn.setAttribute('data-val', effectiveVal);
  btn.title = effectiveVal ? 'مسموح — اضغط لمنع' : 'ممنوع — اضغط للسماح';
  btn.innerHTML = `<i class="fa-solid ${effectiveVal ? 'fa-check' : 'fa-xmark'}" style="font-size:14px;"></i>`;

  updateChangeLog();
}

function updateChangeLog() {
  const logEl = document.getElementById('permissions-change-log');
  const listEl = document.getElementById('permissions-change-list');
  const changeCount = Object.values(permissionsPendingChanges).reduce((n, r) => n + Object.keys(r).length, 0);

  if (changeCount === 0) {
    logEl.style.display = 'none';
    return;
  }
  logEl.style.display = 'block';
  const items = [];
  for (const [role, perms] of Object.entries(permissionsPendingChanges)) {
    const rl = ROLE_LABELS_UI[role];
    for (const [permKey, allowed] of Object.entries(perms)) {
      const pl = PERMISSION_LABELS[permKey];
      const arrow = allowed
        ? '<span style="color:#10b981; font-weight:800;">→ مسموح</span>'
        : '<span style="color:#ef4444; font-weight:800;">→ ممنوع</span>';
      items.push(`<li><strong>${rl.ar}</strong> — ${pl.ar} ${arrow}</li>`);
    }
  }
  listEl.innerHTML = items.join('');
}

async function savePermissionsMatrix() {
  const changeCount = Object.values(permissionsPendingChanges).reduce((n, r) => n + Object.keys(r).length, 0);
  if (changeCount === 0) { notify('لا توجد تعديلات للحفظ', 'info'); return; }
  if (!confirm(`سيتم حفظ ${changeCount} تعديلات على صلاحيات الأدوار. هل أنت متأكد؟`)) return;

  const btn = document.getElementById('btn-save-permissions');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';

  try {
    const updates = [];
    for (const [role, perms] of Object.entries(permissionsPendingChanges)) {
      for (const [permissionKey, allowed] of Object.entries(perms)) {
        updates.push({ role, permissionKey, allowed });
      }
    }
    const res = await apiFetch('/admin/permissions', 'PUT', { updates });
    if (res.success) {
      notify(`تم حفظ ${changeCount} صلاحية بنجاح`, 'success');
      permissionsPendingChanges = {};
      // Apply to local matrix
      for (const u of updates) {
        if (!permissionsCurrentMatrix[u.role]) permissionsCurrentMatrix[u.role] = {};
        permissionsCurrentMatrix[u.role][u.permissionKey] = u.allowed;
      }
      renderPermissionsMatrix();
      updateChangeLog();
    } else {
      notify(res.message || 'فشل الحفظ', 'error');
    }
  } catch (e) {
    notify('خطأ في الاتصال بالخادم', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات';
  }
}

// ==============================================================================
// Operational Distribution Layer - Frontend Implementation
// ==============================================================================



async function renderOperationalTab() {
  if (!selectedNodeId) return;
  const listEl = document.getElementById('operational-locations-list');
  listEl.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">جاري تحميل المواقع التشغيلية والأرصدة...</p></div>';

  try {
    // 1. Fetch locations
    console.log('[OpTab] Step 1: fetching locations, selectedNodeId=', selectedNodeId);
    const locRes = await apiFetch(`/operational/nodes/${selectedNodeId}/locations`);
    if (!locRes.success) {
      listEl.innerHTML = `<div class="error-msg" style="display:block;">فشل جلب المواقع التشغيلية: ${locRes.message}</div>`;
      return;
    }
    cachedOpLocations = locRes.data || [];
    console.log('[OpTab] Step 1 done: locations count=', cachedOpLocations.length);

    // 2. Fetch stock summary
    console.log('[OpTab] Step 2: fetching summary');
    const sumRes = await apiFetch(`/operational/nodes/${selectedNodeId}/summary`);
    if (!sumRes.success) {
      listEl.innerHTML = `<div class="error-msg" style="display:block;">فشل جلب خلاصة الأرصدة: ${sumRes.message}</div>`;
      return;
    }
    cachedOpStockSummary = sumRes.data;
    console.log('[OpTab] Step 2 done: summary syncStatus=', cachedOpStockSummary.syncStatus, 'items=', cachedOpStockSummary.items.length);

    // 3. Update summary cards
    console.log('[OpTab] Step 3: updating summary cards');
    let totalOfficial = 0;
    let totalAllocated = 0;
    let totalConsumed = 0;
    let totalAvailable = 0;

    if (cachedOpStockSummary && cachedOpStockSummary.items) {
      cachedOpStockSummary.items.forEach(itm => {
        totalOfficial += itm.officialQuantity || 0;
        totalAllocated += itm.netAllocated || 0;
        totalConsumed += itm.totalConsumed || 0;
        totalAvailable += itm.availableToAllocate || 0;
      });
    }

    const elOfficial = document.getElementById('op-sum-official');
    const elAllocated = document.getElementById('op-sum-allocated');
    const elConsumed = document.getElementById('op-sum-consumed');
    const elAvailable = document.getElementById('op-sum-available');
    console.log('[OpTab] Step 3a: card elements found:', !!elOfficial, !!elAllocated, !!elConsumed, !!elAvailable);

    if (elOfficial) elOfficial.innerText = totalOfficial.toLocaleString();
    if (elAllocated) elAllocated.innerText = totalAllocated.toLocaleString();
    if (elConsumed) elConsumed.innerText = totalConsumed.toLocaleString();
    if (elAvailable) elAvailable.innerText = totalAvailable.toLocaleString();

    const statusCard = document.getElementById('op-sum-status-card');
    const statusLbl = document.getElementById('op-sum-status-label');
    const availableValEl = document.getElementById('op-sum-available');
    console.log('[OpTab] Step 3b: statusCard=', !!statusCard, 'statusLbl=', !!statusLbl, 'syncStatus=', cachedOpStockSummary.syncStatus);

    if (cachedOpStockSummary.syncStatus === 'OUT_OF_SYNC') {
      statusCard.style.background = '#fef2f2';
      statusCard.style.borderLeft = '4px solid var(--danger)';
      availableValEl.style.color = 'var(--danger)';
      statusLbl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> تعارض: التخصيص أكبر من الرسمي!';
      statusLbl.style.color = 'var(--danger)';
    } else {
      statusCard.style.background = '#f0fdf4';
      statusCard.style.borderLeft = '4px solid #16a34a';
      availableValEl.style.color = '#16a34a';
      statusLbl.innerText = 'رصيد متاح للتوزيع متطابق';
      statusLbl.style.color = 'var(--text-muted)';
    }

    // 4. Update location filter select
    const filterSelect = document.getElementById('op-location-filter');
    // IMPORTANT: Read selectedOperationalLocationId as authoritative source.
    // filterSelect.value at this point may return 'all' even if we set it to a location ID,
    // because the option for that location doesn't exist yet (we're about to build them).
    const targetFilterVal = selectedOperationalLocationId
      ? String(selectedOperationalLocationId)
      : filterSelect.value;

    filterSelect.innerHTML = '<option value="all">كل المواقع التشغيلية</option>';
    cachedOpLocations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.innerText = loc.name;
      filterSelect.appendChild(opt);
    });
    filterSelect.value = targetFilterVal;

    // 5. Render locations list
    const filterVal = filterSelect.value || 'all';
    const itemSearchQuery = document.getElementById('op-item-search').value.trim().toLowerCase();

    const locationsToRender = filterVal === 'all'
      ? cachedOpLocations
      : cachedOpLocations.filter(l => l.id == filterVal);


    if (locationsToRender.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:40px; background:#fff; border-radius:12px; border:1px solid var(--card-border);">
          <i class="fa-solid fa-location-dot" style="font-size:48px; color:var(--text-muted); margin-bottom:15px;"></i>
          <h3 style="font-size:16px; font-weight:800; margin-bottom:5px;">لا توجد مواقع تشغيلية مضافة</h3>
          <p style="font-size:13px; color:var(--text-muted);">انقر على "إضافة موقع تشغيلي جديد" لتهيئة هيكل الصرف الداخلي (الأدوار / الغرف / الأقسام).</p>
        </div>
      `;
      return;
    }

    let listHtml = '';
    locationsToRender.forEach(loc => {
      // Find allocations for this location
      const locAllocations = [];
      if (cachedOpStockSummary && cachedOpStockSummary.items) {
        cachedOpStockSummary.items.forEach(itm => {
          const locItm = itm.locations.find(l => l.locationId === loc.id);
          if (locItm && (locItm.allocated > 0 || locItm.consumed > 0 || locItm.returned > 0 || locItm.adjusted !== 0)) {
            // Apply search filter if query is typed
            if (!itemSearchQuery ||
              itm.itemCode.toLowerCase().includes(itemSearchQuery) ||
              itm.itemNameAr.toLowerCase().includes(itemSearchQuery)) {
              locAllocations.push({
                itemCode: itm.itemCode,
                itemNameAr: itm.itemNameAr,
                unitNameAr: itm.unitNameAr,
                allocated: locItm.allocated,
                consumed: locItm.consumed,
                returned: locItm.returned,
                adjusted: locItm.adjusted,
                balance: locItm.balance,
              });
            }
          }
        });
      }

      // Check if location has any active transactions overall
      const hasTransactions = locAllocations.length > 0;

      let itemsRows = '';
      if (locAllocations.length === 0) {
        itemsRows = `
          <tr>
            <td colspan="6" style="text-align:center; color:var(--text-muted); padding:15px; font-size:12px;">
              ${itemSearchQuery ? 'لا توجد أصناف مطابقة للبحث' : 'لا يوجد مخزون مخصص حالياً لهذا الموقع'}
            </td>
          </tr>
        `;
      } else {
        locAllocations.forEach(alloc => {
          const warnBadge = alloc.balance < 0 ? '<span class="badge badge-danger">رصيد سالب!</span>' : '';
          itemsRows += `
            <tr style="font-size:13px;">
              <td style="font-weight:700;">${alloc.itemCode}</td>
              <td style="font-weight:700;">${alloc.itemNameAr}</td>
              <td style="color:var(--primary); font-weight:700;">${alloc.allocated.toLocaleString()} ${alloc.unitNameAr}</td>
              <td style="color:var(--success); font-weight:700;">${alloc.consumed.toLocaleString()} ${alloc.unitNameAr}</td>
              <td style="color:var(--danger); font-weight:700;">${alloc.returned.toLocaleString()} ${alloc.unitNameAr}</td>
              <td style="background:#f8fafc; font-weight:800; color:${alloc.balance < 0 ? 'var(--danger)' : '#16a34a'}">
                ${alloc.balance.toLocaleString()} ${alloc.unitNameAr} ${warnBadge}
              </td>
            </tr>
          `;
        });
      }

      listHtml += `
        <div class="card" style="border: 1px solid var(--card-border); border-radius:14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); overflow:hidden; background:#fff; margin-bottom: 20px;">
          <div style="background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:15px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="background:var(--primary); color:#fff; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px;">
                <i class="fa-solid fa-location-dot"></i>
              </div>
              <div>
                <h4 style="font-size:15px; font-weight:800; color:var(--text-main); margin:0;">${loc.name}</h4>
                <p style="font-size:11px; color:var(--text-muted); margin:0;">${loc.description || 'لا يوجد وصف للموقع'}</p>
              </div>
            </div>
            
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary" onclick="openEditLocationModal(${loc.id}, '${loc.name}', '${loc.description || ''}', ${loc.displayOrder})" style="padding: 6px 12px; font-size: 12px;" title="تعديل الموقع"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
              <button class="btn btn-danger" onclick="deleteOpLocation(${loc.id})" ${hasTransactions ? 'disabled title="لا يمكن حذف موقع به معاملات مخزنية معلقة"' : ''} style="padding: 6px 12px; font-size: 12px;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
          </div>

          <div style="padding:15px;">
            <div style="overflow-x: auto; margin-bottom:15px;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:#f1f5f9; color:var(--text-main); font-size:12px;">
                    <th style="width:120px; padding:8px; text-align:right;">كود الصنف</th>
                    <th style="padding:8px; text-align:right;">اسم الصنف</th>
                    <th style="width:120px; padding:8px; text-align:right;">الموزع (Allocated)</th>
                    <th style="width:120px; padding:8px; text-align:right;">المستهلك (Consumed)</th>
                    <th style="width:120px; padding:8px; text-align:right;">المرتجع (Returned)</th>
                    <th style="width:130px; background:#e2e8f0; padding:8px; text-align:right;">الرصيد المتاح (Balance)</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            </div>

            <!-- Transaction actions for location -->
            <div style="display:flex; gap:10px; border-top:1px dashed #e2e8f0; padding-top:15px; flex-wrap:wrap;">
              <button class="btn" onclick="openOpTxnModal(${loc.id}, '${loc.name}', 'ALLOCATE')" style="background:var(--warning); border-color:var(--warning); color:#000; padding:8px 16px; font-size:12px; font-weight:700;"><i class="fa-solid fa-arrow-right-to-bracket"></i> صرف كميات (Allocate)</button>
              <button class="btn" onclick="openOpTxnModal(${loc.id}, '${loc.name}', 'CONSUME')" style="background:var(--success); border-color:var(--success); color:#fff; padding:8px 16px; font-size:12px; font-weight:700;"><i class="fa-solid fa-hand-holding-hand"></i> إهلاك / استهلاك (Consume)</button>
              <button class="btn" onclick="openOpTxnModal(${loc.id}, '${loc.name}', 'RETURN')" style="background:var(--primary); border-color:var(--primary); color:#fff; padding:8px 16px; font-size:12px; font-weight:700;"><i class="fa-solid fa-rotate-left"></i> إرجاع فائض (Return)</button>
              <button class="btn btn-secondary" onclick="openOpTxnModal(${loc.id}, '${loc.name}', 'ADJUSTMENT')" style="padding:8px 16px; font-size:12px; font-weight:700;"><i class="fa-solid fa-sliders"></i> تعديل تسوية (Adjustment)</button>
            </div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = listHtml;

  } catch (err) {
    console.error('Error rendering operational tab:', err);
    listEl.innerHTML = `<div class="error-msg" style="display:block; white-space:pre-wrap; font-size:11px; text-align:left; direction:ltr;">
      <strong>JS Error:</strong> ${err.message}<br>
      <strong>Stack:</strong><br>${(err.stack || '').replace(/</g, '&lt;')}
    </div>`;
  }
}

// Modals management
function closeOpModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function openCreateLocationModal() {
  document.getElementById('op-loc-modal-title').innerText = 'إضافة موقع تشغيلي جديد';
  document.getElementById('op-loc-id').value = '';
  document.getElementById('op-loc-name').value = '';
  document.getElementById('op-loc-desc').value = '';
  document.getElementById('op-loc-order').value = '0';
  document.getElementById('op-location-modal').style.display = 'flex';
}

function openEditLocationModal(id, name, desc, order) {
  document.getElementById('op-loc-modal-title').innerText = 'تعديل بيانات الموقع التشغيلي';
  document.getElementById('op-loc-id').value = id;
  document.getElementById('op-loc-name').value = name;
  document.getElementById('op-loc-desc').value = desc;
  document.getElementById('op-loc-order').value = order;
  document.getElementById('op-location-modal').style.display = 'flex';
}

async function submitOpLocation(event) {
  event.preventDefault();
  const id = document.getElementById('op-loc-id').value;
  const name = document.getElementById('op-loc-name').value.trim();
  const description = document.getElementById('op-loc-desc').value.trim();
  const displayOrder = parseInt(document.getElementById('op-loc-order').value, 10) || 0;

  if (!name) { notify('يرجى إدخال اسم الموقع التشغيلي', 'warn'); return; }

  const body = { name, description, displayOrder };

  try {
    let res;
    if (id) {
      res = await apiFetch(`/operational/locations/${id}`, 'PUT', { ...body, isActive: true });
    } else {
      res = await apiFetch(`/operational/nodes/${selectedNodeId}/locations`, 'POST', { ...body, tenantId: 1, isActive: true });
    }

    if (res.success) {
      notify(id ? 'تم تعديل الموقع بنجاح' : 'تم إضافة الموقع التشغيلي بنجاح', 'success');
      closeOpModal('op-location-modal');
      renderOperationalTab();
    } else {
      notify(res.message || 'فشلت العملية', 'error');
    }
  } catch (err) {
    notify('فشل الاتصال بالخادم لتسجيل الموقع', 'error');
  }
}

async function deleteOpLocation(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الموقع التشغيلي نهائياً؟')) return;

  try {
    const res = await apiFetch(`/operational/locations/${id}`, 'DELETE');
    if (res.success) {
      notify('تم حذف الموقع بنجاح', 'success');
      renderOperationalTab();
    } else {
      notify(res.message || 'فشل الحذف', 'error');
    }
  } catch (err) {
    notify('خطأ في الاتصال بالخادم', 'error');
  }
}

// Transaction Modals
let opModalAvailableStock = [];

async function openOpTxnModal(locationId, locationName, type) {
  document.getElementById('op-txn-location-id').value = locationId;
  document.getElementById('op-txn-location-name').value = locationName;
  document.getElementById('op-txn-type').value = type;
  document.getElementById('op-txn-qty').value = '';
  document.getElementById('op-txn-notes').value = '';

  const titleEl = document.getElementById('op-txn-modal-title');
  const subEl = document.getElementById('op-txn-modal-subtitle');
  const iconCont = document.getElementById('op-txn-icon-container');
  const iconEl = document.getElementById('op-txn-header-icon');
  const submitBtn = document.getElementById('op-txn-submit-btn');
  const allocFields = document.getElementById('op-txn-allocate-fields');
  const helperBox = document.getElementById('op-txn-helper-box');
  const helperText = document.getElementById('op-txn-helper-text');

  allocFields.style.display = 'none';

  if (type === 'ALLOCATE') {
    titleEl.innerText = 'تخصيص وصرف مخزون (Allocate)';
    subEl.innerText = 'توزيع كميات من المستودع إلى هذا الموقع التشغيلي';
    iconCont.style.background = 'linear-gradient(135deg, var(--warning), #d97706)';
    iconEl.className = 'fa-solid fa-arrow-right-to-bracket';
    submitBtn.style.background = 'var(--warning)';
    submitBtn.style.color = '#000';
    submitBtn.innerText = 'صرف وتخصيص';
    allocFields.style.display = 'grid';

    helperBox.style.background = '#fffbeb';
    helperBox.style.borderColor = '#fde68a';
    helperBox.style.color = '#92400e';
    helperText.innerHTML = `<strong>صرف وتخصيص:</strong> تقوم بنقل كميات من رصيد المستودع الرئيسي المتاح لعهدة الموقع <strong>${locationName}</strong>. يقلل هذا الإجراء الرصيد المتاح للتوزيع في المستودع الرئيسي.`;
  } else if (type === 'CONSUME') {
    titleEl.innerText = 'تسجيل استهلاك (Consume)';
    subEl.innerText = 'إهلاك أو استهلاك كميات داخل هذا الموقع التشغيلي';
    iconCont.style.background = 'linear-gradient(135deg, var(--success), #059669)';
    iconEl.className = 'fa-solid fa-hand-holding-hand';
    submitBtn.style.background = 'var(--success)';
    submitBtn.style.color = '#fff';
    submitBtn.innerText = 'إهلاك واستهلاك';

    helperBox.style.background = '#f0fdf4';
    helperBox.style.borderColor = '#bbf7d0';
    helperBox.style.color = '#15803d';
    helperText.innerHTML = `<strong>إهلاك واستهلاك:</strong> تقوم بتسجيل الاستهلاك الفعلي والنهائي داخل الموقع <strong>${locationName}</strong> (مثل استخدام المنظفات). يقلل رصيد الموقع ولا يؤثر على المستودع المالي.`;
  } else if (type === 'RETURN') {
    titleEl.innerText = 'إرجاع مخزون فائض (Return)';
    subEl.innerText = 'إعادة كميات غير مستخدمة من هذا الموقع إلى رصيد المستودع';
    iconCont.style.background = 'linear-gradient(135deg, var(--primary), #1d4ed8)';
    iconEl.className = 'fa-solid fa-rotate-left';
    submitBtn.style.background = 'var(--primary)';
    submitBtn.style.color = '#fff';
    submitBtn.innerText = 'إرجاع المخزون';

    helperBox.style.background = '#eff6ff';
    helperBox.style.borderColor = '#bfdbfe';
    helperBox.style.color = '#1d4ed8';
    helperText.innerHTML = `<strong>إرجاع فائض:</strong> تقوم بإرجاع الكميات الزائدة من الموقع <strong>${locationName}</strong> إلى عهدة المستودع الرئيسي لتعود كجزء من الرصيد المتاح للتوزيع.`;
  } else if (type === 'ADJUSTMENT') {
    titleEl.innerText = 'تسوية رصيد (Adjustment)';
    subEl.innerText = 'إدخال تسوية يدوية (موجبة أو سالبة) لتطابق الجرد الفعلي';
    iconCont.style.background = 'linear-gradient(135deg, var(--danger), #dc2626)';
    iconEl.className = 'fa-solid fa-sliders';
    submitBtn.style.background = 'var(--danger)';
    submitBtn.style.color = '#fff';
    submitBtn.innerText = 'تأكيد التسوية';

    helperBox.style.background = '#fef2f2';
    helperBox.style.borderColor = '#fecaca';
    helperBox.style.color = '#b91c1c';
    helperText.innerHTML = `<strong>تسوية رصيد:</strong> تسوية كميات الصنف يدوياً لمطابقة الجرد الفعلي للموقع <strong>${locationName}</strong>. أدخل قيمة سالبة للخصم (مثل -5) وموجبة للإضافة (مثل 5).`;
  }

  // Load items dropdown
  const itemSelect = document.getElementById('op-txn-item-select');
  itemSelect.innerHTML = '<option value="">جاري تحميل الأصناف...</option>';

  try {
    // We can use items from currentStockData or sync summaries
    const nodeStockRes = await apiFetch(`/hierarchy/nodes/${selectedNodeId}/stock`);
    if (nodeStockRes.success && nodeStockRes.data && nodeStockRes.data.items) {
      opModalAvailableStock = nodeStockRes.data.items;
      itemSelect.innerHTML = '<option value="">اختر الصنف من العهدة المتاحة...</option>';
      opModalAvailableStock.forEach(itm => {
        const opt = document.createElement('option');
        opt.value = itm.itemCode;
        opt.innerText = `${itm.itemCode} - ${itm.itemNameAr} (${itm.unitNameAr})`;
        itemSelect.appendChild(opt);
      });
    } else {
      itemSelect.innerHTML = `<option value="">فشل تحميل الأصناف: ${nodeStockRes.message || 'خطأ غير معروف'}</option>`;
      fallbackToLocalItems(itemSelect);
    }
  } catch (err) {
    console.error('API Fetch Error in openOpTxnModal:', err);
    itemSelect.innerHTML = `<option value="">فشل الاتصال: ${err.message}</option>`;
    fallbackToLocalItems(itemSelect);
  }

  function fallbackToLocalItems(selectEl) {
    if (typeof localItemsList !== 'undefined' && localItemsList.length > 0) {
      opModalAvailableStock = localItemsList.map(i => ({
        itemCode: i.itemCode,
        itemNameAr: i.itemNameAr,
        unitNameAr: i.unitNameAr || 'PCS',
        qtyOperational: 'غير معروف'
      }));
      selectEl.innerHTML = '<option value="">(الوضع الاحتياطي) اختر الصنف...</option>';
      opModalAvailableStock.forEach(itm => {
        const opt = document.createElement('option');
        opt.value = itm.itemCode;
        opt.innerText = `${itm.itemCode} - ${itm.itemNameAr}`;
        selectEl.appendChild(opt);
      });
    }
  }

  updateOpAvailableLabel();
  document.getElementById('op-txn-modal').style.display = 'flex';
}

function updateOpAvailableLabel() {
  const itemCode = document.getElementById('op-txn-item-select').value;
  const label = document.getElementById('op-txn-available-lbl');
  const type = document.getElementById('op-txn-type').value;

  if (!itemCode) {
    label.innerText = 'اختر صنفاً لعرض رصيده المتاح';
    return;
  }

  const item = opModalAvailableStock.find(i => i.itemCode === itemCode);
  const qty = item ? parseFloat(item.qtyOperational) : 0;
  const unit = item ? item.unitNameAr : 'وحدة';

  if (type === 'ALLOCATE') {
    // Show official available stock in main node
    // Let's deduce what is already allocated
    let netAllocated = 0;
    if (cachedOpStockSummary && cachedOpStockSummary.items) {
      const summaryItem = cachedOpStockSummary.items.find(i => i.itemCode === itemCode);
      if (summaryItem) {
        netAllocated = parseFloat(summaryItem.netAllocated || 0);
      }
    }
    const remaining = qty - netAllocated;
    label.innerText = `الرصيد الرسمي: ${qty.toLocaleString()} | المتبقي غير الموزع: ${remaining.toLocaleString()} ${unit}`;
    if (remaining < 0) {
      label.innerText += ' (تنبيه: تم توزيع كميات أكبر من الرصيد الفعلي!)';
      label.style.color = 'var(--danger)';
    } else {
      label.style.color = 'var(--text-muted)';
    }
  } else {
    // Show current location balance
    const locId = parseInt(document.getElementById('op-txn-location-id').value, 10);
    let locBal = 0;
    if (cachedOpStockSummary && cachedOpStockSummary.items) {
      const summaryItem = cachedOpStockSummary.items.find(i => i.itemCode === itemCode);
      if (summaryItem) {
        const locItm = summaryItem.locations.find(l => l.locationId === locId);
        if (locItm) locBal = locItm.balance;
      }
    }
    label.innerText = `الرصيد المتاح حالياً في هذا الموقع: ${locBal.toLocaleString()} ${unit}`;
    label.style.color = 'var(--text-muted)';
  }
}

async function submitOpTransaction(event) {
  event.preventDefault();
  const locationId = document.getElementById('op-txn-location-id').value;
  const type = document.getElementById('op-txn-type').value;
  const itemCode = document.getElementById('op-txn-item-select').value;
  const quantity = parseFloat(document.getElementById('op-txn-qty').value);
  const notes = document.getElementById('op-txn-notes').value.trim();

  if (!itemCode) { notify('يرجى اختيار الصنف أولاً', 'warn'); return; }
  if (isNaN(quantity) || quantity <= 0) {
    if (type !== 'ADJUSTMENT' || quantity === 0) {
      notify('يرجى إدخال كمية صحيحة أكبر من الصفر', 'warn');
      return;
    }
  }

  const endpoint = `/operational/locations/${locationId}/${type.toLowerCase()}`;
  const body = { itemCode, quantity, notes };

  if (type === 'ALLOCATE') {
    body.referenceType = document.getElementById('op-txn-ref-type').value.trim() || null;
    body.referenceId = document.getElementById('op-txn-ref-id').value.trim() || null;
  }

  const submitBtn = document.getElementById('op-txn-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التنفيذ...';

  try {
    const res = await apiFetch(endpoint, 'POST', body);
    if (res.success) {
      notify(res.message || 'تم تسجيل الحركة التشغيلية بنجاح', 'success');
      closeOpModal('op-txn-modal');
      renderOperationalTab();
    } else {
      notify(res.message || 'فشلت العملية', 'error');
    }
  } catch (err) {
    notify('فشل الاتصال بالخادم لتنفيذ الحركة', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'تأكيد العملية';
  }
}

