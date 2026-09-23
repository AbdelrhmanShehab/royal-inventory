'use strict';
/**
 * test_workflow.js — full end-to-end approval flow test
 * Finds a node with actual stock, creates a transfer, and walks the full 5-stage pipeline.
 * Run: node scripts/test_workflow.js
 */
const http = require('http');

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

const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');

async function step(label, fn) {
  process.stdout.write(`\n[STEP] ${label}... `);
  try {
    const result = await fn();
    if (result && result.body && result.body.success === false) {
      console.log(`❌ FAILED (HTTP ${result.status}): ${result.body.message}`);
      return null;
    }
    console.log(`✅ OK`);
    if (result && result.body && result.body.data !== undefined) return result.body.data;
    return result ? result.body : result;
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('='.repeat(65));
  console.log('  Royal Inventory — Full Transfer Approval Workflow Test');
  console.log('='.repeat(65));

  // Connect DB to find a real stocked item
  await connectSystemDB();
  const pool = getSystemDB();

  const stockRows = await pool.request().query(`
    SELECT TOP 3 os.node_id, os.item_code, os.qty_operational,
           n.node_name_ar, n.parent_node_id
    FROM ops.operational_stock os
    INNER JOIN ops.inventory_nodes n ON os.node_id = n.node_id
    WHERE os.qty_operational >= 1 AND n.node_type = 'child' AND n.is_active = 1
    ORDER BY os.qty_operational DESC
  `);

  if (!stockRows.recordset.length) {
    console.log('\n❌ No stock found in the system. Cannot test dispatch step. Exiting.');
    process.exit(1);
  }

  const sourceRow = stockRows.recordset[0];
  console.log(`\n📦 Found stocked item: [${sourceRow.item_code}] Qty=${sourceRow.qty_operational} in Node ${sourceRow.node_id} (${sourceRow.node_name_ar})`);

  // Find another node in the same group as destination
  const destRows = await pool.request()
    .input('srcNodeId', sql.Int, sourceRow.node_id)
    .query(`
      SELECT TOP 1 node_id, node_name_ar FROM ops.inventory_nodes
      WHERE node_type = 'child' AND is_active = 1 AND node_id != @srcNodeId
      ORDER BY node_id ASC
    `);

  if (!destRows.recordset.length) {
    console.log('\n❌ No destination node found. Need at least 2 child nodes. Exiting.');
    process.exit(1);
  }
  const destRow = destRows.recordset[0];
  console.log(`🏭 Destination: Node ${destRow.node_id} (${destRow.node_name_ar})`);

  // 1. Login
  const loginData = await step('Login as admin (password: 123456)', () =>
    apiCall('POST', '/auth/login', { username: 'admin', password: '123456' })
  );
  if (!loginData || !loginData.accessToken) {
    console.log('\n❌ Login failed. Aborting.'); process.exit(1);
  }
  const token = loginData.accessToken;
  console.log(`   Role: ${loginData.user.role} | NodeId: ${loginData.user.nodeId || 'N/A (admin)'}`);

  // 2. Create Draft
  const draftData = await step('Create internal_transfer DRAFT', () =>
    apiCall('POST', '/transactions/transfers', {
      txnType: 'internal_transfer',
      fromNodeId: sourceRow.node_id,
      toNodeId: destRow.node_id,
      notes: 'Automated workflow test — E2E verification',
      lines: [{ itemCode: sourceRow.item_code, quantity: 1, unitCost: 0 }]
    }, token)
  );
  if (!draftData || !draftData.txnId) { console.log('\n❌ Draft creation failed.'); process.exit(1); }
  const txnId = draftData.txnId;

  const verifyStatus = async (expected) => {
    const r = await apiCall('GET', `/transactions/transfers/${txnId}`, null, token);
    const st = r.body.data?.status;
    if (st === expected) {
      console.log(`   ✔ Status confirmed: ${st}`);
      return true;
    }
    console.log(`   ⚠ Expected ${expected}, got: ${st}`);
    return false;
  };

  // 3. Verify draft
  await step(`Verify status = "draft" on #${txnId}`, async () => {
    await verifyStatus('draft'); return { body: { success: true } };
  });

  // 4. Submit for approval
  await step('Submit for management approval (draft → pending_approval)', () =>
    apiCall('POST', `/transactions/transfers/${txnId}/submit-approval`, {}, token)
  );
  await verifyStatus('pending_approval');

  // 5. Approve
  await step('Admin approves transfer (pending_approval → approved)', () =>
    apiCall('POST', `/transactions/transfers/${txnId}/approve`, {}, token)
  );
  await verifyStatus('approved');

  // 6. Dispatch
  await step('Dispatch from source warehouse (approved → shipped)', () =>
    apiCall('POST', `/transactions/transfers/${txnId}/dispatch`, {}, token)
  );
  await verifyStatus('shipped');

  // 7. Receive
  await step('Confirm receipt at destination (shipped → confirmed)', () =>
    apiCall('POST', `/transactions/transfers/${txnId}/receive`, {}, token)
  );
  const finalOk = await verifyStatus('confirmed');

  // Summary
  console.log('\n' + '='.repeat(65));
  if (finalOk) {
    console.log('  ✅ ALL STEPS PASSED — Full 5-stage workflow is working correctly!');
    console.log('  Pipeline: draft → pending_approval → approved → shipped → confirmed');
  } else {
    console.log('  ⚠️  WORKFLOW INCOMPLETE — some steps failed or status mismatch');
  }
  console.log('='.repeat(65) + '\n');
  process.exit(finalOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
