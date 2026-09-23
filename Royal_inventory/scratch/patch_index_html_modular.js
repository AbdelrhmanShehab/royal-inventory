const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../public/index.html');
console.log('Reading index.html from:', targetPath);

let html = fs.readFileSync(targetPath, 'utf8');

// 1. Replace style block with stylesheet link
console.log('Replacing inline style block...');
html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/css/style.css">');

// 2. Replace script block with script src link at the bottom
console.log('Replacing inline script block...');
html = html.replace(/<script>[\s\S]*?<\/script>/, '<script src="/js/app.js"></script>');

// 3. Add IDs to the stats card labels
console.log('Updating stats cards labels...');
const oldStatsGrid = `<div class="stats-grid">
          <div class="stat-card">
            <h3>إجمالي المخزون</h3>
            <div class="value" id="card-total-stock">0</div>
          </div>
          <div class="stat-card">
            <h3>أنواع العناصر</h3>
            <div class="value" id="card-item-types">0</div>
          </div>
          <div class="stat-card">
            <h3>الوحدات التابعة</h3>
            <div class="value" id="card-subunits">0</div>
          </div>
        </div>`;

const newStatsGrid = `<div class="stats-grid">
          <div class="stat-card">
            <h3 id="card-total-stock-label">إجمالي المخزون</h3>
            <div class="value" id="card-total-stock">0</div>
          </div>
          <div class="stat-card">
            <h3 id="card-item-types-label">أنواع العناصر</h3>
            <div class="value" id="card-item-types">0</div>
          </div>
          <div class="stat-card">
            <h3 id="card-subunits-label">الوحدات التابعة</h3>
            <div class="value" id="card-subunits">0</div>
          </div>
        </div>`;

if (html.includes(oldStatsGrid)) {
  html = html.replace(oldStatsGrid, newStatsGrid);
} else {
  // Let's do a more robust regex replace just in case of whitespace differences
  html = html.replace(
    /<h3>إجمالي المخزون<\/h3>([\s\S]*?)<h3>أنواع العناصر<\/h3>([\s\S]*?)<h3>الوحدات التابعة<\/h3>/,
    '<h3 id="card-total-stock-label">إجمالي المخزون</h3>$1<h3 id="card-item-types-label">أنواع العناصر</h3>$2<h3 id="card-subunits-label">الوحدات التابعة</h3>'
  );
}

// 4. Update tab buttons inside explorer table card
console.log('Updating explorer view tab buttons...');
const oldTabsBlock = `<div style="display:flex; gap:10px; border-bottom:2px solid #e2e8f0; margin-bottom:15px;">
            <button class="tab-btn active" id="tab-btn-stock" onclick="switchExplorerTab('stock')">الأصناف الحالية</button>
            <button class="tab-btn" id="tab-btn-movement" onclick="switchExplorerTab('movement')">ملخص حركة المستودع (تقرير القيمة)</button>
          </div>`;

const newTabsBlock = `<div style="display:flex; gap:10px; border-bottom:2px solid #e2e8f0; margin-bottom:15px;">
            <button class="tab-btn active" id="tab-btn-stock" onclick="switchExplorerTab('stock')">الأصناف الحالية</button>
            <button class="tab-btn" id="tab-btn-movement" onclick="switchExplorerTab('movement')">ملخص حركة المستودع (تقرير القيمة)</button>
            <button class="tab-btn" id="tab-btn-transactions" onclick="switchExplorerTab('transactions')" style="display:none;">سجل العمليات</button>
          </div>`;

if (html.includes(oldTabsBlock)) {
  html = html.replace(oldTabsBlock, newTabsBlock);
} else {
  // Fallback regex in case of white-space differences
  html = html.replace(
    /id="tab-btn-movement" onclick="switchExplorerTab\('movement'\)">ملخص حركة المستودع \(تقرير القيمة\)<\/button>\s*<\/div>/,
    'id="tab-btn-movement" onclick="switchExplorerTab(\'movement\')">ملخص حركة المستودع (تقرير القيمة)</button>\n            <button class="tab-btn" id="tab-btn-transactions" onclick="switchExplorerTab(\'transactions\')" style="display:none;">سجل العمليات</button>\n          </div>'
  );
}

// 5. Append Tab 2.5 (Subunits content) and Tab 3 (Transactions content) right after Tab 2
console.log('Inserting Subunits and Ledger tab panels...');
const oldTab2End = `<tbody id="movement-report-body">
                  <!-- Dynamic report rows -->
                </tbody>
              </table>
            </div>
          </div>`;

const newTab2End = `<tbody id="movement-report-body">
                  <!-- Dynamic report rows -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tab 2.5: Parent Sub-Warehouses Grid (Subunits Tab Content) -->
          <div id="explorer-subunits-tab-content" style="display:none;">
            <div style="font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:15px;">
              <i class="fa-solid fa-hotel"></i> المستودعات الفرعية والعهد التشغيلية التابعة لهذا المجلد
            </div>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr style="background:#f8fafc;">
                    <th>كود المستودع</th>
                    <th>اسم المستودع</th>
                    <th>مشرف العهدة</th>
                    <th>حالة المزامنة</th>
                    <th>إجمالي كميات الأصناف</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody id="parent-subunits-body">
                  <!-- Loaded dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tab 3: Warehouse Ledger (Transactions Tab Content) -->
          <div id="explorer-transactions-tab-content" style="display:none;">
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px; justify-content:space-between;">
              <div style="font-size:12px; color:var(--text-muted); font-weight:600;">
                <i class="fa-solid fa-clock-rotate-left"></i> سجل العمليات التشغيلية المنفذة في هذا المستودع
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr style="background:#f8fafc;">
                    <th>رقم الحركة</th>
                    <th>نوع الحركة</th>
                    <th>التاريخ</th>
                    <th>المنشئ</th>
                    <th>البيان / الملاحظات</th>
                    <th>الحالة</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody id="node-transactions-body">
                  <!-- Loaded dynamically -->
                </tbody>
              </table>
            </div>
          </div>`;

if (html.includes(oldTab2End)) {
  html = html.replace(oldTab2End, newTab2End);
} else {
  // Regex alternative
  html = html.replace(
    /<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<!-- RIGHT AREA: Tree navigation/,
    '</table>\n            </div>\n          </div>\n\n          ' + newTab2End.substring(newTab2End.indexOf('<!-- Tab 2.5')) + '\n\n        </div>\n      </div>\n      <!-- RIGHT AREA: Tree navigation'
  );
}

fs.writeFileSync(targetPath, html, 'utf8');
console.log('index.html patched and modularized successfully!');
