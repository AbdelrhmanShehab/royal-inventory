    const API_BASE = '/api/v1';
    let token = ''; // Empty string forces real authentication overlay
    let currentGroupId = 1;
    let selectedNodeId = null; 
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
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
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
          document.getElementById('user-initials').innerText = user.fullNameAr ? user.fullNameAr.slice(0,2).toUpperCase() : usernameInput.slice(0,2).toUpperCase();
          document.getElementById('login-overlay').style.display = 'none';
          notify('تم تسجيل الدخول بنجاح!', 'success');
          
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
        select.innerHTML = '<option value="">اختر مخزن للربط...</option>';
        cachedComsysWarehouses.forEach(w => {
          const opt = document.createElement('option'); opt.value = w.storeCode; opt.innerText = w.storeCode + ' - ' + w.storeNameAr; select.appendChild(opt);
        });
      }
    }

    document.getElementById('comsys-warehouse-select').addEventListener('change', (e) => {
      const val = e.target.value;
      if (val) {
        const w = cachedComsysWarehouses.find(x => x.storeCode === val);
        if (w) document.getElementById('child-node-name').value = w.storeNameAr;
      } else {
        document.getElementById('child-node-name').value = '';
      }
    });

    async function loadTree() {
      const res = await apiFetch('/hierarchy/tree?groupId=' + currentGroupId);
      const container = document.getElementById('tree-container');
      container.innerHTML = '';
      if (res.success && res.data && res.data.nodes) {
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
      header.className = 'node-header ' + (node.nodeType === 'parent' ? 'parent-node' : 'child-node');
      if (selectedNodeId === node.id) header.classList.add('active');
      
      const toggle = document.createElement('span');
      toggle.className = 'toggle-icon';
      if (node.nodeType === 'parent' && node.children && node.children.length > 0) {
        toggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i>'; toggle.classList.add('open');
      }
      header.appendChild(toggle);
      
      const icon = document.createElement('i');
      icon.className = 'node-icon ' + (node.nodeType === 'parent' ? 'fa-regular fa-folder-open' : 'fa-solid fa-warehouse');
      header.appendChild(icon);
      
      const name = document.createElement('span'); name.innerText = node.nodeNameAr; header.appendChild(name);
      
      const stockBadge = document.createElement('span');
      stockBadge.className = 'node-stock-badge'; stockBadge.innerText = node.totalStock !== undefined ? node.totalStock.toLocaleString() : '0';
      header.appendChild(stockBadge);
      nodeEl.appendChild(header);

      const childrenBox = document.createElement('div');
      childrenBox.className = 'node-children';
      if (node.children && node.children.length > 0) {
        childrenBox.classList.add('expanded');
        node.children.forEach(c => { childrenBox.appendChild(buildTreeNodeDOM(c)); });
      }
      nodeEl.appendChild(childrenBox);

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
      selectedNodeId = node.id;
      document.querySelectorAll('.node-header').forEach(h => h.classList.remove('active'));
      const nodeContainer = document.getElementById('node-' + node.id);
      if (nodeContainer) {
        const selfHeader = nodeContainer.querySelector('.node-header');
        if (selfHeader) selfHeader.classList.add('active');
      }
      document.getElementById('selected-node-ops').style.display = 'block';
      loadNodeStock(node);
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
        if (n.nodeType === 'child') result.push(n);
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
      
      if (node.nodeType === 'parent') {
        tabTx.style.display = 'none';
        tabMov.innerText = 'أرصدة المستودعات التابعة';
        tabStk.innerText = 'الأصناف التراكمية';
      } else {
        tabTx.style.display = 'block';
        tabMov.innerText = 'ملخص حركة المستودع (تقرير القيمة)';
        tabStk.innerText = 'الأصناف الحالية';
      }

      try {
        const res = await apiFetch('/hierarchy/nodes/' + node.id + '/stock');
        if (res.success) {
          currentStockData = res.data;
          document.getElementById('card-total-stock').innerText = currentStockData.totalStock.toLocaleString();
          document.getElementById('card-item-types').innerText = currentStockData.itemTypesCount;
          document.getElementById('card-subunits').innerText = currentStockData.subunitsCount;

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
            if (node.nodeType === 'parent') {
              renderParentStockDistribution();
            } else {
              renderMovementSummaryReport();
            }
          } else if (explorerActiveTab === 'transactions') {
            renderNodeTransactions(node.id);
          }
        }
      } catch (err) {
        console.error('Error fetching stock', err);
      }
    }

    function renderParentStockDistribution() {
      const tbody = document.getElementById('movement-report-body');
      tbody.innerHTML = '';
      if (!currentStockData.subunitStock || currentStockData.subunitStock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد مستودعات تابعة لهذا المجلد.</td></tr>';
        return;
      }
      
      tbody.innerHTML = '<tr style="background:#f8fafc; font-weight:800;"><td colspan="3">رقم العقدة</td><td colspan="5" style="text-align:right;">المستودع التشغيلي التابع</td><td colspan="3">أرصدة الأصناف التراكمية</td></tr>';
      currentStockData.subunitStock.forEach(sub => {
        tbody.innerHTML += '<tr style="cursor:pointer;" onclick="loadNodeStock({id: ' + sub.id + ', nodeNameAr: \'' + sub.nodeNameAr + '\', nodeType: \'child\'})">' +
          '<td colspan="3">' + sub.id + '</td>' +
          '<td colspan="5" style="text-align:right; font-weight:700;"><i class="fa-solid fa-box-archive" style="color:var(--primary); margin-left:8px;"></i>' + sub.nodeNameAr + '</td>' +
          '<td colspan="3" style="color:var(--primary); font-weight:800;">' + sub.totalStock.toLocaleString() + ' صنف</td>' +
          '</tr>';
      });
    }

    async function renderNodeTransactions(nodeId) {
      const tbody = document.getElementById('node-transactions-body');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل الحركات...</td></tr>';
      
      try {
        const res = await apiFetch('/transactions/transfers?nodeId=' + nodeId);
        if (res.success) {
          tbody.innerHTML = '';
          const txns = res.data;
          if (txns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);"><i class="fa-solid fa-info-circle"></i> لا توجد حركات مسجلة لهذا المستودع.</td></tr>';
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
          
          txns.forEach(t => {
            const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG');
            let typeBadge = '<span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span>';
            let statusBadge = '<span class="badge ' + (t.status === 'draft' ? 'badge-warning' : 'badge-success') + '">' + (t.status === 'draft' ? 'مسودة' : 'مؤكدة') + '</span>';
            
            tbody.innerHTML += '<tr>' +
              '<td><strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></td>' +
              '<td>' + typeBadge + '</td>' +
              '<td>' + dateStr + '</td>' +
              '<td>' + (t.creatorUsername || 'النظام') + '</td>' +
              '<td style="text-align:right; font-size:11px;">' + (t.notes || '-') + '</td>' +
              '<td>' + statusBadge + '</td>' +
              '<td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="goToTransactionDetails(' + t.txnId + ')"><i class="fa-regular fa-eye"></i> عرض</button></td>' +
              '</tr>';
          });
        }
      } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">فشل تحميل المعاملات من الخادم.</td></tr>';
      }
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
      let totalPrevQty = 0, totalPrevVal = 0, totalInQty = 0, totalInVal = 0, totalOutQty = 0, totalOutVal = 0, totalCurrQty = 0, totalCurrVal = 0;
      explorerItemsList.forEach(item => {
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

        tbody.innerHTML += '<tr> <td>' + item.itemCode + '</td><td style="text-align:right; font-weight:700;">' + (item.itemNameAr || 'صنف') + '</td><td>' + (item.unitNameAr || 'حبة') + '</td> <td style="background:#fcfcfc;">' + prevQty.toLocaleString() + '</td><td style="background:#fcfcfc;">' + prevVal.toLocaleString() + ' ج.م</td> <td style="background:#f7f9fc;">' + inQty.toLocaleString() + '</td><td style="background:#f7f9fc;">' + inVal.toLocaleString() + ' ج.م</td> <td style="background:#fdfdfd;">' + outQty.toLocaleString() + '</td><td style="background:#fdfdfd;">' + outVal.toLocaleString() + ' ج.م</td> <td style="background:#f6fbf9; font-weight:700; color:var(--primary);">' + currQty.toLocaleString() + '</td> <td style="background:#f6fbf9; font-weight:700; color:var(--success);">' + currVal.toLocaleString() + ' ج.م</td> </tr>';
      });
      tbody.innerHTML += '<tr class="total-row"> <td colspan="3" style="text-align:left; font-weight:800; padding:12px;">إجمالي تصنيف المستودع الفرعي:</td> <td>' + totalPrevQty.toLocaleString() + '</td><td>' + totalPrevVal.toLocaleString() + ' ج.م</td> <td>' + totalInQty.toLocaleString() + '</td><td>' + totalInVal.toLocaleString() + ' ج.م</td> <td>' + totalOutQty.toLocaleString() + '</td><td>' + totalOutVal.toLocaleString() + ' ج.م</td> <td style="color:var(--primary);">' + totalCurrQty.toLocaleString() + '</td><td style="color:var(--success);">' + totalCurrVal.toLocaleString() + ' ج.م</td> </tr>';
    }

    document.getElementById('table-search').addEventListener('input', () => { expCurrentPage = 1; renderExplorerItemsTable(); });

    document.getElementById('add-parent-node-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('parent-node-name').value;
      const body = {
        groupId: currentGroupId,
        parentNodeId: selectedNodeId,
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
          document.getElementById('parent-node-name').value = '';
          await loadTree();
        }
      } catch (err) { notify('فشلت عملية إضافة المجلد', 'error'); }
    });

    document.getElementById('link-warehouse-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const storeCode = document.getElementById('comsys-warehouse-select').value;
      const name = document.getElementById('child-node-name').value;
      if (!storeCode) { notify('الرجاء تحديد مخزن كومسيس الفعلي أولاً', 'error'); return; }
      
      const body = {
        comsysStoreCode: storeCode,
        groupId: currentGroupId,
        parentNodeId: selectedNodeId,
        nodeNameAr: name,
        nodeType: 'child',
        managerName: 'أمين العهدة',
        isActive: true,
        division: 'fb'
      };

      try {
        const res = await apiFetch('/hierarchy/nodes', 'POST', body);
        if (res.success) {
          notify('تم ربط مخزن كومسيس وتوليد الأرصدة التشغيلية بنجاح!', 'success');
          document.getElementById('comsys-warehouse-select').value = '';
          document.getElementById('child-node-name').value = '';
          await loadTree();
        }
      } catch (err) { notify('فشل ربط المستودع', 'error'); }
    });

    document.getElementById('btn-delete-node').addEventListener('click', async () => {
      if (!selectedNodeId) return;
      if (!confirm('هل متأكد من فك ربط وحذف المجلد/المستودع المختار؟')) return;
      
      try {
        const res = await apiFetch('/hierarchy/nodes/' + selectedNodeId, 'DELETE');
        if (res.success) {
          notify('تم حذف وفك ربط العقدة بنجاح', 'success');
          selectedNodeId = null;
          document.getElementById('selected-node-ops').style.display = 'none';
          await loadTree();
        }
      } catch (err) { notify('فشل حذف العقدة', 'error'); }
    });

    function renderTransfersEmptyState() {
      const total = filteredTransfersList.length;
      document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; flex-direction:column; justify-content:space-between; height:100%;"> <div> <div class="selected-node-path">العمليات / سجل الحركات</div><div class="selected-node-title" style="margin-bottom:25px;">مركز العمليات والعهدة الفرعية</div> <div class="stats-grid" style="margin-bottom: 30px; text-align:right;"> <div class="stat-card"><h3>إجمالي الحركات</h3><div class="value">' + total + '</div></div> </div> </div> <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; flex-grow:1; text-align:center; color:var(--text-muted); gap:15px; padding:40px 20px;"> <div style="font-size:64px; color:#cbd5e1;"><i class="fa-solid fa-arrow-right-arrow-left"></i></div> <h3 style="font-weight:800; color:var(--text-main); font-size:16px;">متابعة العهد والعمليات الفرعية</h3> <p style="max-width:440px; font-size:13px; line-height:1.6; margin-bottom: 5px;">هذا القسم يغطي تدفق كافة العمليات (الاستهلاك، الهدر، التالف، التخريد، التحويلات والمرتجعات) الخاصة بالمطابخ والمستودعات الفرعية. اختر حركة من القائمة الجانبية لعرض تدفقها الرسومي.</p> <button class="btn" onclick="showNewTransferForm()"><i class="fa-solid fa-plus"></i> تسجيل حركة جديدة</button> </div> </div> ';
    }

    async function loadTransfers() { 
      tfCurrentPage = 1; 
      const res = await apiFetch('/transactions/transfers');
      if (res.success) {
        filteredTransfersList = res.data;
        renderTransfersList(); 
        renderTransfersEmptyState(); 
      }
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
      
      const items = filteredTransfersList.filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (typeFilter !== 'all' && t.txnType !== typeFilter) return false;
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
      const trans = { consumption: 'استهلاك تشغيلي', internal_transfer: 'تحويل داخلي', waste: 'هدر مواد', damage: 'تلف سلع', return: 'مرتجع للمخزن', disposal: 'تكهين واستبعاد' };
      
      items.slice(startIndex, startIndex + tfPageSize).forEach(t => {
        const card = document.createElement('div'); card.className = 'transfer-card'; card.id = 'tf-card-' + t.txnId;
        const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        let flowText = t.txnType === 'internal_transfer' ? 'تحويل: ' + t.fromNodeNameAr + ' ➔ ' + t.toNodeNameAr : (t.txnType === 'return' ? 'مرتجع: ' + t.fromNodeNameAr + ' ➔ الرئيسي' : trans[t.txnType] + ': ' + (t.fromNodeNameAr || 'مخزن'));
        card.innerHTML = ' <div class="transfer-card-header"><span class="transfer-card-ref">OP-2026-' + String(t.txnId).padStart(3, "0") + '</span><span class="transfer-card-date">' + dateStr + '</span></div> <div style="font-size: 11px; font-weight: 700; color: #475569; direction: rtl; margin-top:2px;">' + flowText + '</div> <div class="transfer-card-footer" style="margin-top: 5px;"><span class="badge badge-type-' + t.txnType + '" style="font-size:9px;">' + trans[t.txnType] + '</span><span class="badge ' + (t.status === 'draft' ? 'badge-warning' : 'badge-success') + '">' + (t.status === 'draft' ? 'مسودة' : 'مؤكدة') + '</span></div> ';
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
          // Reload all data from database
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

    async function viewTransferDetails(id) {
      const res = await apiFetch('/transactions/transfers/' + id);
      if (!res.success) return;
      const t = res.data;
      
      let totalQty = 0, totalCost = 0;
      t.lines.forEach(l => { totalQty += l.quantity; totalCost += (l.quantity * l.unitCost); });
      const trans = { consumption: 'استهلاك تشغيلي', internal_transfer: 'تحويل داخلي', waste: 'هدر خامات ومواد', damage: 'تلف سلع ومواد', return: 'مرتجع مستودع رئيسي', disposal: 'تكهين واستبعاد أصول' };
      const configs = {
        consumption: { icon: 'fa-utensils', sourceName: t.fromNodeNameAr, destName: 'صالة الخدمة والتشغيل', sourceLabel: 'مستودع العهدة (من)', destLabel: 'الجهة المستهلكة (إلى)', color: '#3b82f6', speed: '2s' },
        waste: { icon: 'fa-trash-can', sourceName: t.fromNodeNameAr, destName: 'سلة المهملات والتوالف', sourceLabel: 'مستودع العهدة (من)', destLabel: 'حاوية الهدر (إلى)', color: '#ef4444', speed: '2.5s' },
        damage: { icon: 'fa-triangle-exclamation', sourceName: t.fromNodeNameAr, destName: 'مخزن المواد التالفة', sourceLabel: 'مستودع العهدة (من)', destLabel: 'سجل التوالف (إلى)', color: '#f59e0b', speed: '2.2s' },
        disposal: { icon: 'fa-ban', sourceName: t.fromNodeNameAr, destName: 'ساحة الخردة / التخريد', sourceLabel: 'مستودع العهدة (من)', destLabel: 'استبعاد نهائي (إلى)', color: '#64748b', speed: '3s' },
        return: { icon: 'fa-boxes-stacked', sourceName: t.fromNodeNameAr, destName: t.toNodeNameAr || 'المخزن الرئيسي 001', sourceLabel: 'العهدة الفرعية (من)', destLabel: 'مستودع كومسيس الرئيسي (إلى)', color: '#a855f7', speed: '1.5s' },
        internal_transfer: { icon: 'fa-box-archive', sourceName: t.fromNodeNameAr, destName: t.toNodeNameAr, sourceLabel: 'مستودع المصدر (من)', destLabel: 'مستودع الوجهة (إلى)', color: '#10b981', speed: '1.2s' }
      };
      const flow = configs[t.txnType];
      
      document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"> <div><div class="selected-node-path">العمليات / تفاصيل مستند العمليات</div><div class="selected-node-title" style="font-size:22px;">مستند ' + trans[t.txnType] + ' OP-2026-' + String(t.txnId).padStart(3, "0") + '</div></div> <button class="btn btn-secondary" onclick="renderTransfersEmptyState()"><i class="fa-solid fa-xmark"></i> إغلاق</button> </div> <div class="flow-diagram-container"> <div class="flow-node"><i class="fa-solid fa-building" style="background: rgba(37, 99, 235, 0.1); color: var(--primary);"></i><span class="flow-node-name" title="' + flow.sourceName + '">' + flow.sourceName + '</span><span class="flow-node-type">' + flow.sourceLabel + '</span></div> <div class="flow-arrow-container"><svg width="100%" height="20" style="overflow: visible;"><line x1="0" y1="10" x2="100%" y2="10" stroke-width="4" stroke-dasharray="10 8" style="animation: strokeAnim ' + flow.speed + ' infinite linear; stroke: ' + flow.color + ';" /></svg></div> <div class="flow-node"><i class="fa-solid ' + flow.icon + '" style="background: ' + flow.color + '15; color: ' + flow.color + ';"></i><span class="flow-node-name" title="' + flow.destName + '">' + flow.destName + '</span><span class="flow-node-type">' + flow.destLabel + '</span></div> </div> <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:20px; text-align:right;"> <div class="table-card" style="padding: 20px; display:flex; flex-direction:column; gap:12px;"> <div style="font-size:14px; font-weight:800; border-bottom:1px solid #f1f5f9; padding-bottom:8px; color:var(--text-main);">بيانات المعاملة التشغيلية</div> <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px;"> <div><span style="color:var(--text-muted);">رقم المستند:</span> <strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></div> <div><span style="color:var(--text-muted);">نوع المستند:</span> <span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span></div> <div><span style="color:var(--text-muted);">حالة الترحيل:</span> <span class="badge ' + (t.status === 'draft' ? 'badge-warning':'badge-success') + '"><i class="fa-solid ' + (t.status === 'draft' ? 'fa-hourglass-half':'fa-circle-check') + '"></i> ' + (t.status === 'draft'?'مسودة':'مؤكدة') + '</span></div> <div><span style="color:var(--text-muted);">تاريخ الإنشاء:</span> <strong style="font-size:11px;">' + new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG') + '</strong></div> <div><span style="color:var(--text-muted);">المسؤول / منشئ الحركة:</span> <strong style="color:var(--primary); font-weight:800;"><i class="fa-solid fa-user-gear"></i> ' + (t.creatorUsername || 'النظام') + '</strong></div> <div><span style="color:var(--text-muted);">تاريخ الترحيل:</span> <strong style="font-size:11px;">' + (t.confirmedAt ? new Date(t.confirmedAt).toLocaleDateString('ar-EG') : '-') + '</strong></div> </div> <div style="font-size:13px; margin-top:5px; border-top:1px solid #f1f5f9; padding-top:10px;"><span style="color:var(--text-muted);">سبب الحركة / الملاحظات:</span><p style="background:#f8fafc; padding:10px 15px; border-radius:8px; margin-top:5px; font-style:italic; border:1px solid #e2e8f0; font-size:12px;">' + (t.notes || 'لا يوجد ملاحظات') + '</p></div> </div> <div class="table-card" style="padding: 20px; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; text-align:center;"> <div style="font-size:12px; font-weight:700; color:var(--text-muted);">إجراءات المعاملة</div> ' + (t.status === 'draft' ? '<button class="btn" style="width:100%; background:var(--success); font-size:13px;" onclick="confirmTransferLog(' + t.txnId + ')"><i class="fa-solid fa-circle-check"></i> ترحيل وتأكيد الأرصدة</button><p style="font-size:11px; color:var(--text-muted); line-height:1.4;">عند الترحيل، سيتم تعديل الأرصدة التشغيلية للعهدة الفرعية في الشجرة فوراً.</p>' : '<div style="color:var(--success); font-size:44px;"><i class="fa-solid fa-circle-check"></i></div><div style="font-weight:800; color:var(--success); font-size:13px;">تم الترحيل والأثر مسجل</div>') + ' </div> </div> <div class="table-card" style="padding:20px;"> <div style="font-size:14px; font-weight:800; margin-bottom:12px; color:var(--text-main);">أصناف مستند الحركة</div> <div style="overflow-x: auto; border:1px solid var(--card-border); border-radius:12px;"> <table style="width:100%; border-collapse:collapse;"> <thead><tr style="background:#f8fafc;"><th style="padding:10px;">كود الصنف</th><th style="padding:10px;">اسم الصنف</th><th style="padding:10px;">الكمية</th><th style="padding:10px;">سعر التكلفة</th><th style="padding:10px;">الإجمالي</th></tr></thead> <tbody> ' + t.lines.map(l => '<tr><td>' + l.itemCode + '</td><td><strong>' + (l.itemNameAr || 'صنف') + '</strong></td><td><span style="font-weight:700; color:var(--primary);">' + l.quantity.toLocaleString() + '</span></td><td>' + l.unitCost.toLocaleString() + ' ج.م</td><td><strong>' + (l.quantity * l.unitCost).toLocaleString() + ' ج.م</strong></td></tr>').join('') + ' <tr style="background:#f8fafc; font-weight:800; border-top:2px solid var(--card-border);"><td colspan="2" style="text-align:left; padding:12px;">الإجمالي العام:</td><td style="color:var(--primary); padding:12px;">' + totalQty.toLocaleString() + ' وحدة</td><td>-</td><td style="color:#0f172a; padding:12px;">' + totalCost.toLocaleString() + ' ج.م</td></tr> </tbody> </table> </div> </div> ';
    }

    function showNewTransferForm() {
      document.querySelectorAll('.transfer-card').forEach(c => c.classList.remove('active'));
      document.getElementById('tf-left-details').innerHTML = ' <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"> <div><div class="selected-node-path">العمليات / تسجيل قيد جديد</div><div class="selected-node-title" style="font-size:22px;">تسجيل عملية تشغيلية جديدة بالعهدة</div></div> <button class="btn btn-secondary" onclick="renderTransfersEmptyState()"><i class="fa-solid fa-xmark"></i> إلغاء</button> </div> <div class="table-card" style="padding: 24px; text-align:right;"> <form id="inline-transfer-form" style="display:flex; flex-direction:column; gap:16px;"> <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;"> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">نوع المعاملة التشغيلية</label><select id="tf-wizard-type" class="table-select" style="width:100%; padding:10px;" required><option value="consumption">استهلاك تشغيلي (Consumption)</option><option value="internal_transfer">تحويل داخلي (Internal Transfer)</option><option value="waste">هدر خامات ومواد (Waste)</option><option value="damage">تلف سلع (Damage)</option><option value="return">مرتجع مستودع رئيسي (Return)</option><option value="disposal">تكهين واستبعاد أصول (Disposal)</option></select></div> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">مستودع العهدة المصدر</label><select id="tf-source-node" class="table-select" style="width:100%; padding:10px;" required><option value="">اختر المخزن المسؤول...</option></select></div> </div> <div id="wizard-dynamic-fields-container" style="background:#f8fafc; border:1px solid #e2e8f0; padding:15px; border-radius:12px; display:none;"></div> <div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">تفاصيل إضافية / ملاحظات المستند</label><input type="text" id="tf-notes" class="input-control" placeholder="أدخل سبب المعاملة..." required style="padding:10px 15px;"></div> <div style="border-top: 1px solid #f1f5f9; padding-top:16px; margin-top:5px;"> <div style="font-size:14px; font-weight:700; margin-bottom:12px; color:var(--primary); display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-square-plus"></i> إضافة أصناف الحركة</div> <div style="display:grid; grid-template-columns: 1fr 100px 120px 60px; gap:12px; align-items:flex-end;"> <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">البحث واختيار الصنف</label><select id="tf-item-select" class="table-select" style="width:100%; padding:9px;"><option value="">اختر صنف للتحويل...</option></select></div> <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">الكمية</label><input type="number" id="tf-item-qty" class="input-control" placeholder="الكمية" style="padding:9px;" step="any"></div> <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">سعر التكلفة (ج.م)</label><input type="number" id="tf-item-cost" class="input-control" placeholder="التكلفة" style="padding:9px;" step="any"></div> <button type="button" class="btn" style="padding:10px 0; height: 40px; display:flex; align-items:center; justify-content:center;" onclick="addTransferLineItem()"><i class="fa-solid fa-plus"></i></button> </div> <div id="item-type-restriction-warning" style="font-size:11px; color:var(--danger); font-weight:700; margin-top:5px; display:none;"><i class="fa-solid fa-triangle-exclamation"></i> تم تصفية الأصناف طبقاً لنوع الحركة لحماية جودة البيانات.</div> </div> <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:12px; margin-top:5px;"><table style="font-size:13px; width:100%; border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px; border-bottom:1px solid #e2e8f0;">اسم الصنف</th><th style="padding:10px; border-bottom:1px solid #e2e8f0;">الكمية</th><th style="padding:10px; border-bottom:1px solid #e2e8f0;">التكلفة</th><th style="padding:10px; border-bottom:1px solid #e2e8f0; width:60px; text-align:center;">حذف</th></tr></thead><tbody id="transfer-lines-body"><tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لم يتم إضافة أصناف للحركة بعد</td></tr></tbody></table></div> <div style="display:flex; gap:12px; justify-content:flex-end; border-top:1px solid #f1f5f9; padding-top:16px; margin-top:10px;"><button type="submit" class="btn" style="padding:10px 24px;"><i class="fa-solid fa-floppy-disk"></i> حفظ كطلب مسودة</button><button type="button" class="btn btn-secondary" style="padding:10px 20px;" onclick="renderTransfersEmptyState()">إلغاء</button></div> </form> </div> ';
      newTransferLineItems = []; populateModalNodeDropdowns(); setupWizardListeners();

      document.getElementById('inline-transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('tf-wizard-type').value, fromNodeId = document.getElementById('tf-source-node').value, notes = document.getElementById('tf-notes').value;
        if (!fromNodeId) { alert('الرجاء اختيار المستودع المصدر'); return; }
        if (newTransferLineItems.length === 0) { alert('الرجاء إضافة صنف واحد للحركة'); return; }
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
      const sel = document.getElementById('tf-source-node'); if (!sel) return;
      sel.innerHTML = '<option value="">اختر المخزن المسؤول...</option>';
      const rootNodes = [];
      apiFetch('/hierarchy/tree').then(res => {
        if (res.success && res.data) {
          const list = getChildNodesList(res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []));
          list.forEach(c => { sel.innerHTML += '<option value="' + c.id + '">' + c.nodeNameAr + '</option>'; });
        }
      });
    }

    function setupWizardListeners() {
      const typeSel = document.getElementById('tf-wizard-type'), srcSel = document.getElementById('tf-source-node'), container = document.getElementById('wizard-dynamic-fields-container'), itemSel = document.getElementById('tf-item-select'), warningText = document.getElementById('item-type-restriction-warning');
      if (!typeSel || !srcSel) return;
      const update = () => {
        const type = typeSel.value, srcVal = srcSel.value; container.style.display = 'block';
        if (type === 'consumption') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">مركز التكلفة / الجهة المستهلكة</label><input type="text" id="tf-cost-center" class="input-control" placeholder="مثال: بوفيه العشاء..." required style="padding:10px;"></div>';
        } else if (type === 'internal_transfer') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">المستودع المستقبل (الوجهة)</label><select id="tf-dest-node" class="table-select" style="width:100%; padding:10px;" required><option value="">اختر مخزن الوجهة...</option></select></div>';
          const dSel = document.getElementById('tf-dest-node');
          apiFetch('/hierarchy/tree').then(res => {
            if (res.success && res.data) {
              const list = getChildNodesList(res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []));
              list.forEach(c => { if (c.id.toString() !== srcVal) dSel.innerHTML += '<option value="' + c.id + '">' + c.nodeNameAr + '</option>'; });
            }
          });
        } else if (type === 'waste') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">سبب الهدر</label><select id="tf-waste-reason" class="table-select" style="width:100%; padding:10px;" required><option value="expired">انتهاء الصلاحية</option><option value="cooler_failure">عطل في التبريد</option><option value="other">أخرى...</option></select></div>';
        } else if (type === 'damage') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">سبب التلف</label><input type="text" id="tf-damage-reason" class="input-control" placeholder="سبب التلف..." required style="padding:10px;"></div>';
        } else if (type === 'return') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">المستودع الرئيسي المستقبل</label><input type="text" class="input-control" value="المخزن الرئيسي للأغذية والمشروبات 001" readonly style="padding:10px; background:#e2e8f0; font-weight:700;"></div>';
        } else if (type === 'disposal') {
          container.innerHTML = '<div class="form-group" style="margin-bottom:0;"><label style="font-weight:700;">رقم تقرير التخريد واللجنة</label><input type="text" id="tf-disposal-ref" class="input-control" placeholder="تقرير لجنة التكهين رقم..." required style="padding:10px;"></div>';
        } else { container.style.display = 'none'; }

        let filtered = localItemsList, restricted = false;
        if (type === 'consumption' || type === 'waste') { filtered = localItemsList.filter(i => i.itemType === 'consumable'); restricted = true; }
        else if (type === 'return') { filtered = localItemsList.filter(i => i.itemType === 'returnable' || i.itemType === 'durable'); restricted = true; }
        else if (type === 'disposal') { filtered = localItemsList.filter(i => i.itemType === 'durable'); restricted = true; }
        warningText.style.display = restricted ? 'block':'none';
        itemSel.innerHTML = '<option value="">اختر صنف للعملية...</option>';
        filtered.forEach(i => { itemSel.innerHTML += '<option value="' + i.itemCode + '">' + i.itemCode + ' - ' + i.itemNameAr + '</option>'; });
        newTransferLineItems = []; renderTransferLineItemsTable();
      };
      typeSel.addEventListener('change', update); srcSel.addEventListener('change', update);
    }

    function renderTransferLineItemsTable() {
      const tbody = document.getElementById('transfer-lines-body'); if (!tbody) return; tbody.innerHTML = '';
      if (newTransferLineItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">لم يتم إضافة أصناف للحركة بعد</td></tr>'; return;
      }
      newTransferLineItems.forEach((l, idx) => {
        tbody.innerHTML += '<tr> <td style="padding:10px; border-bottom:1px solid #e2e8f0;"><strong>' + l.itemNameAr + '</strong></td> <td style="padding:10px; border-bottom:1px solid #e2e8f0;"><span style="font-weight:700; color:var(--primary);">' + l.quantity + '</span> ' + l.unitNameAr + '</td> <td style="padding:10px; border-bottom:1px solid #e2e8f0;">' + l.unitCost + ' ج.م</td> <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;"><button type="button" class="btn btn-secondary" style="padding:5px 10px; color:var(--danger); border-color:var(--danger);" onclick="removeTransferLineItem(' + idx + ')"><i class="fa-solid fa-trash-can"></i></button></td> </tr>';
      });
    }

    function addTransferLineItem() {
      const itemSel = document.getElementById('tf-item-select'), qtyIn = document.getElementById('tf-item-qty'), costIn = document.getElementById('tf-item-cost');
      if (!itemSel || !qtyIn || !costIn) return;
      const code = itemSel.value, qty = parseFloat(qtyIn.value), cost = parseFloat(costIn.value);
      if (!code || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) { alert('الرجاء إدخال بيانات صحيحة'); return; }
      const item = localItemsList.find(i => i.itemCode === code); if (!item) return;
      const existing = newTransferLineItems.find(l => l.itemCode === code);
      if (existing) existing.quantity += qty;
      else newTransferLineItems.push({ itemCode: code, itemNameAr: item.itemNameAr, quantity: qty, unitCost: cost, unitNameAr: item.unitNameAr || 'حبة' });
      itemSel.value = ''; qtyIn.value = ''; costIn.value = ''; renderTransferLineItemsTable();
    }

    function removeTransferLineItem(idx) { newTransferLineItems.splice(idx, 1); renderTransferLineItemsTable(); }
    function toggleTransferModal(show) { const m = document.getElementById('create-transfer-modal'); if (m) m.style.display = show ? 'flex':'none'; }
    function toggleDetailsModal(show) { const m = document.getElementById('transfer-details-modal'); if (m) m.style.display = show ? 'flex':'none'; }

    async function renderDashboard() {
      try {
        const txRes = await apiFetch('/transactions/transfers');
        const itemsRes = await apiFetch('/master-data/items');
        const treeRes = await apiFetch('/hierarchy/tree');
        
        let txns = txRes.success ? txRes.data : [];
        let items = itemsRes.success ? itemsRes.data : [];
        
        let totalVal = 0;
        let totalTx = txns.length;
        let monthlyCons = 0;

        const childNodes = [];
        if (treeRes.success) {
          const rootNodes = treeRes.data.nodes || (Array.isArray(treeRes.data) ? treeRes.data.flatMap(g => g.nodes) : []);
          getChildNodesList(rootNodes, childNodes);
        }

        let categoriesStock = {};
        let totalQty = 0;

        for (const node of childNodes) {
          const stkRes = await apiFetch('/hierarchy/nodes/' + node.id + '/stock');
          if (stkRes.success && stkRes.data.items) {
            stkRes.data.items.forEach(itm => {
              const cost = itm.unitCost || 0;
              const qty = itm.qtyOperational || 0;
              totalVal += qty * cost;
              totalQty += qty;
              
              const cat = itm.categoryCode || 'أخرى';
              categoriesStock[cat] = (categoriesStock[cat] || 0) + qty;
            });
          }
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
        const trans = { consumption:'استهلاك تشغيلي', internal_transfer:'تحويل داخلي', waste:'هدر مواد', damage:'تلف سلع', return:'مرتجع للمخزن', disposal:'تكهين واستبعاد' };
        
        txns.slice(0, 5).forEach(t => {
          const dateStr = new Date(t.createdAt || t.txnDate).toLocaleDateString('ar-EG');
          let typeBadge = '<span class="badge badge-type-' + t.txnType + '">' + trans[t.txnType] + '</span>';
          let statusBadge = '<span class="badge ' + (t.status === 'draft' ? 'badge-warning' : 'badge-success') + '">' + (t.status === 'draft' ? 'مسودة' : 'مؤكدة') + '</span>';
          body.innerHTML += '<tr style="cursor:pointer;" onclick="goToTransactionDetails(' + t.txnId + ')"> ' +
            '<td><strong>OP-2026-' + String(t.txnId).padStart(3, "0") + '</strong></td>' +
            '<td>' + typeBadge + '</td>' +
            '<td>' + (t.fromNodeNameAr || t.nodeNameAr || 'مستودع فرعي') + '</td>' +
            '<td style="font-size:11px;">' + dateStr + '</td>' +
            '<td>' + statusBadge + '</td> ' +
            '</tr>';
        });

        const dist = document.getElementById('db-distribution-container'); dist.innerHTML = '';
        const colors = ['#0066ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7']; let colorIdx = 0;
        
        for (const c in categoriesStock) {
          const qty = categoriesStock[c];
          const pct = Math.round((qty / (totalQty || 1)) * 100);
          const col = colors[colorIdx++ % colors.length];
          dist.innerHTML += '<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px;"><span style="font-weight:700;">' + c + '</span><span style="font-weight:800; color:' + col + ';">' + qty.toLocaleString() + ' وحدة (' + pct + '%)</span></div> <div class="progress-bar" style="height:6px;"><div class="progress-fill" style="width:' + pct + '%; background-color:' + col + ';"></div></div>';
        }
      } catch (err) {
        console.error('Error rendering dashboard', err);
      }
    }

    function initSearchView() {
      const sel = document.getElementById('search-view-warehouse'); sel.innerHTML = '<option value="all">كل المستودعات الفرعية</option>';
      apiFetch('/hierarchy/tree').then(res => {
        if (res.success) {
          const list = getChildNodesList(res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []));
          list.forEach(c => { sel.innerHTML += '<option value="' + c.id + '">' + c.nodeNameAr + '</option>'; });
        }
      });
      document.getElementById('search-view-input').value = ''; sel.value = 'all'; document.getElementById('search-view-type').value = 'all';
      renderSearchResults();
      document.getElementById('search-view-input').oninput = renderSearchResults; sel.onchange = renderSearchResults; document.getElementById('search-view-type').onchange = renderSearchResults;
    }

    async function renderSearchResults() {
      const tbody = document.getElementById('search-view-results-body'); 
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</td></tr>';
      const q = document.getElementById('search-view-input').value.toLowerCase().trim(), wh = document.getElementById('search-view-warehouse').value, ty = document.getElementById('search-view-type').value;

      try {
        const treeRes = await apiFetch('/hierarchy/tree');
        if (!treeRes.success) return;
        const rootNodes = treeRes.data.nodes || (Array.isArray(treeRes.data) ? treeRes.data.flatMap(g => g.nodes) : []);
        const children = [];
        getChildNodesList(rootNodes, children);

        const res = [];
        for (const w of children) {
          if (wh !== 'all' && w.id.toString() !== wh) continue;
          const stkRes = await apiFetch('/hierarchy/nodes/' + w.id + '/stock');
          if (stkRes.success && stkRes.data.items) {
            stkRes.data.items.forEach(item => {
              if (item.qtyOperational <= 0) return;
              if (q && !item.itemCode.toLowerCase().includes(q) && !item.itemNameAr.toLowerCase().includes(q)) return;
              if (ty !== 'all' && item.itemType !== ty) return;
              res.push({ code: item.itemCode, name: item.itemNameAr, whName: w.nodeNameAr, qty: item.qtyOperational, unit: item.unitNameAr || 'حبة', type: item.itemType, cost: item.unitCost });
            });
          }
        }

        tbody.innerHTML = '';
        if (res.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>لا توجد نتائج بحث.</p></div></td></tr>'; return;
        }
        const trans = { consumable:'استهلاكي', returnable:'مستعار', durable:'أصل مستديم' }, badges = { consumable:'badge-type-consumption', returnable:'badge-type-return', durable:'badge-type-disposal' };
        res.forEach(r => {
          tbody.innerHTML += '<tr> <td>' + r.code + '</td><td style="font-weight:700;">' + r.name + '</td><td>' + r.whName + '</td><td><span style="font-weight:700; color:var(--primary);">' + r.qty.toLocaleString() + '</span></td><td>' + r.unit + '</td><td><span class="badge ' + badges[r.type] + '">' + trans[r.type] + '</span></td><td>' + (r.cost ? r.cost.toLocaleString() + ' ج.م' : '0 ج.م') + '</td> </tr>';
        });
      } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger);">حدث خطأ أثناء تحميل نتائج البحث.</td></tr>';
      }
    }

    async function renderLowStockView() {
      const tbody = document.getElementById('low-stock-body'); 
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري جلب النواقص...</td></tr>';
      
      try {
        const treeRes = await apiFetch('/hierarchy/tree');
        if (!treeRes.success) return;
        const rootNodes = treeRes.data.nodes || (Array.isArray(treeRes.data) ? treeRes.data.flatMap(g => g.nodes) : []);
        const children = [];
        getChildNodesList(rootNodes, children);

        const res = [];
        const limit = 50; let low = 0, total = 0;

        for (const w of children) {
          const stkRes = await apiFetch('/hierarchy/nodes/' + w.id + '/stock');
          if (stkRes.success && stkRes.data.items) {
            stkRes.data.items.forEach(i => {
              const qty = i.qtyOperational || 0;
              total++;
              if (qty < limit) { res.push({ code: i.itemCode, name: i.itemNameAr, whName: w.nodeNameAr, qty, limit }); low++; }
            });
          }
        }

        document.getElementById('low-stock-count').innerText = low; 
        document.getElementById('low-stock-percent').innerText = (total ? Math.round(low/total*100) : 0) + '%';
        
        tbody.innerHTML = '';
        if (res.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="color:var(--success);"><i class="fa-solid fa-circle-check" style="font-size:32px;"></i><p>كل المستودعات آمنة!</p></div></td></tr>'; return;
        }
        res.sort((a,b) => a.qty - b.qty).forEach(r => {
          tbody.innerHTML += '<tr> <td>' + r.code + '</td><td style="font-weight:700;">' + r.name + '</td><td>' + r.whName + '</td><td><span style="font-weight:800; color:' + (r.qty===0?'var(--danger)':'var(--warning)') + ';">' + r.qty.toLocaleString() + '</span></td><td>' + r.limit + '</td><td><span class="badge ' + (r.qty===0?'badge-danger':'badge-warning') + '">' + (r.qty===0?'نفاد تام':'منخفض') + '</span></td> </tr>';
        });
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

      document.getElementById('explorer-view').style.display = 'none';
      document.getElementById('transfers-view').style.display = 'none';
      document.getElementById('dashboard-view').style.display = 'none';
      document.getElementById('search-view').style.display = 'none';
      document.getElementById('low-view').style.display = 'none';

      if (viewName === 'explorer') {
        document.getElementById('menu-explorer').classList.add('active');
        document.getElementById('explorer-view').style.display = 'grid';
        loadTree();
      } else if (viewName === 'transfers') {
        document.getElementById('menu-transfers').classList.add('active');
        document.getElementById('transfers-view').style.display = 'grid';
        loadTransfers();
        loadLocalItems();
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
      }
    }

    function switchExplorerTab(tabName) {
      explorerActiveTab = tabName;
      document.getElementById('tab-btn-stock').classList.remove('active');
      document.getElementById('tab-btn-movement').classList.remove('active');
      document.getElementById('tab-btn-transactions').classList.remove('active');
      
      document.getElementById('explorer-stock-tab-content').style.display = 'none';
      document.getElementById('explorer-movement-tab-content').style.display = 'none';
      document.getElementById('explorer-transactions-tab-content').style.display = 'none';
      
      if (tabName === 'stock') {
        document.getElementById('tab-btn-stock').classList.add('active');
        document.getElementById('explorer-stock-tab-content').style.display = 'block';
        renderExplorerItemsTable();
      } else if (tabName === 'movement') {
        document.getElementById('tab-btn-movement').classList.add('active');
        document.getElementById('explorer-movement-tab-content').style.display = 'block';
        if (currentStockData && currentStockData.nodeType === 'parent') {
          renderParentStockDistribution();
        } else {
          renderMovementSummaryReport();
        }
      } else if (tabName === 'transactions') {
        document.getElementById('tab-btn-transactions').classList.add('active');
        document.getElementById('explorer-transactions-tab-content').style.display = 'block';
        if (selectedNodeId) renderNodeTransactions(selectedNodeId);
      }
    }

    window.addEventListener('DOMContentLoaded', async () => {
      // Prompt for real credentials initially
      document.getElementById('login-overlay').style.display = 'flex';
    });
