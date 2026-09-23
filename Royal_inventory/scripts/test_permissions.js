'use strict';
/**
 * Test: DB-driven permission checks
 * Verifies that hasPermission() reads correctly from ops.role_permissions
 */
const { connectSystemDB } = require('../src/config/database');
const { hasPermission, getMatrix } = require('../src/services/permissions.cache');

connectSystemDB().then(async () => {
  console.log('\n=== Testing DB-driven permissions cache ===\n');

  const tests = [
    // [role, permKey, expectedResult]
    ['admin',             'create_draft',       true],
    ['admin',             'manage_permissions', true],
    ['staff',             'submit_approval',    false],
    ['staff',             'create_draft',       true],
    ['staff',             'quick_consume',      true],
    ['warehouse_manager', 'approve_transfer',   true],
    ['warehouse_manager', 'manage_nodes',       false],
    ['accountant',        'view_reports',       true],
    ['accountant',        'create_draft',       false],
    ['warehouse_head',    'dispatch_transfer',  true],
    ['warehouse_head',    'approve_transfer',   false],
  ];

  let passed = 0; let failed = 0;
  for (const [role, permKey, expected] of tests) {
    const result = await hasPermission(role, permKey);
    const ok = result === expected;
    const icon = ok ? '✅' : '❌';
    console.log(`${icon} ${role.padEnd(20)} | ${permKey.padEnd(22)} | expected=${expected} got=${result}`);
    if (ok) passed++; else failed++;
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
