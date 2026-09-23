'use strict';
/**
 * test_user_scoping.js — verifies that users linked to parent nodes see all descendants,
 * and users linked to child nodes see only their own node.
 */
const http = require('http');
const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');
const bcrypt = require('bcryptjs');

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3000,
      path: '/api/v1' + path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  Royal Inventory — Hierarchical Scoping Test');
  console.log('='.repeat(70));

  await connectSystemDB();
  const pool = getSystemDB();

  // Create two temporary test users if they don't exist
  // User 1: scoped to Parent Node 1
  // User 2: scoped to Child Node 2
  const pwHash = await bcrypt.hash('123456', 12);

  // Clean old test users
  await pool.request().query("DELETE FROM ops.app_users WHERE username IN ('test_mgr_1', 'test_staff_2')");

  await pool.request()
    .input('hash', sql.NVarChar(255), pwHash)
    .query(`
      INSERT INTO ops.app_users (username, full_name_ar, password_hash, role, node_id, is_active, created_at, updated_at)
      VALUES 
        ('test_mgr_1', 'مدير عام جاردن الأب', @hash, 'warehouse_manager', 1, 1, GETDATE(), GETDATE()),
        ('test_staff_2', 'موظف مطبخ جاردن', @hash, 'staff', 2, 1, GETDATE(), GETDATE())
    `);
  console.log('✅ Temporary test users created:');
  console.log("   - test_mgr_1 (Manager of Garden Parent - Node 1)");
  console.log("   - test_staff_2 (Staff of Garden Kitchen Child - Node 2)");

  // 1. Login as test_mgr_1
  console.log('\n--- 1. Login & Tree Check: test_mgr_1 ---');
  const mgrLogin = await apiCall('POST', '/auth/login', { username: 'test_mgr_1', password: '123456' });
  const mgrToken = mgrLogin.body.data.accessToken;
  console.log(`🔑 Login OK as test_mgr_1. Token acquired.`);

  const mgrTree = await apiCall('GET', '/hierarchy/tree?groupId=1', null, mgrToken);
  const mgrNodes = mgrTree.body.data.nodes;
  console.log(`🌳 Tree root for Manager: ${mgrNodes[0]?.nodeNameAr} (ID: ${mgrNodes[0]?.id})`);
  console.log(`   Number of children under root: ${mgrNodes[0]?.children?.length || 0}`);
  
  // Recursively list names
  const listNames = (n, prefix = '') => {
    console.log(`   ${prefix}• ${n.nodeNameAr} [${n.nodeType}] (ID: ${n.id})`);
    if (n.children) {
      n.children.forEach(c => listNames(c, prefix + '  '));
    }
  };
  mgrNodes.forEach(rn => listNames(rn));

  // 2. Login as test_staff_2
  console.log('\n--- 2. Login & Tree Check: test_staff_2 ---');
  const staffLogin = await apiCall('POST', '/auth/login', { username: 'test_staff_2', password: '123456' });
  const staffToken = staffLogin.body.data.accessToken;
  console.log(`🔑 Login OK as test_staff_2. Token acquired.`);

  const staffTree = await apiCall('GET', '/hierarchy/tree?groupId=1', null, staffToken);
  const staffNodes = staffTree.body.data.nodes;
  console.log(`🌳 Tree nodes for Staff:`);
  staffNodes.forEach(rn => listNames(rn));

  // Clean up
  await pool.request().query("DELETE FROM ops.app_users WHERE username IN ('test_mgr_1', 'test_staff_2')");
  console.log('\n🗑️ Cleaned up temporary test users.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
