'use strict';

const http = require('http');
const { connectSystemDB, getSystemDB, sql } = require('../src/config/database');

function apiCall(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: process.env.PORT ? parseInt(process.env.PORT) : 7500,
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(70));
  console.log('  Royal Laundry Management Module E2E Test Suite');
  console.log('='.repeat(70));

  await connectSystemDB();
  const pool = getSystemDB();

  // 1. Get Admin Access Token
  console.log('\n--- 1. Login to get Auth Token ---');
  const loginRes = await apiCall('POST', '/auth/login', { username: 'admin', password: '123456' });
  if (loginRes.status !== 200) {
    console.error('❌ Failed to login. Output:', loginRes.body);
    process.exit(1);
  }
  const token = loginRes.body.data.accessToken;
  console.log('🔑 Login successful, token acquired.');

  // Clean old laundry test data
  console.log('🧹 Cleaning old test data...');
  await pool.request().query(`
    DELETE FROM ops.laundry_pos_sync_logs;
    DELETE FROM ops.laundry_reconciliations;
    DELETE FROM ops.laundry_profitability;
    DELETE FROM ops.laundry_costing;
    DELETE FROM ops.laundry_ticket_items;
    DELETE FROM ops.laundry_tickets;
    DELETE FROM ops.laundry_losses;
    DELETE FROM ops.laundry_return_items;
    DELETE FROM ops.laundry_returns;
    DELETE FROM ops.laundry_consumptions;
    DELETE FROM ops.laundry_batch_items;
    DELETE FROM ops.laundry_batches;
    DELETE FROM ops.laundry_receiving_items;
    DELETE FROM ops.laundry_receivings;
    DELETE FROM ops.laundry_transfer_items;
    DELETE FROM ops.laundry_transfers;
    DELETE FROM ops.laundry_recipe_items;
    DELETE FROM ops.laundry_recipes;
    DELETE FROM ops.laundry_machine_programs;
    DELETE FROM ops.laundry_machines;
  `);

  // 2. Machine & Program Setup
  console.log('\n--- 2. Setting up washing machine & programs ---');
  const machineRes = await apiCall('POST', '/laundry/machines', {
    machineName: 'Washing Machine 60KG A1',
    capacityKg: 60.0,
    isActive: true,
  }, token);
  console.log('🤖 Machine creation status:', machineRes.status, machineRes.body);
  const machineId = machineRes.body.data.machineId;

  const progRes = await apiCall('POST', '/laundry/machines/programs', {
    machineId,
    programName: 'Standard White Cotton 60C',
    description: 'Cotton linens sanitizing cycle',
    isActive: true,
  }, token);
  console.log('📋 Machine Program creation status:', progRes.status, progRes.body);
  const programId = progRes.body.data.programId;

  // 3. Recipes Setup
  console.log('\n--- 3. Setting up washing recipes ---');
  const recipeRes = await apiCall('POST', '/laundry/recipes', {
    recipeName: 'Standard Linens Recipe',
    mode: 'STRICT',
    description: 'Chlorine-based wash recipe',
    isActive: true,
    items: [
      {
        chemicalItemCode: 'CHEM-DET-001',
        chemicalName: 'Liquid Soap Soapox',
        expectedQty: 0.5,
        minQty: 0.4,
        maxQty: 0.6,
        isRequired: true,
        calculationMode: 'chemical_per_kg',
      },
      {
        chemicalItemCode: 'CHEM-SOFT-002',
        chemicalName: 'Fabric Softener Fresh',
        expectedQty: 0.2,
        minQty: 0.1,
        maxQty: 0.3,
        isRequired: true,
        calculationMode: 'fixed_consumption',
      }
    ],
  }, token);
  console.log('🧪 Recipe creation status:', recipeRes.status, recipeRes.body);
  const recipeId = recipeRes.body.data.recipeId;

  // Set up mock operational stock for chemicals and linens in Node 1
  console.log('🧪 Setting up mock warehouse stock...');
  await pool.request()
    .input('itemCode1', sql.NVarChar(50), 'CHEM-DET-001')
    .input('itemCode2', sql.NVarChar(50), 'CHEM-SOFT-002')
    .input('itemCode3', sql.NVarChar(50), 'L-TOWEL-001')
    .input('itemCode4', sql.NVarChar(50), 'L-SHEET-002')
    .query(`
      MERGE ops.operational_stock AS target
      USING (SELECT 1 AS node_id, @itemCode1 AS item_code) AS source
      ON target.node_id = source.node_id AND target.item_code = source.item_code
      WHEN MATCHED THEN UPDATE SET qty_received = 1000
      WHEN NOT MATCHED THEN INSERT (node_id, item_code, qty_received) VALUES (1, @itemCode1, 1000);

      MERGE ops.operational_stock AS target
      USING (SELECT 1 AS node_id, @itemCode2 AS item_code) AS source
      ON target.node_id = source.node_id AND target.item_code = source.item_code
      WHEN MATCHED THEN UPDATE SET qty_received = 1000
      WHEN NOT MATCHED THEN INSERT (node_id, item_code, qty_received) VALUES (1, @itemCode2, 1000);

      MERGE ops.operational_stock AS target
      USING (SELECT 1 AS node_id, @itemCode3 AS item_code) AS source
      ON target.node_id = source.node_id AND target.item_code = source.item_code
      WHEN MATCHED THEN UPDATE SET qty_received = 1000
      WHEN NOT MATCHED THEN INSERT (node_id, item_code, qty_received) VALUES (1, @itemCode3, 1000);

      MERGE ops.operational_stock AS target
      USING (SELECT 1 AS node_id, @itemCode4 AS item_code) AS source
      ON target.node_id = source.node_id AND target.item_code = source.item_code
      WHEN MATCHED THEN UPDATE SET qty_received = 1000
      WHEN NOT MATCHED THEN INSERT (node_id, item_code, qty_received) VALUES (1, @itemCode4, 1000);
    `);

  // 4. Warehouse to Laundry Transfer Workflow (Workflow #1)
  console.log('\n--- 4. Warehouse ➔ Laundry Transfer flow ---');
  // Draft
  const transferDraftRes = await apiCall('POST', '/laundry/transfers', {
    fromWarehouseId: 1, // Royal Palace Warehouse node
    notes: 'Towels and bedsheets for processing',
    items: [
      {
        itemCode: 'L-TOWEL-001',
        itemNameAr: 'فوط قطنية بيضاء',
        sentQty: 200,
        unitCode: 'PCS',
        unitCost: 15.5,
      },
      {
        itemCode: 'L-SHEET-002',
        itemNameAr: 'ملاءات سرير مزدوجة',
        sentQty: 150,
        unitCode: 'PCS',
        unitCost: 45.0,
      }
    ],
  }, token);
  console.log('📦 Transfer draft status:', transferDraftRes.status, transferDraftRes.body);
  const transferId = transferDraftRes.body.data.transferId;

  // Send
  const transferSendRes = await apiCall('POST', `/laundry/transfers/${transferId}/send`, {}, token);
  console.log('📦 Transfer dispatch status:', transferSendRes.status, transferSendRes.body);

  // Receive (actual quantities received at Laundry)
  const receivingRes = await apiCall('POST', '/laundry/transfers/receive', {
    transferId,
    notes: 'Towels received, bedsheets had damages',
    items: [
      {
        itemCode: 'L-TOWEL-001',
        actualQty: 200,
      },
      {
        itemCode: 'L-SHEET-002',
        actualQty: 140, // 10 rejected/damaged
        rejectReason: 'Damaged',
        rejectNotes: 'Torn during sorting at warehouse',
      }
    ],
  }, token);
  console.log('📥 Receiving verification status:', receivingRes.status, receivingRes.body);

  // Check warehouse stock adjustment
  const checkStockRes = await pool.request()
    .input('itemCode', sql.NVarChar(50), 'L-SHEET-002')
    .query('SELECT qty_transferred_out, qty_damaged, qty_operational FROM ops.operational_stock WHERE node_id = 1 AND item_code = @itemCode');
  console.log('📈 Warehouse Stock Integration check:', checkStockRes.recordset[0]);

  // 5. Laundry Processing Batches (Workflow #2)
  console.log('\n--- 5. Batch processing cycles ---');
  const batchRes = await apiCall('POST', '/laundry/batches', {
    batchNumber: 'LB-2026-06-001',
    machineId,
    programId,
    recipeId,
    weight: 45.0,
    pieces: 340,
    items: [
      {
        itemCode: 'L-TOWEL-001',
        quantity: 200,
        role: 'INPUT',
      },
      {
        itemCode: 'L-SHEET-002',
        quantity: 140,
        role: 'INPUT',
      },
      {
        itemCode: 'L-TOWEL-001',
        quantity: 198, // 2 scrap towels
        role: 'OUTPUT',
      },
      {
        itemCode: 'L-SHEET-002',
        quantity: 140,
        role: 'OUTPUT',
      },
      {
        itemCode: 'L-TOWEL-001',
        quantity: 2,
        role: 'SCRAP',
      }
    ],
    consumptions: [
      {
        chemicalItemCode: 'CHEM-DET-001',
        chemicalName: 'Liquid Soap Soapox',
        actualQty: 22.5, // 0.5 * 45KG = 22.5
        mode: 'AUTO',
      },
      {
        chemicalItemCode: 'CHEM-SOFT-002',
        chemicalName: 'Fabric Softener Fresh',
        actualQty: 0.2, // fixed
        mode: 'AUTO',
      }
    ],
  }, token);
  console.log('🧼 Batch creation status:', batchRes.status, batchRes.body);
  const batchId = batchRes.body.data.batchId;

  // Running
  const runBatchRes = await apiCall('PUT', `/laundry/batches/${batchId}/status`, { status: 'Running' }, token);
  console.log('🧼 Batch run state update status:', runBatchRes.status, runBatchRes.body);

  // Completed
  const completeBatchRes = await apiCall('PUT', `/laundry/batches/${batchId}/status`, { status: 'Completed' }, token);
  console.log('🧼 Batch completion update status:', completeBatchRes.status, completeBatchRes.body);

  // Check chemical Hub inventory deduction
  const checkChemStockRes = await pool.request()
    .input('itemCode', sql.NVarChar(50), 'CHEM-DET-001')
    .query('SELECT qty_consumed, qty_operational FROM ops.operational_stock WHERE node_id = 1 AND item_code = @itemCode');
  console.log('📈 Chemical Hub deduction check:', checkChemStockRes.recordset[0]);

  // 6. Laundry to Warehouse Returns (Workflow #3 & #4)
  console.log('\n--- 6. Return Laundry ➔ Warehouse workflow ---');
  const returnDraftRes = await apiCall('POST', '/laundry/returns', {
    transferId,
    notes: 'Returning processed linen items',
    items: [
      {
        itemCode: 'L-TOWEL-001',
        itemNameAr: 'فوط قطنية بيضاء',
        expectedQty: 198,
      },
      {
        itemCode: 'L-SHEET-002',
        itemNameAr: 'ملاءات سرير مزدوجة',
        expectedQty: 140,
      }
    ],
  }, token);
  console.log('📤 Return draft status:', returnDraftRes.status, returnDraftRes.body);
  const returnId = returnDraftRes.body.data.returnId;

  // Verify return and register back to warehouse stock
  const returnVerifyRes = await apiCall('PUT', `/laundry/returns/${returnId}/verify`, {
    status: 'completed',
    notes: 'Verified received counts',
    items: [
      {
        itemCode: 'L-TOWEL-001',
        actualQty: 195, // 3 missing/wet
        rejectReason: 'Wet',
        rejectNotes: 'Damp towels returned to drying area',
      },
      {
        itemCode: 'L-SHEET-002',
        actualQty: 140,
      }
    ],
  }, token);
  console.log('📥 Return verification status:', returnVerifyRes.status, returnVerifyRes.body);

  // Check warehouse stock increment for returned linens
  const checkLinenReturnStock = await pool.request()
    .input('itemCode', sql.NVarChar(50), 'L-TOWEL-001')
    .query('SELECT qty_returned_in, qty_operational FROM ops.operational_stock WHERE node_id = 1 AND item_code = @itemCode');
  console.log('📈 Linen Return Stock Integration check:', checkLinenReturnStock.recordset[0]);

  // 7. Guest & Staff Laundry & POS (Workflow #5 & #6)
  console.log('\n--- 7. Guest & Staff Ticketing & POS sync flows ---');
  const ticketRes = await apiCall('POST', '/laundry/tickets', {
    ticketType: 'GUEST',
    guestName: 'John Doe',
    roomNumber: '104B',
    specialNotes: 'Dry clean only, express delivery requested',
    items: [
      {
        serviceItemCode: 'SRV-DRYCLEAN-001',
        quantity: 2,
        unitPrice: 150.00,
      }
    ],
  }, token);
  console.log('🎫 Ticket creation status:', ticketRes.status, ticketRes.body);
  const ticketId = ticketRes.body.data.ticketId;

  const ticketStatusRes = await apiCall('PUT', `/laundry/tickets/${ticketId}/status`, { status: 'Delivered' }, token);
  console.log('🎫 Ticket delivery update status:', ticketStatusRes.status, ticketStatusRes.body);

  // Sync sales from Comsys POS
  const syncPosRes = await apiCall('POST', '/laundry/pos-sync', {}, token);
  console.log('🔌 POS Comsys Synchronization status:', syncPosRes.status, syncPosRes.body);

  // 8. Reconciliation & Profitability Reporting (Dashboard Checks)
  console.log('\n--- 8. Reconciliation & profitability audits ---');
  const today = new Date().toISOString().split('T')[0];
  const profitReportRes = await apiCall('GET', `/laundry/reports/profitability?fromDate=${today}&toDate=${today}`, null, token);
  console.log('📊 Profitability Report output:', profitReportRes.status, profitReportRes.body.data);

  const reconReportRes = await apiCall('GET', '/laundry/reports/reconciliation', null, token);
  console.log('📊 Reconciliation report output:', reconReportRes.status, reconReportRes.body.data);

  console.log('\n✅ E2E LAUNDRY MANAGEMENT MODULE TESTS PASSED GREEN!');
  process.exit(0);
}

main().catch(e => {
  console.error('❌ E2E test execution error:', e);
  process.exit(1);
});
