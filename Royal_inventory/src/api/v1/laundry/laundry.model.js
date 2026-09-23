'use strict';

class LaundryMachine {
  constructor({ id, name, capacity, isActive = true }) {
    this.id = id;
    this.name = name;
    this.capacity = parseFloat(capacity || 0);
    this.isActive = !!isActive;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryMachine({
      id: row.id || row.machine_id,
      name: row.name || row.machine_name,
      capacity: row.capacity || row.capacity_kg,
      isActive: row.isActive || row.is_active,
    });
  }
}

class LaundryRecipeItem {
  constructor({ itemId, recipeId, chemicalItemCode, chemicalName, expectedQty, minQty, maxQty, isRequired = true, calculationMode }) {
    this.itemId = itemId;
    this.recipeId = recipeId;
    this.chemicalItemCode = chemicalItemCode;
    this.chemicalName = chemicalName;
    this.expectedQty = parseFloat(expectedQty || 0);
    this.minQty = parseFloat(minQty || 0);
    this.maxQty = parseFloat(maxQty || 0);
    this.isRequired = !!isRequired;
    this.calculationMode = calculationMode;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryRecipeItem({
      itemId: row.itemId || row.recipe_item_id,
      recipeId: row.recipeId || row.recipe_id,
      chemicalItemCode: row.chemicalItemCode || row.chemical_item_code,
      chemicalName: row.chemicalName || row.chemical_name,
      expectedQty: row.expectedQty || row.expected_qty,
      minQty: row.minQty || row.min_qty,
      maxQty: row.maxQty || row.max_qty,
      isRequired: row.isRequired || row.is_required,
      calculationMode: row.calculationMode || row.calculation_mode,
    });
  }
}

class LaundryRecipe {
  constructor({ id, name, mode, description, isActive = true, items = [] }) {
    this.id = id;
    this.name = name;
    this.mode = mode; // STRICT, FLEXIBLE, MANUAL
    this.description = description || null;
    this.isActive = !!isActive;
    this.items = items;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryRecipe({
      id: row.id || row.recipe_id,
      name: row.name || row.recipe_name,
      mode: row.mode,
      description: row.description,
      isActive: row.isActive || row.is_active,
      items: row.items ? row.items.map(item => LaundryRecipeItem.fromDatabase(item)) : [],
    });
  }
}

class LaundryTransferItem {
  constructor({ itemId, transferId, itemCode, itemNameAr, sentQty, receivedQty = 0, remainingQty, unitCode, unitCost = 0 }) {
    this.itemId = itemId;
    this.transferId = transferId;
    this.itemCode = itemCode;
    this.itemNameAr = itemNameAr;
    this.sentQty = parseFloat(sentQty || 0);
    this.receivedQty = parseFloat(receivedQty || 0);
    this.remainingQty = parseFloat(remainingQty || 0);
    this.unitCode = unitCode || null;
    this.unitCost = parseFloat(unitCost || 0);
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryTransferItem({
      itemId: row.itemId || row.transfer_item_id,
      transferId: row.transferId || row.transfer_id,
      itemCode: row.itemCode || row.item_code,
      itemNameAr: row.itemNameAr || row.item_name_ar,
      sentQty: row.sentQty || row.sent_qty,
      receivedQty: row.receivedQty || row.received_qty,
      remainingQty: row.remainingQty || row.remaining_qty,
      unitCode: row.unitCode || row.unit_code,
      unitCost: row.unitCost || row.unit_cost,
    });
  }
}

class LaundryTransfer {
  constructor({ id, fromWarehouseId, fromWarehouseName, status, notes, createdBy, creatorUsername, createdAt, updatedAt, items = [] }) {
    this.id = id;
    this.fromWarehouseId = fromWarehouseId;
    this.fromWarehouseName = fromWarehouseName || null;
    this.status = status; // draft, sent, in_transit, received, partially_received, rejected, closed
    this.notes = notes || null;
    this.createdBy = createdBy;
    this.creatorUsername = creatorUsername || null;
    this.createdAt = createdAt || null;
    this.updatedAt = updatedAt || null;
    this.items = items;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryTransfer({
      id: row.id || row.transfer_id,
      fromWarehouseId: row.fromWarehouseId || row.from_warehouse_id,
      fromWarehouseName: row.fromWarehouseName || row.from_warehouse_name,
      status: row.status,
      notes: row.notes,
      createdBy: row.createdBy || row.created_by,
      creatorUsername: row.creatorUsername,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: row.items ? row.items.map(item => LaundryTransferItem.fromDatabase(item)) : [],
    });
  }
}

class LaundryBatch {
  constructor({ id, batchNumber, machineId, machineName, programId, programName, recipeId, recipeName, weight, pieces, status, operatorId, operatorUsername, startedAt, finishedAt, createdAt, items = [] }) {
    this.id = id;
    this.batchNumber = batchNumber;
    this.machineId = machineId || null;
    this.machineName = machineName || null;
    this.programId = programId || null;
    this.programName = programName || null;
    this.recipeId = recipeId || null;
    this.recipeName = recipeName || null;
    this.weight = parseFloat(weight || 0);
    this.pieces = parseInt(pieces || 0);
    this.status = status; // Pending, Running, Paused, Completed, Cancelled
    this.operatorId = operatorId;
    this.operatorUsername = operatorUsername || null;
    this.startedAt = startedAt || null;
    this.finishedAt = finishedAt || null;
    this.createdAt = createdAt || null;
    this.items = items;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryBatch({
      id: row.id || row.batch_id,
      batchNumber: row.batchNumber || row.batch_number,
      machineId: row.machineId || row.machine_id,
      machineName: row.machineName,
      programId: row.programId || row.program_id,
      programName: row.programName,
      recipeId: row.recipeId || row.recipe_id,
      recipeName: row.recipeName,
      weight: row.weight,
      pieces: row.pieces,
      status: row.status,
      operatorId: row.operatorId || row.operator_id,
      operatorUsername: row.operatorUsername,
      startedAt: row.startedAt || row.started_at,
      finishedAt: row.finishedAt || row.finished_at,
      createdAt: row.createdAt,
      items: row.items ? row.items.map(item => ({
        itemId: item.itemId || item.batch_item_id,
        itemCode: item.itemCode || item.item_code,
        quantity: parseFloat(item.quantity || 0),
        role: item.role,
      })) : [],
    });
  }
}

class LaundryReturn {
  constructor({ id, transferId, status, notes, createdBy, creatorUsername, createdAt, items = [] }) {
    this.id = id;
    this.transferId = transferId;
    this.status = status; // draft, sent, partial_received, completed, rejected, disputed
    this.notes = notes || null;
    this.createdBy = createdBy;
    this.creatorUsername = creatorUsername || null;
    this.createdAt = createdAt || null;
    this.items = items;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryReturn({
      id: row.id || row.return_id,
      transferId: row.transferId || row.transfer_id,
      status: row.status,
      notes: row.notes,
      createdBy: row.createdBy || row.created_by,
      creatorUsername: row.creatorUsername,
      createdAt: row.createdAt,
      items: row.items ? row.items.map(item => ({
        itemId: item.itemId || item.return_item_id,
        itemCode: item.itemCode || item.item_code,
        itemNameAr: item.itemNameAr || item.item_name_ar,
        expectedQty: parseFloat(item.expectedQty || item.expected_qty || 0),
        actualQty: parseFloat(item.actualQty || item.actual_qty || 0),
        rejectedQty: parseFloat(item.rejectedQty || item.rejected_qty || 0),
        rejectReason: item.rejectReason || item.reject_reason || null,
        rejectNotes: item.rejectNotes || item.reject_notes || null,
      })) : [],
    });
  }
}

class LaundryTicket {
  constructor({ id, ticketType, guestName, roomNumber, employeeId, specialNotes, deliveryTime, status, posSaleId, createdBy, creatorUsername, createdAt, updatedAt, items = [] }) {
    this.id = id;
    this.ticketType = ticketType; // GUEST, STAFF
    this.guestName = guestName || null;
    this.roomNumber = roomNumber || null;
    this.employeeId = employeeId || null;
    this.specialNotes = specialNotes || null;
    this.deliveryTime = deliveryTime || null;
    this.status = status; // Received, Processing, Ready, Delivered
    this.posSaleId = posSaleId || null;
    this.createdBy = createdBy;
    this.creatorUsername = creatorUsername || null;
    this.createdAt = createdAt || null;
    this.updatedAt = updatedAt || null;
    this.items = items;
  }

  static fromDatabase(row) {
    if (!row) return null;
    return new LaundryTicket({
      id: row.id || row.ticket_id,
      ticketType: row.ticketType || row.ticket_type,
      guestName: row.guestName || row.guest_name,
      roomNumber: row.roomNumber || row.room_number,
      employeeId: row.employeeId || row.employee_id,
      specialNotes: row.specialNotes || row.special_notes,
      deliveryTime: row.deliveryTime || row.delivery_time,
      status: row.status,
      posSaleId: row.posSaleId || row.pos_sale_id,
      createdBy: row.createdBy || row.created_by,
      creatorUsername: row.creatorUsername,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      items: row.items ? row.items.map(item => ({
        itemId: item.itemId || item.ticket_item_id,
        serviceItemCode: item.serviceItemCode || item.service_item_code,
        quantity: parseFloat(item.quantity || 0),
        unitPrice: parseFloat(item.unitPrice || item.unit_price || 0),
        totalPrice: parseFloat(item.totalPrice || item.total_price || 0),
      })) : [],
    });
  }
}

module.exports = {
  LaundryMachine,
  LaundryRecipeItem,
  LaundryRecipe,
  LaundryTransferItem,
  LaundryTransfer,
  LaundryBatch,
  LaundryReturn,
  LaundryTicket,
};
