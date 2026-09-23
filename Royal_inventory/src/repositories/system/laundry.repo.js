'use strict';

const { getSystemDB, sql } = require('../../config/database');
const { DatabaseError } = require('../../utils/errors');

/**
 * Laundry Repository — Manages all database CRUD for the Laundry Module.
 * Supports running inside database transactions by accepting an optional connection parameter.
 */

// ─── 1. MACHINES & PROGRAMS ───────────────────────────────────────────────────

const createMachine = async ({ machineName, capacityKg, isActive = 1 }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('machineName', sql.NVarChar(100), machineName)
      .input('capacityKg', sql.Decimal(18, 2), capacityKg)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO ops.laundry_machines (machine_name, capacity_kg, is_active, created_at)
        OUTPUT INSERTED.machine_id AS machineId
        VALUES (@machineName, @capacityKg, @isActive, GETDATE())
      `);
    return result.recordset[0].machineId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry machine: ${err.message}`);
  }
};

const getMachines = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT machine_id AS id, machine_name AS name, capacity_kg AS capacity, is_active AS isActive
      FROM ops.laundry_machines
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to get laundry machines: ${err.message}`);
  }
};

const getMachineById = async (machineId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('machineId', sql.Int, machineId)
      .query(`
        SELECT machine_id AS id, machine_name AS name, capacity_kg AS capacity, is_active AS isActive
        FROM ops.laundry_machines
        WHERE machine_id = @machineId
      `);
    return result.recordset[0] ?? null;
  } catch (err) {
    throw new DatabaseError(`Failed to get machine: ${err.message}`);
  }
};

const createProgram = async ({ 
  machineId, 
  programName, 
  description = null, 
  recommendedCapacity = null, 
  maximumCapacity = null, 
  recipeId = null, 
  durationMins = null, 
  temperatureC = null, 
  waterLevelLiters = null, 
  spinSpeedRpm = null, 
  isActive = 1 
}, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('machineId', sql.Int, machineId)
      .input('programName', sql.NVarChar(100), programName)
      .input('description', sql.NVarChar(500), description)
      .input('recommendedCapacity', sql.Decimal(18, 2), recommendedCapacity)
      .input('maximumCapacity', sql.Decimal(18, 2), maximumCapacity)
      .input('recipeId', sql.Int, recipeId)
      .input('durationMins', sql.Int, durationMins)
      .input('temperatureC', sql.Decimal(18, 2), temperatureC)
      .input('waterLevelLiters', sql.Decimal(18, 2), waterLevelLiters)
      .input('spinSpeedRpm', sql.Int, spinSpeedRpm)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO ops.laundry_machine_programs (
          machine_id, program_name, description, recommended_capacity, maximum_capacity,
          recipe_id, duration_mins, temperature_c, water_level_liters, spin_speed_rpm, is_active, created_at
        )
        OUTPUT INSERTED.program_id AS programId
        VALUES (
          @machineId, @programName, @description, @recommendedCapacity, @maximumCapacity,
          @recipeId, @durationMins, @temperatureC, @waterLevelLiters, @spinSpeedRpm, @isActive, GETDATE()
        )
      `);
    return result.recordset[0].programId;
  } catch (err) {
    throw new DatabaseError(`Failed to create machine program: ${err.message}`);
  }
};

const getProgramsByMachine = async (machineId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('machineId', sql.Int, machineId)
      .query(`
        SELECT program_id AS id, machine_id AS machineId, program_name AS name, description, 
               recommended_capacity AS recommendedCapacity, maximum_capacity AS maximumCapacity,
               recipe_id AS recipeId, duration_mins AS durationMins, temperature_c AS temperatureC,
               water_level_liters AS waterLevelLiters, spin_speed_rpm AS spinSpeedRpm, is_active AS isActive
        FROM ops.laundry_machine_programs
        WHERE machine_id = @machineId
      `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to get programs for machine ${machineId}: ${err.message}`);
  }
};

// ─── 2. RECIPES & RECIPE ITEMS ────────────────────────────────────────────────

const createRecipe = async ({ recipeName, mode, description = null, isActive = 1 }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('recipeName', sql.NVarChar(100), recipeName)
      .input('mode', sql.NVarChar(20), mode)
      .input('description', sql.NVarChar(500), description)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO ops.laundry_recipes (recipe_name, mode, description, is_active, created_at)
        OUTPUT INSERTED.recipe_id AS recipeId
        VALUES (@recipeName, @mode, @description, @isActive, GETDATE())
      `);
    return result.recordset[0].recipeId;
  } catch (err) {
    throw new DatabaseError(`Failed to create recipe: ${err.message}`);
  }
};

const createRecipeItem = async ({ recipeId, chemicalItemCode, chemicalName, expectedQty, minQty, maxQty, isRequired = 1, calculationMode }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('recipeId', sql.Int, recipeId)
      .input('chemicalItemCode', sql.NVarChar(50), chemicalItemCode)
      .input('chemicalName', sql.NVarChar(200), chemicalName)
      .input('expectedQty', sql.Decimal(18, 4), expectedQty)
      .input('minQty', sql.Decimal(18, 4), minQty)
      .input('maxQty', sql.Decimal(18, 4), maxQty)
      .input('isRequired', sql.Bit, isRequired)
      .input('calculationMode', sql.NVarChar(30), calculationMode)
      .query(`
        INSERT INTO ops.laundry_recipe_items (recipe_id, chemical_item_code, chemical_name, expected_qty, min_qty, max_qty, is_required, calculation_mode)
        VALUES (@recipeId, @chemicalItemCode, @chemicalName, @expectedQty, @minQty, @maxQty, @isRequired, @calculationMode)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create recipe item: ${err.message}`);
  }
};

const getRecipes = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT recipe_id AS id, recipe_name AS name, mode, description, is_active AS isActive
      FROM ops.laundry_recipes
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch recipes: ${err.message}`);
  }
};

const getRecipeById = async (recipeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('recipeId', sql.Int, recipeId)
      .query(`
        SELECT recipe_id AS id, recipe_name AS name, mode, description, is_active AS isActive
        FROM ops.laundry_recipes
        WHERE recipe_id = @recipeId
      `);
    const recipe = result.recordset[0] ?? null;
    if (recipe) {
      const itemsResult = await pool.request()
        .input('recipeId', sql.Int, recipeId)
        .query(`
          SELECT recipe_item_id AS itemId, chemical_item_code AS chemicalItemCode, chemical_name AS chemicalName,
                 expected_qty AS expectedQty, min_qty AS minQty, max_qty AS maxQty,
                 is_required AS isRequired, calculation_mode AS calculationMode
          FROM ops.laundry_recipe_items
          WHERE recipe_id = @recipeId
        `);
      recipe.items = itemsResult.recordset;
    }
    return recipe;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch recipe by ID: ${err.message}`);
  }
};

// ─── 3. TRANSFERS ─────────────────────────────────────────────────────────────

const createTransfer = async ({ fromWarehouseId, status = 'draft', notes = null, createdBy }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('fromWarehouseId', sql.Int, fromWarehouseId)
      .input('status', sql.NVarChar(30), status)
      .input('notes', sql.NVarChar(500), notes)
      .input('createdBy', sql.Int, createdBy)
      .query(`
        INSERT INTO ops.laundry_transfers (from_warehouse_id, status, notes, created_by, created_at, updated_at)
        OUTPUT INSERTED.transfer_id AS transferId
        VALUES (@fromWarehouseId, @status, @notes, @createdBy, GETDATE(), GETDATE())
      `);
    return result.recordset[0].transferId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry transfer: ${err.message}`);
  }
};

const createTransferItem = async ({ transferId, itemCode, itemNameAr, sentQty, receivedQty = 0, remainingQty, unitCode = null, unitCost = 0 }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('transferId', sql.Int, transferId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('itemNameAr', sql.NVarChar(200), itemNameAr)
      .input('sentQty', sql.Decimal(18, 4), sentQty)
      .input('receivedQty', sql.Decimal(18, 4), receivedQty)
      .input('remainingQty', sql.Decimal(18, 4), remainingQty)
      .input('unitCode', sql.NVarChar(20), unitCode)
      .input('unitCost', sql.Decimal(18, 4), unitCost)
      .query(`
        INSERT INTO ops.laundry_transfer_items (transfer_id, item_code, item_name_ar, sent_qty, received_qty, remaining_qty, unit_code, unit_cost)
        VALUES (@transferId, @itemCode, @itemNameAr, @sentQty, @receivedQty, @remainingQty, @unitCode, @unitCost)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry transfer item: ${err.message}`);
  }
};

const getTransferById = async (transferId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('transferId', sql.Int, transferId)
      .query(`
        SELECT t.transfer_id AS id, t.from_warehouse_id AS fromWarehouseId, n.node_name_ar AS fromWarehouseName,
               t.status, t.notes, t.created_by AS createdBy, u.username AS creatorUsername,
               t.created_at AS createdAt, t.updated_at AS updatedAt
        FROM ops.laundry_transfers t
        INNER JOIN ops.inventory_nodes n ON t.from_warehouse_id = n.node_id
        INNER JOIN ops.app_users u ON t.created_by = u.user_id
        WHERE t.transfer_id = @transferId
      `);
    const header = headerResult.recordset[0] ?? null;
    if (header) {
      const itemsResult = await pool.request()
        .input('transferId', sql.Int, transferId)
        .query(`
          SELECT ti.transfer_item_id AS itemId, ti.item_code AS itemCode, ti.item_name_ar AS itemNameAr,
                 ti.sent_qty AS sentQty, ti.received_qty AS receivedQty,
                 (ti.received_qty - ISNULL((
                    SELECT SUM(CASE WHEN r.status = 'completed' THEN ri.actual_qty ELSE ri.expected_qty END)
                    FROM ops.laundry_return_items ri
                    INNER JOIN ops.laundry_returns r ON ri.return_id = r.return_id
                    WHERE r.transfer_id = ti.transfer_id AND ri.item_code = ti.item_code AND r.status != 'rejected'
                 ), 0)) AS remainingQty,
                 ti.unit_code AS unitCode, ti.unit_cost AS unitCost
          FROM ops.laundry_transfer_items ti
          WHERE ti.transfer_id = @transferId
        `);
      header.items = itemsResult.recordset;
    }
    return header;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry transfer: ${err.message}`);
  }
};

const getTransfers = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT t.transfer_id AS id, t.from_warehouse_id AS fromWarehouseId, n.node_name_ar AS fromWarehouseName,
             t.status, t.notes, t.created_by AS createdBy, u.username AS creatorUsername,
             t.created_at AS createdAt, t.updated_at AS updatedAt,
             r.return_id AS returnId, r.status AS returnStatus
      FROM ops.laundry_transfers t
      INNER JOIN ops.inventory_nodes n ON t.from_warehouse_id = n.node_id
      INNER JOIN ops.app_users u ON t.created_by = u.user_id
      LEFT JOIN ops.laundry_returns r ON t.transfer_id = r.transfer_id
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch transfers: ${err.message}`);
  }
};

const updateTransferStatus = async (transferId, status, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('transferId', sql.Int, transferId)
      .input('status', sql.NVarChar(30), status)
      .query(`
        UPDATE ops.laundry_transfers
        SET status = @status, updated_at = GETDATE()
        WHERE transfer_id = @transferId
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update transfer status: ${err.message}`);
  }
};

const updateTransferItemReceivedQty = async (transferId, itemCode, receivedQty, remainingQty, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('transferId', sql.Int, transferId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('receivedQty', sql.Decimal(18, 4), receivedQty)
      .input('remainingQty', sql.Decimal(18, 4), remainingQty)
      .query(`
        UPDATE ops.laundry_transfer_items
        SET received_qty = @receivedQty, remaining_qty = @remainingQty
        WHERE transfer_id = @transferId AND item_code = @itemCode
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update transfer item quantities: ${err.message}`);
  }
};

// ─── 4. RECEIVINGS ────────────────────────────────────────────────────────────

const createReceiving = async ({ transferId, receivedBy, notes = null }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('transferId', sql.Int, transferId)
      .input('receivedBy', sql.Int, receivedBy)
      .input('notes', sql.NVarChar(500), notes)
      .query(`
        INSERT INTO ops.laundry_receivings (transfer_id, received_by, notes, created_at)
        OUTPUT INSERTED.receiving_id AS receivingId
        VALUES (@transferId, @receivedBy, @notes, GETDATE())
      `);
    return result.recordset[0].receivingId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry receiving: ${err.message}`);
  }
};

const createReceivingItem = async ({ receivingId, itemCode, expectedQty, actualQty, rejectedQty, rejectReason = null, rejectNotes = null }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('receivingId', sql.Int, receivingId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('expectedQty', sql.Decimal(18, 4), expectedQty)
      .input('actualQty', sql.Decimal(18, 4), actualQty)
      .input('rejectedQty', sql.Decimal(18, 4), rejectedQty)
      .input('rejectReason', sql.NVarChar(100), rejectReason)
      .input('rejectNotes', sql.NVarChar(500), rejectNotes)
      .query(`
        INSERT INTO ops.laundry_receiving_items (receiving_id, item_code, expected_qty, actual_qty, rejected_qty, reject_reason, reject_notes)
        VALUES (@receivingId, @itemCode, @expectedQty, @actualQty, @rejectedQty, @rejectReason, @rejectNotes)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry receiving item: ${err.message}`);
  }
};

const getReceivingById = async (receivingId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('receivingId', sql.Int, receivingId)
      .query(`
        SELECT r.receiving_id AS id, r.transfer_id AS transferId, r.received_by AS receivedBy,
               u.username AS receiverUsername, r.notes, r.created_at AS createdAt
        FROM ops.laundry_receivings r
        INNER JOIN ops.app_users u ON r.received_by = u.user_id
        WHERE r.receiving_id = @receivingId
      `);
    const header = headerResult.recordset[0] ?? null;
    if (header) {
      const itemsResult = await pool.request()
        .input('receivingId', sql.Int, receivingId)
        .query(`
          SELECT receiving_item_id AS itemId, item_code AS itemCode, expected_qty AS expectedQty,
                 actual_qty AS actualQty, rejected_qty AS rejectedQty, reject_reason AS rejectReason, reject_notes AS rejectNotes
          FROM ops.laundry_receiving_items
          WHERE receiving_id = @receivingId
        `);
      header.items = itemsResult.recordset;
    }
    return header;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch receiving details: ${err.message}`);
  }
};

// ─── 5. BATCHES & BATCH ITEMS ─────────────────────────────────────────────────

const createBatch = async ({ 
  batchNumber, 
  runType = 'PROGRAM',
  machineId = null, 
  programId = null, 
  recipeId = null, 
  weight = 0.00, 
  pieces = 0, 
  guestWeight = 0.00,
  staffWeight = 0.00,
  specialWeight = 0.00,
  spotWeight = 0.00,
  status = 'Pending', 
  operatorId 
}, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('batchNumber', sql.NVarChar(50), batchNumber)
      .input('runType', sql.NVarChar(20), runType)
      .input('machineId', sql.Int, machineId)
      .input('programId', sql.Int, programId)
      .input('recipeId', sql.Int, recipeId)
      .input('weight', sql.Decimal(18, 2), weight)
      .input('pieces', sql.Int, pieces)
      .input('guestWeight', sql.Decimal(18, 2), guestWeight)
      .input('staffWeight', sql.Decimal(18, 2), staffWeight)
      .input('specialWeight', sql.Decimal(18, 2), specialWeight)
      .input('spotWeight', sql.Decimal(18, 2), spotWeight)
      .input('status', sql.NVarChar(20), status)
      .input('operatorId', sql.Int, operatorId)
      .query(`
        INSERT INTO ops.laundry_batches (
          batch_number, run_type, machine_id, program_id, recipe_id, weight, pieces, 
          guest_weight, staff_weight, special_weight, spot_weight, status, operator_id, created_at
        )
        OUTPUT INSERTED.batch_id AS batchId
        VALUES (
          @batchNumber, @runType, @machineId, @programId, @recipeId, @weight, @pieces,
          @guestWeight, @staffWeight, @specialWeight, @spotWeight, @status, @operatorId, GETDATE()
        )
      `);
    return result.recordset[0].batchId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry batch: ${err.message}`);
  }
};

const createBatchItem = async ({ batchId, itemCode, quantity, role }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('batchId', sql.Int, batchId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('quantity', sql.Decimal(18, 4), quantity)
      .input('role', sql.NVarChar(20), role)
      .query(`
        INSERT INTO ops.laundry_batch_items (batch_id, item_code, quantity, role)
        VALUES (@batchId, @itemCode, @quantity, @role)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry batch item: ${err.message}`);
  }
};

const getBatchById = async (batchId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('batchId', sql.Int, batchId)
      .query(`
        SELECT b.batch_id AS id, b.batch_number AS batchNumber, b.run_type AS runType, b.machine_id AS machineId, m.machine_name AS machineName,
               b.program_id AS programId, p.program_name AS programName, b.recipe_id AS recipeId, r.recipe_name AS recipeName,
               b.weight, b.pieces, b.guest_weight AS guestWeight, b.staff_weight AS staffWeight, 
               b.special_weight AS specialWeight, b.spot_weight AS spotWeight,
               b.status, b.operator_id AS operatorId, u.username AS operatorUsername,
               b.started_at AS startedAt, b.finished_at AS finishedAt, b.created_at AS createdAt
        FROM ops.laundry_batches b
        LEFT JOIN ops.laundry_machines m ON b.machine_id = m.machine_id
        LEFT JOIN ops.laundry_machine_programs p ON b.program_id = p.program_id
        LEFT JOIN ops.laundry_recipes r ON b.recipe_id = r.recipe_id
        INNER JOIN ops.app_users u ON b.operator_id = u.user_id
        WHERE b.batch_id = @batchId
      `);
    const header = headerResult.recordset[0] ?? null;
    if (header) {
      const itemsResult = await pool.request()
        .input('batchId', sql.Int, batchId)
        .query(`
          SELECT batch_item_id AS itemId, item_code AS itemCode, quantity, role
          FROM ops.laundry_batch_items
          WHERE batch_id = @batchId
        `);
      header.items = itemsResult.recordset;
    }
    return header;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry batch: ${err.message}`);
  }
};

const getBatches = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT b.batch_id AS id, b.batch_number AS batchNumber, b.run_type AS runType, b.machine_id AS machineId, m.machine_name AS machineName,
             b.program_id AS programId, p.program_name AS programName, b.recipe_id AS recipeId, r.recipe_name AS recipeName,
             b.weight, b.pieces, b.guest_weight AS guestWeight, b.staff_weight AS staffWeight,
             b.special_weight AS specialWeight, b.spot_weight AS spotWeight,
             b.status, b.operator_id AS operatorId, u.username AS operatorUsername,
             b.started_at AS startedAt, b.finished_at AS finishedAt, b.created_at AS createdAt
      FROM ops.laundry_batches b
      LEFT JOIN ops.laundry_machines m ON b.machine_id = m.machine_id
      LEFT JOIN ops.laundry_machine_programs p ON b.program_id = p.program_id
      LEFT JOIN ops.laundry_recipes r ON b.recipe_id = r.recipe_id
      INNER JOIN ops.app_users u ON b.operator_id = u.user_id
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch batches: ${err.message}`);
  }
};

const updateBatchStatus = async (batchId, status, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const startedAtUpdate = status === 'Running' ? ', started_at = GETDATE()' : '';
    const finishedAtUpdate = status === 'Completed' || status === 'Cancelled' ? ', finished_at = GETDATE()' : '';
    await client.request()
      .input('batchId', sql.Int, batchId)
      .input('status', sql.NVarChar(20), status)
      .query(`
        UPDATE ops.laundry_batches
        SET status = @status ${startedAtUpdate} ${finishedAtUpdate}
        WHERE batch_id = @batchId
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update batch status: ${err.message}`);
  }
};

// ─── 6. CHEMICAL CONSUMPTIONS ─────────────────────────────────────────────────

const createConsumption = async ({ batchId, chemicalItemCode, chemicalName, expectedQty, actualQty, mode }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const variance = actualQty - expectedQty;
    await client.request()
      .input('batchId', sql.Int, batchId)
      .input('chemicalItemCode', sql.NVarChar(50), chemicalItemCode)
      .input('chemicalName', sql.NVarChar(200), chemicalName)
      .input('expectedQty', sql.Decimal(18, 4), expectedQty)
      .input('actualQty', sql.Decimal(18, 4), actualQty)
      .input('variance', sql.Decimal(18, 4), variance)
      .input('mode', sql.NVarChar(20), mode)
      .query(`
        INSERT INTO ops.laundry_consumptions (batch_id, chemical_item_code, chemical_name, expected_qty, actual_qty, variance, mode, created_at)
        VALUES (@batchId, @chemicalItemCode, @chemicalName, @expectedQty, @actualQty, @variance, @mode, GETDATE())
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry consumption record: ${err.message}`);
  }
};

const getConsumptionsByBatch = async (batchId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('batchId', sql.Int, batchId)
      .query(`
        SELECT consumption_id AS id, batch_id AS batchId, chemical_item_code AS chemicalItemCode,
               chemical_name AS chemicalName, expected_qty AS expectedQty, actual_qty AS actualQty,
               variance, mode, created_at AS createdAt
        FROM ops.laundry_consumptions
        WHERE batch_id = @batchId
      `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch consumptions for batch: ${err.message}`);
  }
};

// ─── 7. RETURNS ───────────────────────────────────────────────────────────────

const createReturn = async ({ transferId, status = 'draft', notes = null, createdBy }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('transferId', sql.Int, transferId)
      .input('status', sql.NVarChar(30), status)
      .input('notes', sql.NVarChar(500), notes)
      .input('createdBy', sql.Int, createdBy)
      .query(`
        INSERT INTO ops.laundry_returns (transfer_id, status, notes, created_by, created_at)
        OUTPUT INSERTED.return_id AS returnId
        VALUES (@transferId, @status, @notes, @createdBy, GETDATE())
      `);
    return result.recordset[0].returnId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry return header: ${err.message}`);
  }
};

const createReturnItem = async ({ returnId, itemCode, itemNameAr, expectedQty, actualQty = 0, rejectedQty = 0, rejectReason = null, rejectNotes = null }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('returnId', sql.Int, returnId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('itemNameAr', sql.NVarChar(200), itemNameAr)
      .input('expectedQty', sql.Decimal(18, 4), expectedQty)
      .input('actualQty', sql.Decimal(18, 4), actualQty)
      .input('rejectedQty', sql.Decimal(18, 4), rejectedQty)
      .input('rejectReason', sql.NVarChar(100), rejectReason)
      .input('rejectNotes', sql.NVarChar(500), rejectNotes)
      .query(`
        INSERT INTO ops.laundry_return_items (return_id, item_code, item_name_ar, expected_qty, actual_qty, rejected_qty, reject_reason, reject_notes)
        VALUES (@returnId, @itemCode, @itemNameAr, @expectedQty, @actualQty, @rejectedQty, @rejectReason, @rejectNotes)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry return item: ${err.message}`);
  }
};

const getReturnById = async (returnId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('returnId', sql.Int, returnId)
      .query(`
        SELECT r.return_id AS id, r.transfer_id AS transferId, r.status, r.notes,
               r.created_by AS createdBy, u.username AS creatorUsername, r.created_at AS createdAt
        FROM ops.laundry_returns r
        INNER JOIN ops.app_users u ON r.created_by = u.user_id
        WHERE r.return_id = @returnId
      `);
    const header = headerResult.recordset[0] ?? null;
    if (header) {
      const itemsResult = await pool.request()
        .input('returnId', sql.Int, returnId)
        .query(`
          SELECT return_item_id AS itemId, item_code AS itemCode, item_name_ar AS itemNameAr,
                 expected_qty AS expectedQty, actual_qty AS actualQty, rejected_qty AS rejectedQty,
                 reject_reason AS rejectReason, reject_notes AS rejectNotes
          FROM ops.laundry_return_items
          WHERE return_id = @returnId
        `);
      header.items = itemsResult.recordset;
    }
    return header;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry return details: ${err.message}`);
  }
};

const getReturns = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT r.return_id AS id, r.transfer_id AS transferId, r.status, r.notes,
             r.created_by AS createdBy, u.username AS creatorUsername, r.created_at AS createdAt
      FROM ops.laundry_returns r
      INNER JOIN ops.app_users u ON r.created_by = u.user_id
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch all laundry returns: ${err.message}`);
  }
};

const updateReturnStatus = async (returnId, status, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('returnId', sql.Int, returnId)
      .input('status', sql.NVarChar(30), status)
      .query(`
        UPDATE ops.laundry_returns
        SET status = @status
        WHERE return_id = @returnId
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update laundry return status: ${err.message}`);
  }
};

const updateReturnItemActualQty = async (returnId, itemCode, actualQty, rejectedQty, rejectReason = null, rejectNotes = null, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('returnId', sql.Int, returnId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('actualQty', sql.Decimal(18, 4), actualQty)
      .input('rejectedQty', sql.Decimal(18, 4), rejectedQty)
      .input('rejectReason', sql.NVarChar(100), rejectReason)
      .input('rejectNotes', sql.NVarChar(500), rejectNotes)
      .query(`
        UPDATE ops.laundry_return_items
        SET actual_qty = @actualQty, rejected_qty = @rejectedQty,
            reject_reason = @rejectReason, reject_notes = @rejectNotes
        WHERE return_id = @returnId AND item_code = @itemCode
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update return item quantities: ${err.message}`);
  }
};

// ─── 8. LOSSES ────────────────────────────────────────────────────────────────

const createLoss = async ({ itemCode, itemNameAr, quantity, reason, cost, approvedBy, batchId = null }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('itemNameAr', sql.NVarChar(200), itemNameAr)
      .input('quantity', sql.Decimal(18, 4), quantity)
      .input('reason', sql.NVarChar(100), reason)
      .input('cost', sql.Decimal(18, 4), cost)
      .input('approvedBy', sql.Int, approvedBy)
      .input('batchId', sql.Int, batchId)
      .query(`
        INSERT INTO ops.laundry_losses (item_code, item_name_ar, quantity, reason, cost, approved_by, batch_id, created_at)
        OUTPUT INSERTED.loss_id AS lossId
        VALUES (@itemCode, @itemNameAr, @quantity, @reason, @cost, @approvedBy, @batchId, GETDATE())
      `);
    return result.recordset[0].lossId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry loss record: ${err.message}`);
  }
};

const getLosses = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT l.loss_id AS id, l.item_code AS itemCode, l.item_name_ar AS itemNameAr,
             l.quantity, l.reason, l.cost, l.approved_by AS approvedBy, u.username AS approverUsername,
             l.batch_id AS batchId, l.created_at AS createdAt
      FROM ops.laundry_losses l
      INNER JOIN ops.app_users u ON l.approved_by = u.user_id
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry loss records: ${err.message}`);
  }
};

// ─── 9. TICKETS (Guest & Staff) ───────────────────────────────────────────────

const createTicket = async ({ ticketType, guestName = null, roomNumber = null, employeeId = null, specialNotes = null, deliveryTime = null, status = 'Received', posSaleId = null, createdBy }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    const result = await client.request()
      .input('ticketType', sql.NVarChar(20), ticketType)
      .input('guestName', sql.NVarChar(100), guestName)
      .input('roomNumber', sql.NVarChar(20), roomNumber)
      .input('employeeId', sql.Int, employeeId)
      .input('specialNotes', sql.NVarChar(500), specialNotes)
      .input('deliveryTime', sql.DateTime2, deliveryTime)
      .input('status', sql.NVarChar(20), status)
      .input('posSaleId', sql.Int, posSaleId)
      .input('createdBy', sql.Int, createdBy)
      .query(`
        INSERT INTO ops.laundry_tickets (ticket_type, guest_name, room_number, employee_id, special_notes, delivery_time, status, pos_sale_id, created_by, created_at, updated_at)
        OUTPUT INSERTED.ticket_id AS ticketId
        VALUES (@ticketType, @guestName, @roomNumber, @employeeId, @specialNotes, @deliveryTime, @status, @posSaleId, @createdBy, GETDATE(), GETDATE())
      `);
    return result.recordset[0].ticketId;
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry ticket: ${err.message}`);
  }
};

const createTicketItem = async ({ ticketId, serviceItemCode, quantity, unitPrice }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('ticketId', sql.Int, ticketId)
      .input('serviceItemCode', sql.NVarChar(50), serviceItemCode)
      .input('quantity', sql.Decimal(18, 4), quantity)
      .input('unitPrice', sql.Decimal(18, 4), unitPrice)
      .query(`
        INSERT INTO ops.laundry_ticket_items (ticket_id, service_item_code, quantity, unit_price)
        VALUES (@ticketId, @serviceItemCode, @quantity, @unitPrice)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to create laundry ticket item: ${err.message}`);
  }
};

const getTicketById = async (ticketId) => {
  try {
    const pool = getSystemDB();
    const headerResult = await pool.request()
      .input('ticketId', sql.Int, ticketId)
      .query(`
        SELECT t.ticket_id AS id, t.ticket_type AS ticketType, t.guest_name AS guestName, t.room_number AS roomNumber,
               t.employee_id AS employeeId, t.special_notes AS specialNotes, t.delivery_time AS deliveryTime,
               t.status, t.pos_sale_id AS posSaleId, t.created_by AS createdBy, u.username AS creatorUsername,
               t.created_at AS createdAt, t.updated_at AS updatedAt
        FROM ops.laundry_tickets t
        INNER JOIN ops.app_users u ON t.created_by = u.user_id
        WHERE t.ticket_id = @ticketId
      `);
    const header = headerResult.recordset[0] ?? null;
    if (header) {
      const itemsResult = await pool.request()
        .input('ticketId', sql.Int, ticketId)
        .query(`
          SELECT ticket_item_id AS itemId, service_item_code AS serviceItemCode, quantity, unit_price AS unitPrice, total_price AS totalPrice
          FROM ops.laundry_ticket_items
          WHERE ticket_id = @ticketId
        `);
      header.items = itemsResult.recordset;
    }
    return header;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry ticket: ${err.message}`);
  }
};

const getTickets = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT t.ticket_id AS id, t.ticket_type AS ticketType, t.guest_name AS guestName, t.room_number AS roomNumber,
             t.employee_id AS employeeId, t.special_notes AS specialNotes, t.delivery_time AS deliveryTime,
             t.status, t.pos_sale_id AS posSaleId, t.created_by AS createdBy, u.username AS creatorUsername,
             t.created_at AS createdAt, t.updated_at AS updatedAt
      FROM ops.laundry_tickets t
      INNER JOIN ops.app_users u ON t.created_by = u.user_id
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch laundry tickets: ${err.message}`);
  }
};

const updateTicketStatus = async (ticketId, status, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('ticketId', sql.Int, ticketId)
      .input('status', sql.NVarChar(20), status)
      .query(`
        UPDATE ops.laundry_tickets
        SET status = @status, updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update laundry ticket status: ${err.message}`);
  }
};

// ─── 10. COSTING & PROFITABILITY ──────────────────────────────────────────────

const createCosting = async ({ batchId = null, itemCode, chemicalCost, waterCost, electricityCost, laborCost, machineUsageCost, scrapCost, totalCost, costType }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('batchId', sql.Int, batchId)
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('chemicalCost', sql.Decimal(18, 4), chemicalCost)
      .input('waterCost', sql.Decimal(18, 4), waterCost)
      .input('electricityCost', sql.Decimal(18, 4), electricityCost)
      .input('laborCost', sql.Decimal(18, 4), laborCost)
      .input('machineUsageCost', sql.Decimal(18, 4), machineUsageCost)
      .input('scrapCost', sql.Decimal(18, 4), scrapCost)
      .input('totalCost', sql.Decimal(18, 4), totalCost)
      .input('costType', sql.NVarChar(20), costType)
      .query(`
        INSERT INTO ops.laundry_costing (batch_id, item_code, chemical_cost, water_cost, electricity_cost, labor_cost, machine_usage_cost, scrap_cost, total_cost, cost_type, created_at)
        VALUES (@batchId, @itemCode, @chemicalCost, @waterCost, @electricityCost, @laborCost, @machineUsageCost, @scrapCost, @totalCost, @costType, GETDATE())
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to record laundry costing: ${err.message}`);
  }
};

const createOrUpdateProfitability = async ({ date, revenue = 0, chemicalCost = 0, utilitiesCost = 0, laborCost = 0, lossCost = 0 }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('date', sql.Date, date)
      .input('revenue', sql.Decimal(18, 4), revenue)
      .input('chemicalCost', sql.Decimal(18, 4), chemicalCost)
      .input('utilitiesCost', sql.Decimal(18, 4), utilitiesCost)
      .input('laborCost', sql.Decimal(18, 4), laborCost)
      .input('lossCost', sql.Decimal(18, 4), lossCost)
      .query(`
        MERGE ops.laundry_profitability AS target
        USING (SELECT @date AS date) AS source
        ON (target.date = source.date)
        WHEN MATCHED THEN
          UPDATE SET 
            revenue = target.revenue + @revenue,
            chemical_cost = target.chemical_cost + @chemicalCost,
            utilities_cost = target.utilities_cost + @utilitiesCost,
            labor_cost = target.labor_cost + @laborCost,
            loss_cost = target.loss_cost + @lossCost
        WHEN NOT MATCHED THEN
          INSERT (date, revenue, chemical_cost, utilities_cost, labor_cost, loss_cost, created_at)
          VALUES (source.date, @revenue, @chemicalCost, @utilitiesCost, @laborCost, @lossCost, GETDATE());
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to record profitability data: ${err.message}`);
  }
};

const getProfitabilityReport = async (fromDate, toDate) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('fromDate', sql.Date, fromDate)
      .input('toDate', sql.Date, toDate)
      .query(`
        SELECT profit_id AS id, date, revenue, chemical_cost AS chemicalCost,
               utilities_cost AS utilitiesCost, labor_cost AS laborCost,
               loss_cost AS lossCost, net_profit AS netProfit
        FROM ops.laundry_profitability
        WHERE date BETWEEN @fromDate AND @toDate
        ORDER BY date ASC
      `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch profitability report: ${err.message}`);
  }
};

// ─── 11. RECONCILIATIONS ─────────────────────────────────────────────────────

const upsertReconciliation = async ({ itemCode, itemNameAr, sentQty = 0, returnedQty = 0, scrapQty = 0, inProgressQty = 0 }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('itemNameAr', sql.NVarChar(200), itemNameAr)
      .input('sentQty', sql.Decimal(18, 4), sentQty)
      .input('returnedQty', sql.Decimal(18, 4), returnedQty)
      .input('scrapQty', sql.Decimal(18, 4), scrapQty)
      .input('inProgressQty', sql.Decimal(18, 4), inProgressQty)
      .query(`
        MERGE ops.laundry_reconciliations AS target
        USING (SELECT @itemCode AS item_code) AS source
        ON (target.item_code = source.item_code)
        WHEN MATCHED THEN
          UPDATE SET 
            sent_qty = target.sent_qty + @sentQty,
            returned_qty = target.returned_qty + @returnedQty,
            scrap_qty = target.scrap_qty + @scrapQty,
            in_progress_qty = target.in_progress_qty + @inProgressQty,
            variance = (target.sent_qty + @sentQty) - (target.returned_qty + @returnedQty) - (target.scrap_qty + @scrapQty) - (target.in_progress_qty + @inProgressQty),
            reconciled_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (item_code, item_name_ar, sent_qty, returned_qty, scrap_qty, in_progress_qty, variance, alert_triggered, reconciled_at)
          VALUES (source.item_code, ISNULL(@itemNameAr, N'أصناف مغسلة'), @sentQty, @returnedQty, @scrapQty, @inProgressQty, (@sentQty - @returnedQty - @scrapQty - @inProgressQty), 0, GETDATE());
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to upsert laundry reconciliation: ${err.message}`);
  }
};

const getReconciliationReport = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT reconciliation_id AS id, item_code AS itemCode, item_name_ar AS itemNameAr,
             sent_qty AS sentQty, returned_qty AS returnedQty, scrap_qty AS scrapQty,
             in_progress_qty AS inProgressQty, variance, alert_triggered AS alertTriggered, reconciled_at AS reconciledAt
      FROM ops.laundry_reconciliations
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch reconciliation records: ${err.message}`);
  }
};

const getNodeReconciliationReport = async (nodeId) => {
  try {
    const pool = getSystemDB();
    const result = await pool.request()
      .input('nodeId', sql.Int, nodeId)
      .query(`
        SELECT 
            ti.item_code AS itemCode,
            ti.item_name_ar AS itemNameAr,
            SUM(ti.sent_qty) AS sentQty,
            SUM(ti.received_qty) AS receivedQty,
            SUM(ti.remaining_qty) AS inProgressQty,
            (
                SELECT ISNULL(SUM(ri.actual_qty), 0)
                FROM ops.laundry_returns r
                INNER JOIN ops.laundry_return_items ri ON r.return_id = ri.return_id
                WHERE r.transfer_id IN (SELECT transfer_id FROM ops.laundry_transfers WHERE from_warehouse_id = @nodeId)
                  AND ri.item_code = ti.item_code AND r.status = 'completed'
            ) AS returnedQty,
            (
                SELECT ISNULL(SUM(ri.rejected_qty), 0)
                FROM ops.laundry_returns r
                INNER JOIN ops.laundry_return_items ri ON r.return_id = ri.return_id
                WHERE r.transfer_id IN (SELECT transfer_id FROM ops.laundry_transfers WHERE from_warehouse_id = @nodeId)
                  AND ri.item_code = ti.item_code AND r.status = 'completed'
            ) AS scrapQty
        FROM ops.laundry_transfers t
        INNER JOIN ops.laundry_transfer_items ti ON t.transfer_id = ti.transfer_id
        WHERE t.from_warehouse_id = @nodeId
        GROUP BY ti.item_code, ti.item_name_ar
      `);
    return result.recordset.map(r => ({
      ...r,
      variance: r.sentQty - r.returnedQty - r.scrapQty - r.inProgressQty,
      alertTriggered: (r.sentQty - r.returnedQty - r.scrapQty - r.inProgressQty) !== 0
    }));
  } catch (err) {
    throw new DatabaseError(`Failed to fetch node reconciliation: ${err.message}`);
  }
};

const triggerReconciliationAlert = async (itemCode, alertState, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('alertState', sql.Bit, alertState)
      .query(`
        UPDATE ops.laundry_reconciliations
        SET alert_triggered = @alertState
        WHERE item_code = @itemCode
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to trigger reconciliation alert: ${err.message}`);
  }
};

// ─── 12. POS SYNC LOGS ────────────────────────────────────────────────────────

const logPosSync = async (ordersImported, status, errorMessage = null, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('ordersImported', sql.Int, ordersImported)
      .input('status', sql.NVarChar(20), status)
      .input('errorMessage', sql.NVarChar(sql.MAX), errorMessage)
      .query(`
        INSERT INTO ops.laundry_pos_sync_logs (synced_at, orders_imported, status, error_message)
        VALUES (GETDATE(), @ordersImported, @status, @errorMessage)
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to log POS sync operations: ${err.message}`);
  }
};

const getLastPosSync = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT TOP 1 sync_id AS id, synced_at AS syncedAt, orders_imported AS ordersImported, status, error_message AS errorMessage
      FROM ops.laundry_pos_sync_logs
      ORDER BY sync_id DESC
    `);
    const record = result.recordset[0] ?? null;
    if (record) {
      return {
        ...record,
        lastSyncAt: record.syncedAt,
        totalSynced: record.ordersImported || 0
      };
    }
    return null;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch last POS sync log: ${err.message}`);
  }
};

// ─── 13. AUDIT LOGS ───────────────────────────────────────────────────────────

const logLaundryAudit = async ({ userId, action, entityType, entityId, oldState = null, newState = null }, connection = null) => {
  try {
    const client = connection || getSystemDB();
    await client.request()
      .input('userId', sql.Int, userId)
      .input('action', sql.NVarChar(50), action)
      .input('entityType', sql.NVarChar(50), entityType)
      .input('entityId', sql.Int, entityId)
      .input('oldState', sql.NVarChar(sql.MAX), oldState ? JSON.stringify(oldState) : null)
      .input('newState', sql.NVarChar(sql.MAX), newState ? JSON.stringify(newState) : null)
      .query(`
        INSERT INTO ops.laundry_audit_logs (user_id, action, entity_type, entity_id, old_state, new_state, logged_at)
        VALUES (@userId, @action, @entityType, @entityId, @oldState, @newState, GETDATE())
      `);
  } catch (err) {
    // Audit failure shouldn't crash the operational flow, but we log the error
    console.error(`Audit logging failed: ${err.message}`);
  }
};

const deleteProgram = async (programId) => {
  const pool = getSystemDB();
  await pool.request()
    .input('programId', sql.Int, programId)
    .query('DELETE FROM ops.laundry_machine_programs WHERE program_id = @programId');
};

const updateProgram = async (programId, data) => {
  const pool = getSystemDB();
  await pool.request()
    .input('programId', sql.Int, programId)
    .input('programName', sql.NVarChar(100), data.programName)
    .input('description', sql.NVarChar(500), data.description || null)
    .input('recommendedCapacity', sql.Decimal(18, 2), data.recommendedCapacity || null)
    .input('maximumCapacity', sql.Decimal(18, 2), data.maximumCapacity || null)
    .input('recipeId', sql.Int, data.recipeId || null)
    .input('durationMins', sql.Int, data.durationMins || null)
    .input('temperatureC', sql.Decimal(18, 2), data.temperatureC || null)
    .input('waterLevelLiters', sql.Decimal(18, 2), data.waterLevelLiters || null)
    .input('spinSpeedRpm', sql.Int, data.spinSpeedRpm || null)
    .input('isActive', sql.Bit, data.isActive ?? 1)
    .query(`
      UPDATE ops.laundry_machine_programs
      SET program_name = @programName, 
          description = @description, 
          recommended_capacity = @recommendedCapacity, 
          maximum_capacity = @maximumCapacity,
          recipe_id = @recipeId, 
          duration_mins = @durationMins, 
          temperature_c = @temperatureC, 
          water_level_liters = @waterLevelLiters, 
          spin_speed_rpm = @spinSpeedRpm,
          is_active = @isActive
      WHERE program_id = @programId
    `);
};

const deleteRecipe = async (recipeId) => {
  const pool = getSystemDB();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    await transaction.request()
      .input('recipeId', sql.Int, recipeId)
      .query('DELETE FROM ops.laundry_recipe_items WHERE recipe_id = @recipeId');
    await transaction.request()
      .input('recipeId', sql.Int, recipeId)
      .query('DELETE FROM ops.laundry_recipes WHERE recipe_id = @recipeId');
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

const getChemicals = async () => {
  try {
    const pool = getSystemDB();
    const result = await pool.request().query(`
      SELECT item_code AS itemCode, item_name_ar AS itemNameAr, item_name_en AS itemNameEn, 
             chemical_classification AS chemicalClassification,
             category_code AS categoryCode, unit_name_ar AS unitNameAr
      FROM ops.comsys_items
      WHERE category_code = '26'
      ORDER BY item_name_ar
    `);
    return result.recordset;
  } catch (err) {
    throw new DatabaseError(`Failed to fetch chemicals: ${err.message}`);
  }
};

const updateChemicalClassification = async (itemCode, classification) => {
  try {
    const pool = getSystemDB();
    await pool.request()
      .input('itemCode', sql.NVarChar(50), itemCode)
      .input('classification', sql.NVarChar(30), classification)
      .query(`
        UPDATE ops.comsys_items
        SET chemical_classification = @classification
        WHERE item_code = @itemCode AND category_code = '26'
      `);
  } catch (err) {
    throw new DatabaseError(`Failed to update chemical classification: ${err.message}`);
  }
};

const getDashboardSummary = async (startDate, endDate) => {
  try {
    const pool = getSystemDB();
    
    // 1. Batch statistics and chemical cost
    const batchStatsResult = await pool.request()
      .input('startDate', sql.DateTime, startDate)
      .input('endDate', sql.DateTime, endDate)
      .query(`
        SELECT 
            COUNT(b.batch_id) AS totalRuns,
            COALESCE(SUM(b.weight), 0) AS totalWeightKg,
            COALESCE(SUM(b.pieces), 0) AS totalPieces,
            COALESCE(SUM(bc.actual_qty * COALESCE(item_cost.unit_cost, 0)), 0) AS totalChemicalCost
        FROM ops.laundry_batches b
        LEFT JOIN ops.laundry_consumptions bc ON b.batch_id = bc.batch_id
        LEFT JOIN (
            SELECT item_code, AVG(unit_cost) AS unit_cost 
            FROM ops.transaction_lines 
            GROUP BY item_code
        ) item_cost ON bc.chemical_item_code = item_cost.item_code
        WHERE b.created_at BETWEEN @startDate AND @endDate
          AND b.status = 'Completed'
      `);

    // 2. POS tickets and revenues
    const revenueStatsResult = await pool.request()
      .input('startDate', sql.DateTime, startDate)
      .input('endDate', sql.DateTime, endDate)
      .query(`
        SELECT 
            COUNT(t.ticket_id) AS totalTickets,
            COALESCE(SUM(CASE WHEN t.ticket_type = 'GUEST' THEN ti.quantity * ti.unit_price ELSE 0 END), 0) AS guestRevenue,
            COALESCE(SUM(CASE WHEN t.ticket_type = 'STAFF' THEN ti.quantity * ti.unit_price ELSE 0 END), 0) AS staffRevenue,
            COALESCE(SUM(ti.quantity * ti.unit_price), 0) AS totalRevenue
        FROM ops.laundry_tickets t
        JOIN ops.laundry_ticket_items ti ON t.ticket_id = ti.ticket_id
        WHERE t.created_at BETWEEN @startDate AND @endDate
          AND t.status = 'Ready'
      `);

    return {
      batches: batchStatsResult.recordset[0],
      revenue: revenueStatsResult.recordset[0]
    };
  } catch (err) {
    throw new DatabaseError(`فشل في جلب إحصائيات تقرير المغسلة الموحد: ${err.message}`);
  }
};

module.exports = {
  createMachine,
  getMachines,
  createProgram,
  getProgramsByMachine,
  createRecipe,
  createRecipeItem,
  getRecipes,
  getRecipeById,
  createTransfer,
  createTransferItem,
  getTransferById,
  getTransfers,
  updateTransferStatus,
  updateTransferItemReceivedQty,
  createReceiving,
  createReceivingItem,
  getReceivingById,
  createBatch,
  createBatchItem,
  getBatchById,
  getBatches,
  updateBatchStatus,
  createConsumption,
  getConsumptionsByBatch,
  createReturn,
  createReturnItem,
  getReturnById,
  getReturns,
  updateReturnStatus,
  updateReturnItemActualQty,
  createLoss,
  getLosses,
  createTicket,
  createTicketItem,
  getTicketById,
  getTickets,
  updateTicketStatus,
  createCosting,
  createOrUpdateProfitability,
  getProfitabilityReport,
  upsertReconciliation,
  getReconciliationReport,
  getNodeReconciliationReport,
  triggerReconciliationAlert,
  logPosSync,
  getLastPosSync,
  logLaundryAudit,
  deleteProgram,
  updateProgram,
  deleteRecipe,
  getChemicals,
  updateChemicalClassification,
  getMachineById,
  getDashboardSummary,
};
