'use strict';

/**
 * Laundry Management Module Frontend — JavaScript Controller & Service bindings
 */

let laundryActiveTab = 'overview';
let laundryCachedMachines = [];
let laundryCachedRecipes = [];

// Entry point called when switching sidebar to "laundry"
async function renderLaundryView() {
  await loadLaundryMetadata();
  switchLaundryTab(laundryActiveTab);
}

// Switches sub-tabs inside Laundry view
function switchLaundryTab(tabName) {
  laundryActiveTab = tabName;
  document.querySelectorAll('.laundry-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.laundry-tab-content').forEach(content => content.style.display = 'none');

  const activeBtn = document.getElementById(`l-tab-btn-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  const activeContent = document.getElementById(`laundry-tab-${tabName}`);
  if (activeContent) activeContent.style.display = 'block';

  // Load relevant tab content
  if (tabName === 'overview') {
    renderLaundryOverview();
  } else if (tabName === 'transfers') {
    renderLaundryTransfers();
  } else if (tabName === 'batches') {
    renderLaundryBatches();
  } else if (tabName === 'returns') {
    renderLaundryReturns();
  } else if (tabName === 'tickets') {
    renderLaundryTickets();
  } else if (tabName === 'reconciliation') {
    renderLaundryReconciliation();
  } else if (tabName === 'stock') {
    renderLaundryStock();
  } else if (tabName === 'configurations') {
    renderLaundryConfigurations();
  }
}

// Fetch shared metadata: washing machines & recipe configurations
async function loadLaundryMetadata() {
  try {
    const machinesRes = await apiFetch('/laundry/machines');
    if (machinesRes.success) {
      laundryCachedMachines = machinesRes.data;
    }
    const recipesRes = await apiFetch('/laundry/recipes');
    if (recipesRes.success) {
      laundryCachedRecipes = recipesRes.data;
    }
  } catch (err) {
    console.error('Failed to load laundry metadata:', err);
  }
}

// ─── 1. OVERVIEW & PROFITABILITY TAB ──────────────────────────────────────────

async function renderLaundryOverview() {
  const container = document.getElementById('laundry-overview-panel');
  container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>جاري تحميل المؤشرات والتحليلات...</p></div>';

  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch profitability and last sync status in parallel
    const [profitRes, syncRes] = await Promise.all([
      apiFetch(`/laundry/reports/profitability?fromDate=${today}&toDate=${today}`),
      apiFetch('/laundry/pos-sync/status')
    ]);

    let profitData = { revenue: 0, washingRevenue: 0, ironingRevenue: 0, chemicalCost: 0, utilitiesCost: 0, laborCost: 0, lossCost: 0, netProfit: 0 };
    if (profitRes.success && profitRes.data && profitRes.data.length > 0) {
      const day = profitRes.data[0];
      profitData = {
        revenue: parseFloat(day.revenue),
        washingRevenue: parseFloat(day.washingRevenue || 0),
        ironingRevenue: parseFloat(day.ironingRevenue || 0),
        chemicalCost: parseFloat(day.chemicalCost),
        utilitiesCost: parseFloat(day.utilitiesCost),
        laborCost: parseFloat(day.laborCost),
        lossCost: parseFloat(day.lossCost),
        netProfit: parseFloat(day.revenue - (day.chemicalCost + day.utilitiesCost + day.laborCost + day.lossCost)),
      };
    }

    let syncHtml = '';
    if (syncRes.success && syncRes.data) {
      const sync = syncRes.data;
      const isMock = sync.isMock;
      const dateFormatted = new Date(sync.syncedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(sync.syncedAt).toLocaleDateString('ar-EG');

      syncHtml = `
        <div style="margin-top: 15px; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:var(--text-main);">حالة الاتصال والبيانات:</strong>
            ${isMock ? `
              <span class="badge" style="background:#fff7ed; color:#c2410c; border:1px solid #ffedd5; font-size:10px; font-weight:800; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-triangle-exclamation"></i> وضع المحاكاة الاحتياطي (Mock)
              </span>
            ` : `
              <span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #dcfce7; font-size:10px; font-weight:800; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-circle-check"></i> متصل بـ FhtlPall (بيانات حقيقية)
              </span>
            `}
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; color:var(--text-muted);">
            <div>آخر تحديث: <strong>${dateFormatted}</strong></div>
            <div>الحركات المستوردة: <strong>${sync.ordersImported} حركات</strong></div>
          </div>
          ${sync.errorMessage ? `
            <div style="margin-top:6px; font-size:10px; color:#9a3412;">
              ملاحظة النظام: ${sync.errorMessage}
            </div>
          ` : ''}
        </div>
      `;
    } else {
      syncHtml = `
        <div style="margin-top: 15px; padding: 10px; text-align:center; border-radius: 8px; background: #f8fafc; border: 1px dashed #e2e8f0; font-size: 11px; color:var(--text-muted);">
          لم يتم إجراء أي عمليات مزامنة مع POS اليوم حتى الآن.
        </div>
      `;
    }

    let machinesHtml = '';
    laundryCachedMachines.forEach(m => {
      machinesHtml += `
        <div class="machine-status-card" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:42px; height:42px; border-radius:10px; background:#f0fdf4; color:#10b981; display:flex; align-items:center; justify-content:center; font-size:20px;">
              <i class="fa-solid fa-circle-notch"></i>
            </div>
            <div>
              <h4 style="font-size:13px; font-weight:800; color:var(--text-main);">${m.name}</h4>
              <span style="font-size:11px; color:var(--text-muted);">السعة الكلية: ${m.capacity} كجم</span>
            </div>
          </div>
          <span class="badge ${m.isActive ? 'badge-type-consumption' : 'badge-type-waste'}" style="font-size:11px;">
            ${m.isActive ? 'جاهزة للتشغيل' : 'صيانة'}
          </span>
        </div>
      `;
    });

    if (laundryCachedMachines.length === 0) {
      machinesHtml = '<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">لا يوجد غسالات مدخلة بالبرنامج حالياً</p>';
    }

    container.innerHTML = `
      <!-- Financial Summary Cards -->
      <div style="display:grid; grid-template-columns: 1fr; max-width:350px; gap:15px; margin-bottom:20px;">
        <div class="stat-card" style="border-right: 4px solid #10b981;">
          <h3>إيرادات المغسلة (اليوم)</h3>
          <div class="value" style="color:#10b981; font-size:22px;">${profitData.revenue.toLocaleString()} ج.م</div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:5px; border-top:1px solid #f1f5f9; padding-top:4px;">
            <span>غسيل وتعقيم: <strong>${profitData.washingRevenue.toLocaleString()} ج.م</strong></span>
            <span>كي ومكواة: <strong>${profitData.ironingRevenue.toLocaleString()} ج.م</strong></span>
          </div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px;">
        <!-- Left: Quick Actions -->
        <div class="table-card" style="padding:20px; display:flex; flex-direction:column; gap:15px;">
          <h3 style="font-size:15px; font-weight:800; color:var(--text-main); border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
            <i class="fa-solid fa-bolt" style="color:#f59e0b;"></i> عمليات المزامنة والتجهيز
          </h3>
          <p style="font-size:12px; color:var(--text-muted); line-height:1.6; margin:0;">
            يمكنك إجراء مزامنة يدوية مع نظام كومسيس POS (سحب قاعدة بيانات <strong>FhtlPall</strong> فقط) لاستيراد وتحديث حركات غسيل وكي النزلاء وربطها بالوصفات الكيميائية لحساب الربحية.
          </p>
          <div style="display:flex; gap:10px; margin-top:5px;">
            <button class="btn" onclick="triggerComsysPOSSync()" style="background:linear-gradient(135deg, #2563eb, #3b82f6); font-size:13px; padding:12px 20px;">
              <i class="fa-solid fa-rotate"></i> تشغيل مزامنة مبيعات POS كومسيس
            </button>
            <button class="btn btn-secondary" onclick="openNewMachineModal()" style="font-size:13px; padding:12px 16px;">
              <i class="fa-solid fa-plus"></i> إضافة غسالة جديدة
            </button>
          </div>
          ${syncHtml}
        </div>

        <!-- Right: Machines Status -->
        <div class="table-card" style="padding:20px; display:flex; flex-direction:column; gap:12px;">
          <h3 style="font-size:14px; font-weight:800; color:var(--text-main); border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
            <i class="fa-solid fa-tv" style="color:var(--primary);"></i> حالة غسالات المغسلة
          </h3>
          <div style="display:flex; flex-direction:column; gap:10px; max-height:220px; overflow-y:auto; padding:2px;">
            ${machinesHtml}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-xmark" style="color:#ef4444;"></i><p>فشل تحميل تقارير الربحية: ${err.message}</p></div>`;
  }
}

async function triggerComsysPOSSync() {
  try {
    notify('جاري المزامنة واستيراد المبيعات من كومسيس...');
    const res = await apiFetch('/laundry/pos-sync', 'POST', {});
    if (res.success) {
      const modeText = res.data.isMock ? ' (محاكاة احتياطية)' : ' (قاعدة البيانات)';
      notify(`تمت المزامنة بنجاح${modeText}! تم استيراد ${res.data.ordersImported} حركات مبيعات وإضافة ${res.data.revenueAdded} ج.م للإيرادات اليومية`, 'success');
      renderLaundryOverview();
    }
  } catch (err) {
    notify('فشل تشغيل المزامنة: ' + err.message, 'error');
  }
}

// ─── 2. TRANSFERS & LOGISTICS TAB ─────────────────────────────────────────────

async function renderLaundryTransfers() {
  const container = document.getElementById('laundry-transfers-table-body');
  container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">جاري تحميل تحويلات المغسلة...</td></tr>';

  try {
    const res = await apiFetch('/laundry/transfers');
    if (res.success && res.data) {
      container.innerHTML = '';
      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">لا يوجد طلبات تحويل مسجلة حالياً</td></tr>';
        return;
      }

      res.data.reverse().forEach(t => {
        let badgeClass = 'badge-type-internal_transfer';
        let statusName = t.status;

        // Detailed lifecycle status parsing
        if (t.status === 'received' || t.status === 'partially_received') {
          if (t.returnStatus === 'completed') {
            badgeClass = 'badge-type-consumption'; // Green
            statusName = 'تمت الدورة وأُرجعت للمخزن (مكتمل)';
          } else if (t.returnStatus === 'rejected') {
            badgeClass = 'badge-type-waste'; // Red
            statusName = 'تم رفض المرتجع بالخلفية';
          } else if (t.returnStatus) {
            badgeClass = 'badge-type-distribution'; // Yellow
            statusName = `مستلمة (المرتجع: ${t.returnStatus === 'draft' ? 'مسودة' : 'قيد التحويل'})`;
          } else {
            badgeClass = 'badge-type-consumption';
            statusName = 'تم الاستلام بالمغسلة (قيد الغسيل)';
          }
        } else if (t.status === 'draft') {
          badgeClass = 'badge-type-internal_transfer'; statusName = 'مسودة شحن';
        } else if (t.status === 'sent') {
          badgeClass = 'badge-type-inbound'; statusName = 'تم الشحن للمغسلة';
        } else if (t.status === 'rejected') {
          badgeClass = 'badge-type-waste'; statusName = 'تم الرفض والإرجاع';
        }

        let actionBtn = '';
        if (t.status === 'draft') {
          actionBtn = `<button class="btn btn-secondary" onclick="sendTransferToLaundry(${t.id})" style="padding:4px 8px; font-size:11px; background:#e0f2fe; color:#0369a1; border:none;"><i class="fa-solid fa-paper-plane"></i> شحن للمغسلة</button>`;
        } else if (t.status === 'sent') {
          actionBtn = `<button class="btn" onclick="openReceiveLinenModal(${t.id})" style="padding:4px 8px; font-size:11px; background:#dcfce7; color:#15803d; border:none;"><i class="fa-solid fa-circle-check"></i> استلام وفحص</button>`;
        } else {
          actionBtn = `<span style="font-size:11px; color:var(--text-muted);">مكتمل</span>`;
        }

        // Parse Service Type from notes
        let notesText = t.notes || '-';
        let serviceBadge = '';
        if (notesText.includes('[نوع الخدمة: كي ومكواة]')) {
          serviceBadge = `<span class="badge" style="background:#fef3c7; color:#d97706; border-color:#fcd34d; font-size:10px; margin-left:5px; padding:3px 6px;">كي ومكواة</span>`;
          notesText = notesText.replace('[نوع الخدمة: كي ومكواة] - ', '');
        } else if (notesText.includes('[نوع الخدمة: غسيل وتعقيم]')) {
          serviceBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd; font-size:10px; margin-left:5px; padding:3px 6px;">غسيل وتعقيم</span>`;
          notesText = notesText.replace('[نوع الخدمة: غسيل وتعقيم] - ', '');
        }

        const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleString('ar-EG') : '-';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="font-weight:700; color:var(--primary);">TR-LND-${t.id}</td>
          <td>${t.fromWarehouseName || 'المستودع الرئيسي'}</td>
          <td>${serviceBadge}<span class="badge ${badgeClass}">${statusName}</span></td>
          <td>${notesText}</td>
          <td>${dateStr}</td>
          <td>${actionBtn}</td>
        `;
        container.appendChild(row);
      });
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">فشل تحميل التحويلات: ${err.message}</td></tr>`;
  }
}

async function sendTransferToLaundry(id) {
  try {
    notify('جاري إرسال شحنة البياضات للمغسلة...');
    const res = await apiFetch(`/laundry/transfers/${id}/send`, 'POST', {});
    if (res.success) {
      notify('تم شحن بياضات المستودع للمغسلة بنجاح!', 'success');
      renderLaundryTransfers();
    }
  } catch (err) {
    notify('فشل إرسال الشحنة: ' + err.message, 'error');
  }
}

// Opens modal to draft new transfer to laundry
function openNewTransferModal() {
  document.getElementById('l-new-tf-form').reset();
  const selectNode = document.getElementById('l-new-tf-source');
  selectNode.innerHTML = '<option value="">جاري تحميل مستودعات المصدر...</option>';

  apiFetch('/hierarchy/tree').then(res => {
    if (res.success && res.data) {
      selectNode.innerHTML = '<option value="">اختر مستودع المصدر...</option>';
      const rootNodes = res.data.nodes || (Array.isArray(res.data) ? res.data.flatMap(g => g.nodes) : []);
      const childNodes = [];
      getChildNodesList(rootNodes, childNodes);
      const allowedNodes = childNodes.filter(n => n.nodeType === 'child' && n.hasLaundryAccess === true);
      if (allowedNodes.length === 0) {
        selectNode.innerHTML = '<option value="">لا توجد مستودعات تملك صلاحية التعامل مع المغسلة</option>';
      } else {
        allowedNodes.forEach(n => {
          const opt = document.createElement('option'); opt.value = n.id; opt.innerText = n.nodeNameAr; selectNode.appendChild(opt);
        });
      }
    } else {
      selectNode.innerHTML = '<option value="">لا توجد مستودعات متاحة</option>';
    }
  }).catch(err => {
    console.error('Failed to load warehouses for laundry transfer:', err);
    selectNode.innerHTML = '<option value="1">المستودع الرئيسي (جاردن)</option>';
  });

  // Populate items from localItemsList in app.js (filtering for laundry/linen items)
  const selectItem = document.getElementById('l-new-tf-item-select');
  selectItem.innerHTML = '<option value="">اختر الصنف المراد إرساله...</option>';
  if (localItemsList && localItemsList.length > 0) {
    const linenKeywords = ['فوط', 'ملاي', 'ملاء', 'بشكير', 'مخد', 'كيس', 'يونيفورم', 'قميص', 'بنطلون', 'طقم', 'جاكيت', 'بطانية', 'لحاف', 'مفرش', 'ستارة', 'ستائر', 'توب', 'غسيل', 'كوفرتة', 'وبريات', 'بياضات', 'ملابس'];
    localItemsList.forEach(itm => {
      const nameAr = itm.itemNameAr || '';
      const nameEn = itm.itemNameEn || '';
      const matchesLinen = itm.itemCode.startsWith('L-') ||
        linenKeywords.some(kw => nameAr.includes(kw) || nameEn.toLowerCase().includes(kw.toLowerCase()));
      if (matchesLinen) {
        const opt = document.createElement('option');
        opt.value = itm.itemCode;
        opt.setAttribute('data-name', nameAr);
        opt.innerText = itm.itemCode + ' - ' + nameAr;
        selectItem.appendChild(opt);
      }
    });
  }

  document.getElementById('l-new-tf-lines-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة أصناف للشحنة بعد</td></tr>';
  laundryNewTransferLines = [];

  document.getElementById('laundry-transfer-modal').style.display = 'flex';
}

let laundryNewTransferLines = [];

function addLinenTransferLine() {
  const selectItem = document.getElementById('l-new-tf-item-select');
  const qtyInput = document.getElementById('l-new-tf-item-qty');

  if (!selectItem.value || !qtyInput.value || parseFloat(qtyInput.value) <= 0) {
    notify('يرجى تحديد الصنف وإدخال كمية صحيحة أكبر من الصفر', 'error');
    return;
  }

  const selectedOpt = selectItem.options[selectItem.selectedIndex];
  const itemCode = selectItem.value;
  const itemNameAr = selectedOpt.getAttribute('data-name');
  const qty = parseFloat(qtyInput.value);

  // Check duplicate
  const exists = laundryNewTransferLines.find(l => l.itemCode === itemCode);
  if (exists) {
    exists.sentQty += qty;
  } else {
    laundryNewTransferLines.push({
      itemCode,
      itemNameAr,
      sentQty: qty,
      unitCode: 'PCS',
      unitCost: 100, // placeholder unit replacement cost
    });
  }

  renderNewTransferLinesTable();
  qtyInput.value = '';
}

function removeLinenTransferLine(index) {
  laundryNewTransferLines.splice(index, 1);
  renderNewTransferLinesTable();
}

function renderNewTransferLinesTable() {
  const container = document.getElementById('l-new-tf-lines-body');
  container.innerHTML = '';
  if (laundryNewTransferLines.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة أصناف للشحنة بعد</td></tr>';
    return;
  }

  laundryNewTransferLines.forEach((l, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.itemNameAr} (${l.itemCode})</td>
      <td>${l.sentQty}</td>
      <td>${l.unitCost} ج.م</td>
      <td><button type="button" class="btn btn-secondary" onclick="removeLinenTransferLine(${index})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    container.appendChild(row);
  });
}

async function submitLaundryTransfer(e) {
  e.preventDefault();
  const sourceNodeId = document.getElementById('l-new-tf-source').value;
  const notes = document.getElementById('l-new-tf-notes').value;
  const serviceType = document.getElementById('l-new-tf-service-type')?.value || 'washing';
  const serviceText = serviceType === 'ironing' ? 'كي ومكواة' : 'غسيل وتعقيم';
  const notesText = `[نوع الخدمة: ${serviceText}] - ${notes}`;

  if (!sourceNodeId) {
    notify('يرجى تحديد مستودع المصدر', 'error');
    return;
  }
  if (laundryNewTransferLines.length === 0) {
    notify('يرجى إضافة صنف واحد على الأقل للشحنة', 'error');
    return;
  }

  try {
    notify('جاري إنشاء مسودة طلب الشحن...');
    const res = await apiFetch('/laundry/transfers', 'POST', {
      fromWarehouseId: parseInt(sourceNodeId),
      notes: notesText,
      items: laundryNewTransferLines,
    });

    if (res.success) {
      notify('تم إنشاء مسودة حركة تحويل المغسلة بنجاح!', 'success');
      document.getElementById('laundry-transfer-modal').style.display = 'none';
      renderLaundryTransfers();
    }
  } catch (err) {
    notify('فشل إنشاء مستند التحويل: ' + err.message, 'error');
  }
}

// Receive Linen Modal logic
let laundryReceivingItemsList = [];
let currentReceivingTransferId = null;

async function openReceiveLinenModal(transferId) {
  currentReceivingTransferId = transferId;
  notify('جاري جلب تفاصيل شحنة المغسلة للتحقق...');
  try {
    const res = await apiFetch(`/laundry/transfers/${transferId}`);
    if (res.success && res.data) {
      const container = document.getElementById('l-receive-items-body');
      container.innerHTML = '';
      laundryReceivingItemsList = res.data.items;

      res.data.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.itemNameAr} (${item.itemCode})</td>
          <td style="font-weight:700;">${item.sentQty}</td>
          <td><input type="number" id="recv-actual-${index}" class="input-control" value="${item.sentQty}" min="0" max="${item.sentQty}" style="padding:6px; font-size:12px; width:80px; text-align:center;"></td>
          <td>
            <select id="recv-reject-reason-${index}" class="table-select" style="padding:6px; font-size:12px;">
              <option value="">بدون تلف</option>
              <option value="Damaged">تالف / ممزق</option>
              <option value="Wet">رطب / مبلل</option>
              <option value="Wrong Item">صنف غير مطابق</option>
            </select>
          </td>
          <td><input type="text" id="recv-reject-notes-${index}" class="input-control" placeholder="ملاحظات الهدر..." style="padding:6px; font-size:11px;"></td>
        `;
        container.appendChild(row);
      });

      document.getElementById('laundry-receiving-modal').style.display = 'flex';
    }
  } catch (err) {
    notify('فشل جلب تفاصيل الشحنة: ' + err.message, 'error');
  }
}

async function submitLaundryReceiving(e) {
  e.preventDefault();
  const notes = document.getElementById('l-receive-notes').value;

  const itemsPayload = [];
  let hasValidationError = false;

  laundryReceivingItemsList.forEach((itm, index) => {
    const actualVal = document.getElementById(`recv-actual-${index}`).value;
    const actualQty = parseFloat(actualVal);
    const rejectReason = document.getElementById(`recv-reject-reason-${index}`).value;
    const rejectNotes = document.getElementById(`recv-reject-notes-${index}`).value;

    if (isNaN(actualQty) || actualQty < 0 || actualQty > itm.sentQty) {
      notify(`الكمية المستلمة للصنف ${itm.itemNameAr} غير صالحة. يجب أن تكون بين 0 و ${itm.sentQty}`, 'error');
      hasValidationError = true;
      return;
    }

    itemsPayload.push({
      itemCode: itm.itemCode,
      actualQty,
      rejectReason: rejectReason || null,
      rejectNotes: rejectNotes || null,
    });
  });

  if (hasValidationError) return;

  try {
    notify('جاري تسجيل استلام شحنة بياضات المغسلة...');
    const res = await apiFetch('/laundry/transfers/receive', 'POST', {
      transferId: currentReceivingTransferId,
      notes,
      items: itemsPayload,
    });

    if (res.success) {
      notify('تم فحص واستلام الشحنة وتحديث الأرصدة التشغيلية بنجاح!', 'success');
      document.getElementById('laundry-receiving-modal').style.display = 'none';
      renderLaundryTransfers();
    }
  } catch (err) {
    notify('فشل تسجيل الشحنة: ' + err.message, 'error');
  }
}

// ─── 3. BATCH PROCESSING & RECIPES TAB ────────────────────────────────────────

let laundryCachedBatches = [];

async function renderLaundryBatches() {
  const container = document.getElementById('laundry-batches-table-body');
  container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">جاري تحميل دورات تشغيل المغسلة...</td></tr>';

  try {
    const res = await apiFetch('/laundry/batches');
    if (res.success && res.data) {
      laundryCachedBatches = res.data;
      filterLaundryBatches();
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">فشل تحميل دورات التشغيل: ${err.message}</td></tr>`;
  }
}

function filterLaundryBatches() {
  const container = document.getElementById('laundry-batches-table-body');
  const query = document.getElementById('l-batch-filter-search').value.toLowerCase().trim();
  const type = document.getElementById('l-batch-filter-type').value;
  const status = document.getElementById('l-batch-filter-status').value;

  const filtered = laundryCachedBatches.filter(b => {
    const matchesSearch = b.batchNumber.toLowerCase().includes(query) ||
      (b.machineName && b.machineName.toLowerCase().includes(query)) ||
      (b.programName && b.programName.toLowerCase().includes(query));
    const matchesType = !type || b.runType === type;
    const matchesStatus = !status || b.status === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد نتائج مطابقة للتصفية</td></tr>';
    return;
  }

  [...filtered].reverse().forEach(b => {
    let badgeClass = 'badge-type-internal_transfer';
    if (b.status === 'Pending') badgeClass = 'badge-type-internal_transfer';
    else if (b.status === 'Running') badgeClass = 'badge-type-inbound';
    else if (b.status === 'Completed') badgeClass = 'badge-type-consumption';
    else if (b.status === 'Cancelled') badgeClass = 'badge-type-waste';

    let actionBtn = '';
    if (b.status === 'Pending') {
      actionBtn = `<button class="btn" onclick="updateLinenBatchStatus(${b.id}, 'Running')" style="padding:4px 8px; font-size:11px; background:#e0f2fe; color:#0369a1; border:none;"><i class="fa-solid fa-play"></i> تشغيل</button>`;
    } else if (b.status === 'Running') {
      actionBtn = `<button class="btn" onclick="updateLinenBatchStatus(${b.id}, 'Completed')" style="padding:4px 8px; font-size:11px; background:#dcfce7; color:#15803d; border:none;"><i class="fa-solid fa-circle-check"></i> إنهاء الدورة</button>`;
    } else {
      actionBtn = `<span style="font-size:11px; color:var(--text-muted);">دورة مكتملة</span>`;
    }

    let typeText = 'آلي';
    if (b.runType === 'MANUAL') typeText = 'يدوي';
    else if (b.runType === 'HYBRID') typeText = 'هجين';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:var(--primary);">${b.batchNumber} <span style="font-size:10px; padding:2px 6px; border-radius:12px; margin-right:5px; background:#e0e7ff; color:#3730a3;">${typeText}</span></td>
      <td>${b.machineName || '-'}</td>
      <td>${b.programName || '-'}</td>
      <td>${b.weight} كجم</td>
      <td>${b.pieces} قطعة</td>
      <td><span class="badge ${badgeClass}">${b.status}</span></td>
      <td>${actionBtn}</td>
    `;
    container.appendChild(row);
  });
}

async function updateLinenBatchStatus(id, status) {
  try {
    notify(`جاري تحديث حالة دورة الغسيل إلى ${status}...`);
    const res = await apiFetch(`/laundry/batches/${id}/status`, 'PUT', { status });
    if (res.success) {
      notify('تم تحديث حالة دورة الغسيل وحساب تكلفة التشغيل بنجاح!', 'success');
      renderLaundryBatches();
    }
  } catch (err) {
    notify('فشل تحديث حالة الدورة: ' + err.message, 'error');
  }
}

function openNewBatchModal() {
  document.getElementById('l-new-batch-form').reset();

  // Populate Machines selector
  const machSelect = document.getElementById('l-batch-machine');
  machSelect.innerHTML = '<option value="">اختر الغسالة للتشغيل...</option>';
  laundryCachedMachines.forEach(m => {
    if (m.isActive) {
      const opt = document.createElement('option'); opt.value = m.id; opt.innerText = `${m.name} (${m.capacity} كجم)`; machSelect.appendChild(opt);
    }
  });

  // Populate Program cycle selector
  const progSelect = document.getElementById('l-batch-program');
  progSelect.innerHTML = '<option value="">اختر برنامج التشغيل...</option>';



  // Populate linen items from localItemsList (filtering for laundry/linen items)
  const linenSelect = document.getElementById('l-batch-linen-select');
  linenSelect.innerHTML = '<option value="">اختر الصنف المتسخ...</option>';
  if (localItemsList && localItemsList.length > 0) {
    const linenKeywords = ['فوط', 'ملاي', 'ملاء', 'بشكير', 'مخد', 'كيس', 'يونيفورم', 'قميص', 'بنطلون', 'طقم', 'جاكيت', 'بطانية', 'لحاف', 'مفرش', 'ستارة', 'ستائر', 'توب', 'غسيل', 'كوفرتة', 'وبريات', 'بياضات', 'ملابس'];
    localItemsList.forEach(itm => {
      const nameAr = itm.itemNameAr || '';
      const nameEn = itm.itemNameEn || '';
      const matchesLinen = itm.itemCode.startsWith('L-') ||
        linenKeywords.some(kw => nameAr.includes(kw) || nameEn.toLowerCase().includes(kw.toLowerCase()));
      if (matchesLinen) {
        const opt = document.createElement('option');
        opt.value = itm.itemCode;
        opt.setAttribute('data-name', nameAr);
        opt.innerText = itm.itemCode + ' - ' + nameAr;
        linenSelect.appendChild(opt);
      }
    });
  }

  // Populate chemical input selectors
  const chemSelect = document.getElementById('l-batch-chem-select');
  chemSelect.innerHTML = '<option value="">اختر المنظف المستهلك...</option>';
  // Hardcoded standard detergents in ERP comsys database
  const chemicalsMock = [
    { code: 'CHEM-DET-001', name: 'Liquid Soap Soapox' },
    { code: 'CHEM-SOFT-002', name: 'Fabric Softener Fresh' }
  ];
  chemicalsMock.forEach(c => {
    const opt = document.createElement('option'); opt.value = c.code; opt.setAttribute('data-name', c.name); opt.innerText = c.code + ' - ' + c.name; chemSelect.appendChild(opt);
  });

  document.getElementById('l-batch-linens-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة أصناف للدورة بعد</td></tr>';
  document.getElementById('l-batch-chems-body').innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم تسجيل استهلاك كيميائي بعد</td></tr>';

  laundryBatchLinenLines = [];
  laundryBatchChemLines = [];

  document.getElementById('l-batch-run-type').value = 'PROGRAM';
  onBatchRunTypeChange();

  // Generate random batch number
  document.getElementById('l-batch-number').value = 'LB-LND-' + Math.floor(1000 + Math.random() * 9000);

  document.getElementById('laundry-batch-modal').style.display = 'flex';
}

function onBatchRunTypeChange() {
  const type = document.getElementById('l-batch-run-type').value;
  const autoFields = document.getElementById('l-batch-automation-fields');
  const machSelect = document.getElementById('l-batch-machine');
  const progSelect = document.getElementById('l-batch-program');

  const chemAdder = document.getElementById('l-batch-chem-adder-section');
  const chemMsg = document.getElementById('l-batch-chem-read-only-msg');

  // Reset lines
  laundryBatchChemLines = [];
  renderBatchChemTable();

  if (type === 'MANUAL') {
    autoFields.style.display = 'none';
    machSelect.value = '';
    progSelect.innerHTML = '<option value="">تشغيل يدوي (بدون برنامج)...</option>';

    chemAdder.style.display = 'grid';
    chemMsg.style.display = 'none';
  } else if (type === 'PROGRAM') {
    autoFields.style.display = 'grid';
    machSelect.value = '';
    progSelect.innerHTML = '<option value="">اختر الغسالة أولاً...</option>';

    chemAdder.style.display = 'none';
    chemMsg.style.display = 'block';
  } else if (type === 'HYBRID') {
    autoFields.style.display = 'grid';
    machSelect.value = '';
    progSelect.innerHTML = '<option value="">اختر الغسالة أولاً...</option>';

    chemAdder.style.display = 'grid';
    chemMsg.style.display = 'none';
  }
}

let currentMachinePrograms = [];

// Fetch program cycle when machine changes
async function onBatchMachineChange() {
  const machineId = document.getElementById('l-batch-machine').value;
  const progSelect = document.getElementById('l-batch-program');
  progSelect.innerHTML = '<option value="">جاري تحميل برامج التشغيل...</option>';

  laundryBatchChemLines = [];
  renderBatchChemTable();

  if (!machineId) {
    progSelect.innerHTML = '<option value="">اختر الغسالة أولاً...</option>';
    return;
  }

  try {
    const res = await apiFetch(`/laundry/machines/${machineId}/programs`);
    if (res.success) {
      progSelect.innerHTML = '<option value="">اختر دورة البرنامج...</option>';
      currentMachinePrograms = res.data;
      res.data.forEach(p => {
        if (p.isActive) {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.innerText = p.name;
          progSelect.appendChild(opt);
        }
      });
    }
  } catch (err) {
    progSelect.innerHTML = '<option value="">فشل تحميل البرامج</option>';
  }
}

async function onBatchProgramChange() {
  const progId = document.getElementById('l-batch-program').value;
  const runType = document.getElementById('l-batch-run-type').value;

  if (runType === 'MANUAL') return;

  laundryBatchChemLines = [];
  renderBatchChemTable();

  if (!progId) return;

  const program = currentMachinePrograms.find(p => p.id == progId);
  if (program && program.recipeId) {
    try {
      notify('جاري تحميل وصفة البرنامج الكيميائية...');
      const res = await apiFetch(`/laundry/recipes/${program.recipeId}`);
      if (res.success && res.data && res.data.items) {
        const machineId = document.getElementById('l-batch-machine').value;
        const machine = laundryCachedMachines.find(m => m.id == machineId);
        const machineCapacity = machine ? parseFloat(machine.capacity || 0) : 0;

        res.data.items.forEach(itm => {
          let actualQty = 0;
          if (itm.calculationMode === 'chemical_per_kg') {
            actualQty = itm.expectedQty * machineCapacity;
          } else {
            actualQty = itm.expectedQty;
          }

          laundryBatchChemLines.push({
            chemicalItemCode: itm.chemicalItemCode,
            chemicalName: itm.chemicalName,
            actualQty: parseFloat(actualQty.toFixed(2)),
            mode: runType === 'PROGRAM' ? 'AUTO' : 'FLEXIBLE',
          });
        });

        renderBatchChemTable();
        notify('تم تحميل كميات المواد الكيميائية للبرنامج تلقائياً!', 'success');
      }
    } catch (err) {
      console.error('Failed to load recipe details:', err);
    }
  }
}

let laundryBatchLinenLines = [];
let laundryBatchChemLines = [];

function addLinenToBatch() {
  const select = document.getElementById('l-batch-linen-select');
  const qtyInput = document.getElementById('l-batch-linen-qty');
  const roleInput = document.getElementById('l-batch-linen-role');

  if (!select.value || !qtyInput.value || parseFloat(qtyInput.value) <= 0) {
    notify('يرجى تحديد الصنف والكمية بشكل صحيح', 'error');
    return;
  }

  const selectedOpt = select.options[select.selectedIndex];
  const itemCode = select.value;
  const itemNameAr = selectedOpt.getAttribute('data-name');
  const quantity = parseFloat(qtyInput.value);
  const role = roleInput.value;

  const exists = laundryBatchLinenLines.find(l => l.itemCode === itemCode && l.role === role);
  if (exists) {
    exists.quantity += quantity;
  } else {
    laundryBatchLinenLines.push({ itemCode, itemNameAr, quantity, role });
  }

  renderBatchLinenTable();
  qtyInput.value = '';
}

function removeLinenFromBatch(index) {
  laundryBatchLinenLines.splice(index, 1);
  renderBatchLinenTable();
}

function renderBatchLinenTable() {
  const container = document.getElementById('l-batch-linens-body');
  container.innerHTML = '';
  if (laundryBatchLinenLines.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة أصناف للدورة بعد</td></tr>';
    return;
  }

  laundryBatchLinenLines.forEach((l, index) => {
    const roleBadge = l.role === 'INPUT' ? 'badge-type-internal_transfer' : (l.role === 'OUTPUT' ? 'badge-type-consumption' : 'badge-type-waste');
    const roleName = l.role === 'INPUT' ? 'متسخ وارد' : (l.role === 'OUTPUT' ? 'نظيف جاهز' : 'هدر ممزق');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.itemNameAr} (${l.itemCode})</td>
      <td>${l.quantity}</td>
      <td><span class="badge ${roleBadge}">${roleName}</span></td>
      <td><button type="button" class="btn btn-secondary" onclick="removeLinenFromBatch(${index})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    container.appendChild(row);
  });
}

function addChemToBatch() {
  const select = document.getElementById('l-batch-chem-select');
  const qtyInput = document.getElementById('l-batch-chem-qty');

  if (!select.value || !qtyInput.value || parseFloat(qtyInput.value) <= 0) {
    notify('يرجى تحديد المنظف والكمية المستهلكة بشكل صحيح', 'error');
    return;
  }

  const selectedOpt = select.options[select.selectedIndex];
  const chemicalItemCode = select.value;
  const chemicalName = selectedOpt.getAttribute('data-name');
  const actualQty = parseFloat(qtyInput.value);

  const exists = laundryBatchChemLines.find(l => l.chemicalItemCode === chemicalItemCode);
  if (exists) {
    exists.actualQty += actualQty;
  } else {
    laundryBatchChemLines.push({ chemicalItemCode, chemicalName, actualQty, mode: 'MANUAL' });
  }

  renderBatchChemTable();
  qtyInput.value = '';
}

function removeChemFromBatch(index) {
  laundryBatchChemLines.splice(index, 1);
  renderBatchChemTable();
}

function renderBatchChemTable() {
  const container = document.getElementById('l-batch-chems-body');
  container.innerHTML = '';
  if (laundryBatchChemLines.length === 0) {
    container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم تسجيل استهلاك كيميائي بعد</td></tr>';
    return;
  }

  laundryBatchChemLines.forEach((l, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.chemicalName} (${l.chemicalItemCode})</td>
      <td>${l.actualQty} لتر / وحدة</td>
      <td><button type="button" class="btn btn-secondary" onclick="removeChemFromBatch(${index})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    container.appendChild(row);
  });
}

async function submitLaundryBatch(e) {
  e.preventDefault();
  const runType = document.getElementById('l-batch-run-type').value;
  const batchNumber = document.getElementById('l-batch-number').value;
  const machineId = document.getElementById('l-batch-machine').value;
  const programId = document.getElementById('l-batch-program').value;
  const weight = document.getElementById('l-batch-weight').value;
  const pieces = document.getElementById('l-batch-pieces').value;

  if (laundryBatchLinenLines.length === 0) {
    notify('يجب إضافة صنف واحد على الأقل لدورة الغسيل', 'error');
    return;
  }

  // Resolve recipeId from selected program
  let recipeId = null;
  if (runType !== 'MANUAL' && programId) {
    const program = currentMachinePrograms.find(p => p.id == programId);
    if (program) {
      recipeId = program.recipeId;
    }
  }

  try {
    notify('جاري تسجيل دورة تشغيل الغسيل...');
    const res = await apiFetch('/laundry/batches', 'POST', {
      runType,
      batchNumber,
      machineId: (runType !== 'MANUAL' && machineId) ? parseInt(machineId) : null,
      programId: (runType !== 'MANUAL' && programId) ? parseInt(programId) : null,
      recipeId,
      weight: weight ? parseFloat(weight) : 0,
      pieces: pieces ? parseInt(pieces) : 0,
      guestWeight: 0,
      staffWeight: 0,
      specialWeight: 0,
      spotWeight: 0,
      items: laundryBatchLinenLines,
      consumptions: laundryBatchChemLines,
    });

    if (res.success) {
      notify('تم إنشاء دورة الغسيل بنجاح وبدء فترات المعالجة!', 'success');
      document.getElementById('laundry-batch-modal').style.display = 'none';
      renderLaundryBatches();
    }
  } catch (err) {
    notify('فشل تسجيل الدورة: ' + err.message, 'error');
  }
}

// ─── 4. RETURNS (LAUNDRY ➔ WAREHOUSE) TAB ────────────────────────────────────

async function renderLaundryReturns() {
  const container = document.getElementById('laundry-returns-table-body');
  container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">جاري تحميل سجل مرتجعات المخزن...</td></tr>';

  try {
    const res = await apiFetch('/laundry/returns');
    if (res.success && res.data) {
      container.innerHTML = '';
      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد مرتجعات مسجلة حالياً</td></tr>';
        return;
      }

      res.data.reverse().forEach(r => {
        let badgeClass = 'badge-type-internal_transfer';
        let statusName = r.status;
        if (r.status === 'draft') {
          badgeClass = 'badge-type-internal_transfer'; statusName = 'مسودة';
        } else if (r.status === 'sent') {
          badgeClass = 'badge-type-inbound'; statusName = 'تم الإرسال';
        } else if (r.status === 'completed') {
          badgeClass = 'badge-type-consumption'; statusName = 'مكتمل ومستلم بالعهدة';
        } else if (r.status === 'rejected') {
          badgeClass = 'badge-type-waste'; statusName = 'مرفوض';
        } else if (r.status === 'disputed') {
          badgeClass = 'badge-type-distribution'; statusName = 'نزاع كميات';
        }

        let actionBtn = '';
        if (r.status === 'draft') {
          actionBtn = `<button class="btn" onclick="openVerifyReturnModal(${r.id})" style="padding:4px 8px; font-size:11px; background:#dcfce7; color:#15803d; border:none;"><i class="fa-solid fa-clipboard-check"></i> تأكيد استلام المخزن</button>`;
        } else {
          actionBtn = `<span style="font-size:11px; color:var(--text-muted);">مؤكد</span>`;
        }

        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleString('ar-EG') : '-';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="font-weight:700; color:var(--primary);">RTN-LND-${r.id}</td>
          <td style="font-weight:700; color:var(--success);">TR-LND-${r.transferId}</td>
          <td><span class="badge ${badgeClass}">${statusName}</span></td>
          <td>${r.notes || '-'}</td>
          <td>${dateStr}</td>
          <td>${actionBtn}</td>
        `;
        container.appendChild(row);
      });
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">فشل تحميل المرتجعات: ${err.message}</td></tr>`;
  }
}

async function openNewReturnModal() {
  document.getElementById('l-new-rtn-form').reset();

  // Populate transfer list to match return
  const tfSelect = document.getElementById('l-rtn-transfer-select');
  tfSelect.innerHTML = '<option value="">اختر رقم الشحنة المصدر...</option>';

  try {
    const res = await apiFetch('/laundry/transfers');
    if (res.success) {
      res.data.forEach(t => {
        if (t.status === 'received' || t.status === 'partially_received') {
          const opt = document.createElement('option'); opt.value = t.id; opt.innerText = `شحنة رقم: TR-LND-${t.id} (من: ${t.fromWarehouseName})`; tfSelect.appendChild(opt);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load transfers for return modal', err);
  }

  document.getElementById('l-rtn-items-body').innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">اختر الشحنة المصدر لعرض الأصناف المتاحة للإرجاع</td></tr>';
  laundryNewReturnItems = [];

  document.getElementById('laundry-return-modal').style.display = 'flex';
}

let laundryNewReturnItems = [];

async function onReturnTransferChange() {
  const transferId = document.getElementById('l-rtn-transfer-select').value;
  const container = document.getElementById('l-rtn-items-body');
  container.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:10px;">جاري تحميل تفاصيل الشحنة...</td></tr>';

  if (!transferId) {
    container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:10px;">اختر الشحنة المصدر لعرض الأصناف المتاحة للإرجاع</td></tr>';
    return;
  }

  try {
    const res = await apiFetch(`/laundry/transfers/${transferId}`);
    if (res.success && res.data) {
      container.innerHTML = '';
      laundryNewReturnItems = res.data.items;

      let activeItemsCount = 0;
      res.data.items.forEach((item, index) => {
        const remaining = parseFloat(item.remainingQty !== undefined ? item.remainingQty : item.receivedQty);
        if (remaining <= 0) return; // Skip items that have been fully returned

        activeItemsCount++;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.itemNameAr} (${item.itemCode})</td>
          <td style="font-weight:700; color:var(--primary);">${remaining} قطعة متبقية بالمغسلة</td>
          <td><input type="number" id="rtn-qty-${index}" class="input-control" value="${remaining}" min="0.0001" max="${remaining}" step="any" style="padding:6px; font-size:12px; width:100px; text-align:center;"></td>
        `;
        container.appendChild(row);
      });

      if (activeItemsCount === 0) {
        container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--success); font-weight:700; padding:20px;">تم إرجاع جميع أصناف هذه الشحنة بالكامل مسبقاً!</td></tr>';
      }
    }
  } catch (err) {
    container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ef4444; padding:10px;">فشل تحميل أصناف الشحنة</td></tr>';
  }
}

async function submitLaundryReturnDraft(e) {
  e.preventDefault();
  const transferId = document.getElementById('l-rtn-transfer-select').value;
  const notes = document.getElementById('l-rtn-notes').value;

  if (!transferId) {
    notify('يرجى اختيار الشحنة المصدر للتحويل العكسي', 'error');
    return;
  }

  const itemsPayload = [];
  let validationError = false;

  laundryNewReturnItems.forEach((itm, index) => {
    const qtyInput = document.getElementById(`rtn-qty-${index}`);
    if (!qtyInput) return; // Skip hidden fully-returned items

    const valInput = qtyInput.value;
    const expectedQty = parseFloat(valInput);
    const remaining = parseFloat(itm.remainingQty !== undefined ? itm.remainingQty : itm.receivedQty);

    if (isNaN(expectedQty) || expectedQty <= 0 || expectedQty > remaining) {
      notify(`الكمية المرجعة للصنف ${itm.itemNameAr} غير صالحة. يجب أن تكون بين 1 و ${remaining}`, 'error');
      validationError = true;
      return;
    }

    itemsPayload.push({
      itemCode: itm.itemCode,
      itemNameAr: itm.itemNameAr,
      expectedQty,
    });
  });

  if (validationError) return;

  try {
    notify('جاري إنشاء مسودة طلب الإرجاع...');
    const res = await apiFetch('/laundry/returns', 'POST', {
      transferId: parseInt(transferId),
      notes,
      items: itemsPayload,
    });

    if (res.success) {
      notify('تم تسجيل مسودة طلب مرتجع بياضات نظيفة بنجاح!', 'success');
      document.getElementById('laundry-return-modal').style.display = 'none';
      renderLaundryReturns();
    }
  } catch (err) {
    notify('فشل إنشاء طلب الإرجاع: ' + err.message, 'error');
  }
}

// Verify return modal logic
let laundryVerifyReturnItems = [];
let currentVerifyReturnId = null;

async function openVerifyReturnModal(returnId) {
  currentVerifyReturnId = returnId;
  notify('جاري جلب تفاصيل المرتجع لمراجعته بالمخزن...');
  try {
    const res = await apiFetch(`/laundry/returns/${returnId}`);
    if (res.success && res.data) {
      const container = document.getElementById('l-verify-rtn-items-body');
      container.innerHTML = '';
      laundryVerifyReturnItems = res.data.items;

      res.data.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.itemNameAr} (${item.itemCode})</td>
          <td style="font-weight:700;">${item.expectedQty}</td>
          <td><input type="number" id="v-rtn-actual-${index}" class="input-control" value="${item.expectedQty}" min="0" max="${item.expectedQty}" style="padding:6px; font-size:12px; width:80px; text-align:center;"></td>
          <td>
            <select id="v-rtn-reject-reason-${index}" class="table-select" style="padding:6px; font-size:12px;">
              <option value="">بدون تلف</option>
              <option value="Damaged">تالف / ممزق بالمغسلة</option>
              <option value="Wet">رطب / يحتاج تجفيف</option>
              <option value="Count Mismatch">فقدان في العدد</option>
            </select>
          </td>
          <td><input type="text" id="v-rtn-reject-notes-${index}" class="input-control" placeholder="ملاحظات العجز..." style="padding:6px; font-size:11px;"></td>
        `;
        container.appendChild(row);
      });

      document.getElementById('laundry-verify-return-modal').style.display = 'flex';
    }
  } catch (err) {
    notify('فشل تحميل بيانات المرتجع: ' + err.message, 'error');
  }
}

async function submitReturnVerification(status) {
  const notes = document.getElementById('l-verify-rtn-notes').value;
  const itemsPayload = [];
  let validationError = false;

  laundryVerifyReturnItems.forEach((itm, index) => {
    const actVal = document.getElementById(`v-rtn-actual-${index}`).value;
    const actualQty = parseFloat(actVal);
    const rejectReason = document.getElementById(`v-rtn-reject-reason-${index}`).value;
    const rejectNotes = document.getElementById(`v-rtn-reject-notes-${index}`).value;

    if (isNaN(actualQty) || actualQty < 0 || actualQty > itm.expectedQty) {
      notify(`الكمية المستلمة للصنف ${itm.itemNameAr} غير صالحة. يجب أن تكون بين 0 و ${itm.expectedQty}`, 'error');
      validationError = true;
      return;
    }

    itemsPayload.push({
      itemCode: itm.itemCode,
      actualQty,
      rejectReason: rejectReason || null,
      rejectNotes: rejectNotes || null,
    });
  });

  if (validationError) return;

  try {
    notify('جاري تأكيد استلام المرتجعات بالمستودع وتحديث الأرصدة...');
    const res = await apiFetch(`/laundry/returns/${currentVerifyReturnId}/verify`, 'PUT', {
      status,
      notes,
      items: itemsPayload,
    });

    if (res.success) {
      notify('تم مراجعة وتأكيد استلام بياضات المرتجع للمخزن بنجاح وتحديث بطاقة المخزون!', 'success');
      document.getElementById('laundry-verify-return-modal').style.display = 'none';
      renderLaundryReturns();
    }
  } catch (err) {
    notify('فشل تأكيد المرتجع: ' + err.message, 'error');
  }
}

// ─── 5. TICKETING & GUEST BILLING TAB ────────────────────────────────────────

let laundryCachedTickets = [];

async function renderLaundryTickets() {
  const container = document.getElementById('laundry-tickets-table-body');
  container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">جاري تحميل تذاكر النزلاء والموظفين...</td></tr>';

  try {
    const res = await apiFetch('/laundry/tickets');
    if (res.success && res.data) {
      laundryCachedTickets = res.data;
      filterLaundryTickets();
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#ef4444;">فشل تحميل التذاكر: ${err.message}</td></tr>`;
  }
}

function filterLaundryTickets() {
  const container = document.getElementById('laundry-tickets-table-body');
  const query = document.getElementById('l-ticket-filter-search').value.toLowerCase().trim();
  const type = document.getElementById('l-ticket-filter-type').value;
  const status = document.getElementById('l-ticket-filter-status').value;

  const filtered = laundryCachedTickets.filter(t => {
    const custName = (t.guestName || `موظف رقم: ${t.employeeId}`).toLowerCase();
    const room = (t.roomNumber || '').toLowerCase();
    const tktId = `tkt-lnd-${t.id}`.toLowerCase();

    const matchesSearch = custName.includes(query) || room.includes(query) || tktId.includes(query);
    const matchesType = !type || (type === 'Guest' && t.ticketType === 'GUEST') || (type === 'Staff' && t.ticketType === 'STAFF');
    const matchesStatus = !status || t.status === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد نتائج مطابقة للتصفية</td></tr>';
    return;
  }

  [...filtered].reverse().forEach(t => {
    let badgeClass = 'badge-type-internal_transfer';
    if (t.status === 'Received') badgeClass = 'badge-type-internal_transfer';
    else if (t.status === 'Processing') badgeClass = 'badge-type-inbound';
    else if (t.status === 'Ready') badgeClass = 'badge-type-distribution';
    else if (t.status === 'Delivered') badgeClass = 'badge-type-consumption';

    let actionBtn = '';
    if (t.status !== 'Delivered') {
      const nextStatus = t.status === 'Received' ? 'Processing' : (t.status === 'Processing' ? 'Ready' : 'Delivered');
      const nextName = t.status === 'Received' ? 'بدء المعالجة' : (t.status === 'Processing' ? 'تجهيز الملابس' : 'تسليم وتأكيد الفاتورة');
      actionBtn = `<button class="btn" onclick="updateLinenTicketStatus(${t.id}, '${nextStatus}')" style="padding:4px 8px; font-size:11px; border:none;"><i class="fa-solid fa-arrows-spin"></i> ${nextName}</button>`;
    } else {
      actionBtn = `<span style="font-size:11px; color:var(--text-muted);">تم التسليم والفوترة</span>`;
    }

    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleString('ar-EG') : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="font-weight:700; color:var(--primary);">TKT-LND-${t.id}</td>
      <td><span class="badge ${t.ticketType === 'GUEST' ? 'badge-type-consumption' : 'badge-type-internal_transfer'}">${t.ticketType === 'GUEST' ? 'نزيل (GUEST)' : 'موظف (STAFF)'}</span></td>
      <td>${t.guestName || `موظف رقم: ${t.employeeId}`}</td>
      <td>${t.roomNumber || '-'}</td>
      <td><span class="badge ${badgeClass}">${t.status}</span></td>
      <td>${dateStr}</td>
      <td>${actionBtn}</td>
    `;
    container.appendChild(row);
  });
}

async function updateLinenTicketStatus(id, status) {
  try {
    notify(`جاري تحديث حالة تذكرة الغسيل إلى ${status}...`);
    const res = await apiFetch(`/laundry/tickets/${id}/status`, 'PUT', { status });
    if (res.success) {
      notify('تم تحديث حالة تذكرة الغسيل بنجاح!', 'success');
      renderLaundryTickets();
    }
  } catch (err) {
    notify('فشل تحديث التذكرة: ' + err.message, 'error');
  }
}

function openNewTicketModal() {
  document.getElementById('l-new-ticket-form').reset();
  document.getElementById('l-ticket-items-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة خدمات للتذكرة بعد</td></tr>';
  laundryTicketLinesList = [];

  document.getElementById('laundry-ticket-modal').style.display = 'flex';
}

let laundryTicketLinesList = [];

function addServiceToTicket() {
  const select = document.getElementById('l-ticket-service');
  const qtyInput = document.getElementById('l-ticket-qty');
  const priceInput = document.getElementById('l-ticket-price');

  if (!select.value || !qtyInput.value || parseFloat(qtyInput.value) <= 0 || !priceInput.value || parseFloat(priceInput.value) < 0) {
    notify('يرجى تحديد الخدمة والكمية وسعر القطعة بشكل صحيح', 'error');
    return;
  }

  const selectedOpt = select.options[select.selectedIndex];
  const serviceItemCode = select.value;
  const serviceName = selectedOpt.getAttribute('data-name');
  const quantity = parseFloat(qtyInput.value);
  const unitPrice = parseFloat(priceInput.value);

  const exists = laundryTicketLinesList.find(l => l.serviceItemCode === serviceItemCode);
  if (exists) {
    exists.quantity += quantity;
  } else {
    laundryTicketLinesList.push({
      serviceItemCode,
      serviceName,
      quantity,
      unitPrice,
    });
  }

  renderTicketItemsTable();
  qtyInput.value = '';
  priceInput.value = '';
}

function removeServiceFromTicket(index) {
  laundryTicketLinesList.splice(index, 1);
  renderTicketItemsTable();
}

function renderTicketItemsTable() {
  const container = document.getElementById('l-ticket-items-body');
  container.innerHTML = '';
  if (laundryTicketLinesList.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة خدمات للتذكرة بعد</td></tr>';
    return;
  }

  laundryTicketLinesList.forEach((l, index) => {
    const total = l.quantity * l.unitPrice;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${l.serviceName} (${l.serviceItemCode})</td>
      <td>${l.quantity}</td>
      <td>${l.unitPrice} ج.م</td>
      <td>${total} ج.م</td>
      <td><button type="button" class="btn btn-secondary" onclick="removeServiceFromTicket(${index})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    container.appendChild(row);
  });
}

async function submitLaundryTicket(e) {
  e.preventDefault();
  const ticketType = document.getElementById('l-ticket-type').value;
  const guestName = document.getElementById('l-ticket-name').value;
  const roomNumber = document.getElementById('l-ticket-room').value;
  const employeeId = document.getElementById('l-ticket-emp-id').value;
  const specialNotes = document.getElementById('l-ticket-notes').value;

  if (!ticketType) {
    notify('يرجى تحديد نوع التذكرة', 'error');
    return;
  }
  if (laundryTicketLinesList.length === 0) {
    notify('يجب إضافة خدمة واحدة على الأقل للتذكرة', 'error');
    return;
  }

  try {
    notify('جاري تسجيل تذكرة الغسيل وحفظ البيانات...');
    const res = await apiFetch('/laundry/tickets', 'POST', {
      ticketType,
      guestName: ticketType === 'GUEST' ? guestName : 'موظف داخلي',
      roomNumber: ticketType === 'GUEST' ? roomNumber : null,
      employeeId: ticketType === 'STAFF' ? parseInt(employeeId) : null,
      specialNotes,
      items: laundryTicketLinesList,
    });

    if (res.success) {
      notify('تم إنشاء تذكرة الغسيل للنزيل بنجاح وجاري فترات الكي والغسيل!', 'success');
      document.getElementById('laundry-ticket-modal').style.display = 'none';
      renderLaundryTickets();
    }
  } catch (err) {
    notify('فشل تسجيل تذكرة الغسيل: ' + err.message, 'error');
  }
}

// Toggles inputs in ticket based on guest/staff role
function onTicketTypeChange() {
  const val = document.getElementById('l-ticket-type').value;
  const guestGroup = document.getElementById('l-ticket-guest-group');
  const staffGroup = document.getElementById('l-ticket-staff-group');

  if (val === 'STAFF') {
    guestGroup.style.display = 'none';
    staffGroup.style.display = 'block';
  } else {
    guestGroup.style.display = 'block';
    staffGroup.style.display = 'none';
  }
}

// ─── 6. RECONCILIATION REPORT TAB ─────────────────────────────────────────────

async function renderLaundryReconciliation() {
  const container = document.getElementById('laundry-recon-table-body');
  container.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">جاري تشغيل واحتساب تقرير مطابقة الأرصدة للمغسلة...</td></tr>';

  try {
    const res = await apiFetch('/laundry/reports/reconciliation');
    if (res.success && res.data) {
      container.innerHTML = '';
      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد حركات أرصدة مطابقة حالياً بالتقرير</td></tr>';
        return;
      }

      res.data.forEach(r => {
        const warningIcon = r.alertTriggered
          ? '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;" title="يوجد عجز/زيادة في الأرصدة بين الشحن والمرتجعات"></i>'
          : '<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${warningIcon}</td>
          <td style="font-weight:700; color:var(--text-main);">${r.itemNameAr}</td>
          <td>${r.itemCode}</td>
          <td style="font-weight:700;">${r.sentQty}</td>
          <td style="color:#10b981; font-weight:700;">${r.returnedQty}</td>
          <td style="color:#f59e0b;">${r.scrapQty}</td>
          <td style="color:var(--primary); font-weight:700;">${r.inProgressQty}</td>
          <td style="font-weight:800; color:${parseFloat(r.variance) === 0 ? 'var(--text-main)' : '#ef4444'};">${r.variance}</td>
        `;
        container.appendChild(row);
      });
    }
  } catch (err) {
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444;">فشل احتساب مطابقة الأرصدة: ${err.message}</td></tr>`;
  }
}

let laundryStockItems = [];

async function renderLaundryStock() {
  const container = document.getElementById('laundry-stock-table-body');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">جاري تحميل أرصدة مخزون المغسلة الحالي...</td></tr>';

  try {
    const res = await apiFetch('/laundry/stock');
    if (res.success && res.data && res.data.items) {
      laundryStockItems = res.data.items;
      displayLaundryStock(laundryStockItems);
    } else {
      container.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:20px;">لم يتم العثور على أرصدة مخزون للمغسلة</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load laundry stock:', err);
    container.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444; padding:20px;">فشل تحميل المخزون الحالي للمغسلة: ${err.message}</td></tr>`;
  }
}

function displayLaundryStock(items) {
  const container = document.getElementById('laundry-stock-table-body');
  if (!container) return;
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد أصناف مطابقة للبحث</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(itm => {
    const row = document.createElement('tr');
    
    const totalReceived = (itm.qtyReceived || 0) + (itm.qtyInternalIn || 0);
    const totalReturned = itm.qtyReturnedIn || 0;
    const totalConsumed = itm.qtyConsumed || 0;
    const totalDamaged = (itm.qtyDamaged || 0) + (itm.qtyWasted || 0) + (itm.qtyDisposed || 0);
    const currentQty = itm.qtyOperational || 0;

    const typeText = itm.itemType === 'consumable' ? 'منظفات كيميائية' : 'بياضات وأصول';
    const typeBadgeColor = itm.itemType === 'consumable' ? 'background:#eff6ff; color:#3b82f6; border:1px solid #bfdbfe;' : 'background:#f0fdf4; color:#10b981; border:1px solid #bbf7d0;';

    row.innerHTML = `
      <td style="font-weight:700; color:var(--text-muted);">${itm.itemCode}</td>
      <td style="font-weight:700; color:var(--text-main);">${itm.itemNameAr}</td>
      <td><span class="badge" style="font-size:10px; font-weight:800; ${typeBadgeColor}">${typeText}</span></td>
      <td>${itm.unitNameAr || 'حبة'}</td>
      <td style="font-weight:700; color:var(--primary);">${totalReceived}</td>
      <td style="color:#10b981; font-weight:700;">${totalReturned}</td>
      <td style="color:#eab308; font-weight:700;">${totalConsumed}</td>
      <td style="color:#ef4444;">${totalDamaged}</td>
      <td style="font-weight:800; font-size:13px; color:${currentQty > 0 ? '#10b981' : (currentQty < 0 ? '#ef4444' : 'var(--text-main)')};">${currentQty}</td>
    `;
    fragment.appendChild(row);
  });
  container.appendChild(fragment);
}

function filterLaundryStock() {
  const searchInput = document.getElementById('l-stock-search');
  if (!searchInput) return;
  const searchVal = searchInput.value.toLowerCase().trim();
  if (!searchVal) {
    displayLaundryStock(laundryStockItems);
    return;
  }
  const filtered = laundryStockItems.filter(itm => 
    (itm.itemCode && itm.itemCode.toLowerCase().includes(searchVal)) ||
    (itm.itemNameAr && itm.itemNameAr.toLowerCase().includes(searchVal))
  );
  displayLaundryStock(filtered);
}

// ─── 7. MODALS HELPER CLOSES ──────────────────────────────────────────────────

function closeLaundryModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function openNewMachineModal() {
  document.getElementById('l-new-machine-form').reset();
  document.getElementById('laundry-machine-modal').style.display = 'flex';
}

async function submitLaundryMachine(e) {
  e.preventDefault();
  const machineName = document.getElementById('l-mach-name').value;
  const capacityKg = document.getElementById('l-mach-capacity').value;

  try {
    notify('جاري إضافة غسالة جديدة للمغسلة...');
    const res = await apiFetch('/laundry/machines', 'POST', {
      machineName,
      capacityKg: parseFloat(capacityKg),
      isActive: true
    });

    if (res.success) {
      notify('تم تسجيل وإضافة الغسالة للخدمة بنجاح!', 'success');
      document.getElementById('laundry-machine-modal').style.display = 'none';
      await loadLaundryMetadata();
      renderLaundryOverview();
    }
  } catch (err) {
    notify('فشل إضافة الغسالة: ' + err.message, 'error');
  }
}

// ─── 8. CONFIGURATIONS TAB (PROGRAMS & RECIPES CRUD) ───────────────────────────

let laundryRecipeChemLines = [];

async function renderLaundryConfigurations() {
  const progContainer = document.getElementById('laundry-programs-table-body');
  const recContainer = document.getElementById('laundry-recipes-table-body');

  if (progContainer) progContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">جاري تحميل برامج التشغيل...</td></tr>';
  if (recContainer) recContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;">جاري تحميل الوصفات الكيميائية...</td></tr>';

  try {
    if (laundryCachedMachines.length === 0) {
      await loadLaundryMetadata();
    }

    // Fetch programs across all machines
    const programsPromises = laundryCachedMachines.map(m => apiFetch('/laundry/machines/' + m.id + '/programs'));
    const programsResponses = await Promise.all(programsPromises);
    let allPrograms = [];
    programsResponses.forEach((res, index) => {
      if (res.success && res.data) {
        const machine = laundryCachedMachines[index];
        res.data.forEach(p => {
          allPrograms.push({
            ...p,
            machineName: machine.name
          });
        });
      }
    });

    // Render Programs
    if (progContainer) {
      progContainer.innerHTML = '';
      if (allPrograms.length === 0) {
        progContainer.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد برامج تشغيل مضافة حالياً</td></tr>';
      } else {
        allPrograms.forEach(p => {
          const statusBadge = p.isActive
            ? '<span class="badge badge-type-consumption">نشط</span>'
            : '<span class="badge badge-type-waste">معطل</span>';

          const recCap = p.recommendedCapacity ? `${p.recommendedCapacity} كجم` : '-';
          const maxCap = p.maximumCapacity ? `${p.maximumCapacity} كجم` : '-';
          const details = `${p.durationMins || '-'} د | ${p.temperatureC || '-'}°م | ${p.waterLevelLiters || '-'}ل | ${p.spinSpeedRpm || '-'} RPM`;

          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-weight:700; color:var(--text-main);">${p.name}</td>
            <td>${p.machineName}</td>
            <td>${recCap} / ${maxCap}</td>
            <td><code style="font-size:10px; color:var(--primary);">${details}</code></td>
            <td>${statusBadge}</td>
            <td style="text-align:center;">
              <button class="btn btn-secondary" onclick="deleteProgram(${p.id})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none; font-size:11px;"><i class="fa-solid fa-trash"></i> حذف</button>
            </td>
          `;
          progContainer.appendChild(row);
        });
      }
    }

    // Fetch recipes
    const recRes = await apiFetch('/laundry/recipes');
    if (recContainer) {
      recContainer.innerHTML = '';
      if (recRes.success && recRes.data) {
        if (recRes.data.length === 0) {
          recContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد وصفات كيميائية مضافة حالياً</td></tr>';
        } else {
          recRes.data.forEach(r => {
            const statusBadge = r.isActive
              ? '<span class="badge badge-type-consumption">نشط</span>'
              : '<span class="badge badge-type-waste">معطل</span>';
            const modeText = r.mode === 'STRICT' ? 'ثابت صارم' : 'مرن متغير';

            const row = document.createElement('tr');
            row.innerHTML = `
              <td style="font-weight:700; color:var(--text-main);">${r.name}</td>
              <td>${modeText}</td>
              <td>${r.description || '-'}</td>
              <td>${statusBadge}</td>
              <td style="text-align:center;">
                <button class="btn btn-secondary" onclick="deleteRecipe(${r.id})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none; font-size:11px;"><i class="fa-solid fa-trash"></i> حذف</button>
              </td>
            `;
            recContainer.appendChild(row);
          });
        }
      }
    }
  } catch (err) {
    console.error('Error rendering configurations tab:', err);
  }
}

function openNewProgramModal() {
  const select = document.getElementById('l-program-machine');
  if (select) {
    select.innerHTML = '<option value="">اختر الغسالة المرتبطة...</option>';
    laundryCachedMachines.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name} (السعة: ${m.capacity} كجم)</option>`;
    });
  }

  const recSelect = document.getElementById('l-program-recipe-select');
  if (recSelect) {
    recSelect.innerHTML = '<option value="">بدون وصفة كيميائية مرتبطة (اختياري)...</option>';
    laundryCachedRecipes.forEach(r => {
      if (r.isActive) {
        recSelect.innerHTML += `<option value="${r.id}">${r.name} [${r.mode}]</option>`;
      }
    });
  }

  document.getElementById('l-program-form').reset();
  document.getElementById('laundry-program-modal').style.display = 'flex';
}

async function submitLaundryProgram(e) {
  e.preventDefault();
  const machineId = document.getElementById('l-program-machine').value;
  const programName = document.getElementById('l-program-name').value;
  const recommendedCapacity = document.getElementById('l-program-recommended-cap').value;
  const maximumCapacity = document.getElementById('l-program-maximum-cap').value;
  const recipeId = document.getElementById('l-program-recipe-select').value;
  const durationMins = document.getElementById('l-program-duration').value;
  const temperatureC = document.getElementById('l-program-temp').value;
  const waterLevelLiters = document.getElementById('l-program-water').value;
  const spinSpeedRpm = document.getElementById('l-program-spin').value;
  const description = document.getElementById('l-program-desc').value;

  try {
    notify('جاري إضافة برنامج تشغيل جديد...');
    const res = await apiFetch('/laundry/machines/programs', 'POST', {
      machineId: parseInt(machineId),
      programName,
      recommendedCapacity: recommendedCapacity ? parseFloat(recommendedCapacity) : null,
      maximumCapacity: maximumCapacity ? parseFloat(maximumCapacity) : null,
      recipeId: recipeId ? parseInt(recipeId) : null,
      durationMins: durationMins ? parseInt(durationMins) : null,
      temperatureC: temperatureC ? parseFloat(temperatureC) : null,
      waterLevelLiters: waterLevelLiters ? parseFloat(waterLevelLiters) : null,
      spinSpeedRpm: spinSpeedRpm ? parseInt(spinSpeedRpm) : null,
      description,
      isActive: true
    });
    if (res.success) {
      notify('تم إضافة برنامج التشغيل بنجاح!', 'success');
      document.getElementById('laundry-program-modal').style.display = 'none';
      renderLaundryConfigurations();
    }
  } catch (err) {
    notify('فشل إضافة برنامج التشغيل: ' + err.message, 'error');
  }
}

async function deleteProgram(id) {
  if (!confirm('هل أنت متأكد من حذف برنامج التشغيل هذا؟')) return;
  try {
    notify('جاري حذف برنامج التشغيل...');
    const res = await apiFetch(`/laundry/machines/programs/${id}`, 'DELETE');
    if (res.success) {
      notify('تم حذف برنامج التشغيل بنجاح!', 'success');
      renderLaundryConfigurations();
    }
  } catch (err) {
    notify('فشل حذف البرنامج: ' + err.message, 'error');
  }
}

function openNewRecipeModal() {
  try {
    laundryRecipeChemLines = [];
    renderRecipeChemLinesTable();

    // Build datalist for searchable chemical input using DocumentFragment (O(n) not O(n²))
    const datalist = document.getElementById('l-recipe-chem-datalist');
    const searchInput = document.getElementById('l-recipe-chem-search');
    if (datalist && searchInput) {
      datalist.innerHTML = '';
      searchInput.value = '';
      document.getElementById('l-recipe-chem-select').value = '';

      if (typeof localItemsList !== 'undefined' && Array.isArray(localItemsList)) {
        const fragment = document.createDocumentFragment();
        const chemicals = localItemsList.filter(i => i && i.itemType === 'consumable');
        chemicals.forEach(c => {
          if (c && c.itemCode) {
            const opt = document.createElement('option');
            opt.value = `${c.itemCode} - ${(c.itemNameAr || c.itemNameEn || '')}`;
            opt.setAttribute('data-code', c.itemCode);
            fragment.appendChild(opt);
          }
        });
        datalist.appendChild(fragment);
      }

      // Attach input change handler to resolve itemCode from search text
      searchInput.oninput = function() {
        const val = this.value;
        const hidden = document.getElementById('l-recipe-chem-select');
        // Extract itemCode from selected datalist value (format: "CODE - Name")
        const dashIdx = val.indexOf(' - ');
        if (dashIdx > 0) {
          hidden.value = val.substring(0, dashIdx).trim();
        } else {
          hidden.value = val.trim();
        }
      };
    }

    const form = document.getElementById('l-recipe-form');
    if (form) form.reset();

    const modal = document.getElementById('laundry-recipe-modal');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    console.error('Crash in openNewRecipeModal:', err);
    notify('فشل فتح شاشة الوصفة: ' + err.message, 'error');
  }
}

function addRecipeChemicalLine() {
  try {
    const hiddenSelect = document.getElementById('l-recipe-chem-select');
    const searchInput = document.getElementById('l-recipe-chem-search');
    const itemCode = hiddenSelect ? hiddenSelect.value : '';
    
    if (!itemCode) {
      notify('يرجى اختيار المادة الكيميائية أولاً — اكتب للبحث ثم اختر من القائمة', 'error');
      return;
    }

    // Extract chemical name from search input text
    const searchVal = searchInput ? searchInput.value : '';
    const dashIdx = searchVal.indexOf(' - ');
    const itemName = dashIdx > 0 ? searchVal.substring(dashIdx + 3).trim() : itemCode;
    
    const qtyInput = document.getElementById('l-recipe-chem-qty');
    const modeSelect = document.getElementById('l-recipe-chem-mode');
    if (!qtyInput || !modeSelect) return;

    const qty = parseFloat(qtyInput.value);
    const mode = modeSelect.value;

    if (!itemCode || isNaN(qty) || qty <= 0) {
      notify('يرجى اختيار المادة الكيميائية وتحديد الكمية بشكل صحيح', 'error');
      return;
    }

    if (laundryRecipeChemLines.some(l => l.chemicalItemCode === itemCode)) {
      notify('هذه المادة الكيميائية مضافة بالفعل بالوصفة', 'error');
      return;
    }

    laundryRecipeChemLines.push({
      chemicalItemCode: itemCode,
      chemicalName: itemName,
      expectedQty: qty,
      minQty: qty * 0.9,
      maxQty: qty * 1.1,
      isRequired: true,
      calculationMode: mode
    });

    renderRecipeChemLinesTable();
    if (searchInput) searchInput.value = '';
    if (hiddenSelect) hiddenSelect.value = '';
    document.getElementById('l-recipe-chem-qty').value = '';
  } catch (err) {
    console.error('Crash in addRecipeChemicalLine:', err);
    notify('فشل إضافة المادة الكيميائية: ' + err.message, 'error');
  }
}

function removeRecipeChemLine(index) {
  laundryRecipeChemLines.splice(index, 1);
  renderRecipeChemLinesTable();
}

function renderRecipeChemLinesTable() {
  const container = document.getElementById('l-recipe-lines-body');
  if (!container) return;
  container.innerHTML = '';
  if (laundryRecipeChemLines.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">لم يتم إضافة مواد كيميائية بعد</td></tr>';
    return;
  }
  laundryRecipeChemLines.forEach((l, index) => {
    const modeText = l.calculationMode === 'chemical_per_kg' ? 'لكل 1 كجم غسيل' : 'كمية ثابتة للدورة';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="padding:6px;">${l.chemicalName} (${l.chemicalItemCode})</td>
      <td style="padding:6px; font-weight:700;">${l.expectedQty} جم</td>
      <td style="padding:6px;">${modeText}</td>
      <td style="padding:6px; text-align:center;"><button type="button" class="btn btn-secondary" onclick="removeRecipeChemLine(${index})" style="padding:2px 6px; background:#fee2e2; color:#ef4444; border:none;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    container.appendChild(row);
  });
}

async function submitLaundryRecipe(e) {
  e.preventDefault();
  const recipeName = document.getElementById('l-recipe-name').value;
  const mode = document.getElementById('l-recipe-mode').value;
  const description = document.getElementById('l-recipe-desc').value;

  if (laundryRecipeChemLines.length === 0) {
    notify('يرجى إضافة مادة كيميائية واحدة على الأقل بالوصفة', 'error');
    return;
  }

  try {
    notify('جاري إضافة الوصفة الكيميائية...');
    const res = await apiFetch('/laundry/recipes', 'POST', {
      recipeName,
      mode,
      description,
      isActive: true,
      items: laundryRecipeChemLines
    });
    if (res.success) {
      notify('تم إضافة الوصفة الكيميائية بنجاح!', 'success');
      document.getElementById('laundry-recipe-modal').style.display = 'none';
      renderLaundryConfigurations();
    }
  } catch (err) {
    notify('فشل إضافة الوصفة الكيميائية: ' + err.message, 'error');
  }
}

async function deleteRecipe(id) {
  if (!confirm('هل أنت متأكد من حذف الوصفة الكيميائية هذه؟')) return;
  try {
    notify('جاري حذف الوصفة الكيميائية...');
    const res = await apiFetch(`/laundry/recipes/${id}`, 'DELETE');
    if (res.success) {
      notify('تم حذف الوصفة الكيميائية بنجاح!', 'success');
      renderLaundryConfigurations();
    }
  } catch (err) {
    notify('فشل حذف الوصفة الكيميائية: ' + err.message, 'error');
  }
}

async function renderLaundryNodeTab(nodeId) {
  const outstandingContainer = document.getElementById('laundry-node-outstanding-body');
  const historyContainer = document.getElementById('laundry-node-history-body');

  if (!outstandingContainer || !historyContainer) return;

  outstandingContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأرصدة المعلقة...</td></tr>';
  historyContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل سجل الحركات...</td></tr>';

  try {
    // 1. Fetch Node Reconciliation
    const reconRes = await apiFetch(`/laundry/reports/reconciliation/${nodeId}`);
    if (reconRes.success && reconRes.data) {
      outstandingContainer.innerHTML = '';
      const items = reconRes.data.filter(r => r.inProgressQty > 0);
      if (items.length === 0) {
        outstandingContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد بياضات معلقة بالمغسلة حالياً</td></tr>';
      } else {
        items.forEach(r => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-weight:700; color:var(--text-muted);">${r.itemCode}</td>
            <td style="font-weight:700; color:var(--text-main);">${r.itemNameAr}</td>
            <td style="text-align:center;">${r.sentQty}</td>
            <td style="text-align:center; color:#10b981; font-weight:700;">${r.returnedQty}</td>
            <td style="text-align:center; color:var(--primary); font-weight:800; font-size:13px;">${r.inProgressQty}</td>
          `;
          outstandingContainer.appendChild(row);
        });
      }
    }

    // 2. Fetch transfers & returns to build history
    const [transfersRes, returnsRes] = await Promise.all([
      apiFetch('/laundry/transfers'),
      apiFetch('/laundry/returns')
    ]);

    if (transfersRes.success && transfersRes.data) {
      // Filter transfers for this warehouse
      const myTransfers = transfersRes.data.filter(t => t.fromWarehouseId === nodeId);
      const myTransferIds = myTransfers.map(t => t.id);

      // Filter returns belonging to my transfers
      const myReturns = (returnsRes.success && returnsRes.data) 
        ? returnsRes.data.filter(r => myTransferIds.includes(r.transferId))
        : [];

      // Combine and format
      const historyList = [];

      myTransfers.forEach(t => {
        historyList.push({
          id: `TR-LND-${t.id}`,
          type: 'شحن للمغسلة',
          status: t.status,
          notes: t.notes || '-',
          date: t.createdAt,
          rawDate: new Date(t.createdAt)
        });
      });

      myReturns.forEach(r => {
        historyList.push({
          id: `RTN-LND-${r.id}`,
          type: 'مرتجع من المغسلة',
          status: r.status,
          notes: r.notes || `مرتجع للشحنة رقم TR-LND-${r.transferId}`,
          date: r.createdAt,
          rawDate: new Date(r.createdAt)
        });
      });

      // Sort by date descending
      historyList.sort((a, b) => b.rawDate - a.rawDate);

      historyContainer.innerHTML = '';
      if (historyList.length === 0) {
        historyContainer.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">لا توجد حركات مسجلة مع المغسلة لهذا المستودع</td></tr>';
      } else {
        historyList.forEach(h => {
          let badgeClass = 'badge-type-internal_transfer';
          let statusName = h.status;

          if (h.status === 'completed' || h.status === 'verified' || h.status === 'received') {
            badgeClass = 'badge-type-consumption';
            statusName = 'مكتمل ومؤكد';
          } else if (h.status === 'sent') {
            badgeClass = 'badge-type-inbound';
            statusName = 'قيد الغسيل هناك';
          } else if (h.status === 'draft') {
            badgeClass = 'badge-type-internal_transfer';
            statusName = 'مسودة شحن';
          }

          const dateFormatted = h.date ? new Date(h.date).toLocaleString('ar-EG') : '-';

          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-weight:700; color:var(--primary);">${h.id}</td>
            <td style="font-weight:700; color:var(--text-main);">${h.type}</td>
            <td><span class="badge ${badgeClass}">${statusName}</span></td>
            <td>${h.notes}</td>
            <td>${dateFormatted}</td>
          `;
          historyContainer.appendChild(row);
        });
      }
    }
  } catch (err) {
    console.error('Failed to render laundry node status:', err);
    if (outstandingContainer) outstandingContainer.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">خطأ: ${err.message}</td></tr>`;
    if (historyContainer) historyContainer.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444;">خطأ: ${err.message}</td></tr>`;
  }
}
