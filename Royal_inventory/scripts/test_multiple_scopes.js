'use strict';
/**
 * test_multiple_scopes.js — verifies many-to-many user node assignment logic.
 * Run: node scripts/test_multiple_scopes.js
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
  console.log('  Royal Inventory — Multiple Warehouse Scoping Test');
  console.log('='.repeat(70));

  await connectSystemDB();
  const pool = getSystemDB();

  // Create temporary hashed password
  const pwHash = await bcrypt.hash('123456', 12);

  // Clean old test users
  await pool.request().query("DELETE FROM ops.app_users WHERE username IN ('test_mgr_multi', 'test_staff_multi')");

  // 1. Create a user with multiple unrelated nodes:
  // Node 2 (Child of Parent Node 1) and Node 6 (Child of Parent Node 1, Parent of Node 7)
  // Let's create it in database directly
  await pool.request()
    .input('hash', sql.NVarChar(255), pwHash)
    .query(`
      INSERT INTO ops.app_users (username, full_name_ar, password_hash, role, node_id, is_active, created_at, updated_at)
      VALUES ('test_mgr_multi', 'مدير متعدد الصلاحيات', @hash, 'warehouse_manager', 2, 1, GETDATE(), GETDATE())
    `);

  const userResult = await pool.request().query("SELECT user_id FROM ops.app_users WHERE username = 'test_mgr_multi'");
  const userId = userResult.recordset[0].user_id;

  // Insert multiple scopes into junction table
  // Assign Node 2, Node 6 (which includes child Node 7 recursively)
  await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      INSERT INTO ops.user_nodes (user_id, node_id)
      VALUES 
        (@userId, 2),
        (@userId, 6)
    `);

  console.log('✅ Temporary user "test_mgr_multi" created with node assignments: [2, 6]');

  // 2. Login as test_mgr_multi
  console.log('\n--- 1. Login & Tree Check: test_mgr_multi ---');
  const loginRes = await apiCall('POST', '/auth/login', { username: 'test_mgr_multi', password: '123456' });
  if (!loginRes.body.success) {
    console.error('❌ Login failed:', loginRes.body.message);
    process.exit(1);
  }
  const token = loginRes.body.data.accessToken;
  console.log('🔑 Login OK. Token acquired.');

  // Fetch tree under group 1 (which includes nodes 1, 2, 3, 4, 5, 6, 7, 8)
  const treeRes = await apiCall('GET', '/hierarchy/tree?groupId=1', null, token);
  
  // Since user is scoped to Node 2 (child) and Node 6 (parent containing child 7)
  // The returned nodes should be Node 2 and Node 6 (with Node 7 as child).
  // Node 1 (Root parent) is NOT visible, Node 3, 4, 5, 8 are NOT visible.
  console.log('\n🌳 Returned Tree nodes for Multi-scoped User:');
  const groupData = treeRes.body.data;
  console.log(`   Group: ${groupData.groupNameAr}`);
  
  const nodes = groupData.nodes;
  console.log(`   Root-level nodes in tree: ${nodes.length}`);
  
  const printTree = (nodesList, prefix = '   ') => {
    for (const n of nodesList) {
      console.log(`${prefix}• ${n.nodeNameAr} (ID: ${n.id}, Type: ${n.nodeType})`);
      if (n.children && n.children.length > 0) {
        printTree(n.children, prefix + '  ');
      }
    }
  };
  printTree(nodes);

  // Assertions:
  const ids = [];
  const collectIds = (nodesList) => {
    for (const n of nodesList) {
      ids.push(n.id);
      if (n.children) collectIds(n.children);
    }
  };
  collectIds(nodes);

  console.log('\n🔎 Scope Assertions:');
  const expectedIds = [2, 6, 7];
  const missingIds = expectedIds.filter(id => !ids.includes(id));
  const forbiddenIds = ids.filter(id => !expectedIds.includes(id));

  let testFailed = false;
  if (missingIds.length === 0 && forbiddenIds.length === 0) {
    console.log('   ✅ SUCCESS: User has access to exactly expected nodes [2, 6, 7] (including recursive descendants).');
  } else {
    console.error(`   ❌ FAILED: Missing ids: [${missingIds.join(', ')}], Forbidden ids seen: [${forbiddenIds.join(', ')}]`);
    testFailed = true;
  }

  // 3. Test ON DELETE NO ACTION protection:
  console.log('\n--- 2. Database Referential Integrity Check ---');
  try {
    // Attempt to delete Node 6 which is linked in ops.user_nodes
    await pool.request().input('nodeId', sql.Int, 6).query('DELETE FROM ops.inventory_nodes WHERE node_id = @nodeId');
    console.error('❌ FAILURE: Was able to delete Node 6 even though it has active user assignments! (Expected foreign key violation)');
    testFailed = true;
  } catch (err) {
    if (err.message.includes('REFERENCE constraint') || err.message.includes('conflict')) {
      console.log('   ✅ SUCCESS: DB prevented deleting Node 6 (REFERENCE constraint triggered as expected).');
    } else {
      console.error('   ❌ FAILED: Unexpected database error: ', err.message);
      testFailed = true;
    }
  }

  // Clean up
  await pool.request().query("DELETE FROM ops.app_users WHERE username IN ('test_mgr_multi')");
  console.log('\n🗑️ Cleaned up temporary test users.');
  process.exit(testFailed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
