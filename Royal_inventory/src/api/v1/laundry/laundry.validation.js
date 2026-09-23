'use strict';

const Joi = require('joi');

const createMachineSchema = Joi.object({
  machineName: Joi.string().max(100).required(),
  capacityKg: Joi.number().precision(2).positive().required(),
  isActive: Joi.boolean().default(true),
});

const createProgramSchema = Joi.object({
  machineId: Joi.number().integer().required(),
  programName: Joi.string().max(100).required(),
  description: Joi.string().max(500).allow(null, ''),
  recommendedCapacity: Joi.number().min(0).allow(null),
  maximumCapacity: Joi.number().min(0).allow(null),
  recipeId: Joi.number().integer().allow(null),
  durationMins: Joi.number().integer().min(0).allow(null),
  temperatureC: Joi.number().min(0).allow(null),
  waterLevelLiters: Joi.number().min(0).allow(null),
  spinSpeedRpm: Joi.number().integer().min(0).allow(null),
  isActive: Joi.boolean().default(true),
});

const recipeItemSchema = Joi.object({
  chemicalItemCode: Joi.string().max(50).required(),
  chemicalName: Joi.string().max(200).required(),
  expectedQty: Joi.number().min(0).required(),
  minQty: Joi.number().min(0).required(),
  maxQty: Joi.number().min(0).required(),
  isRequired: Joi.boolean().default(true),
  calculationMode: Joi.string().valid('chemical_per_kg', 'fixed_consumption', 'manual_override').required(),
});

const createRecipeSchema = Joi.object({
  recipeName: Joi.string().max(100).required(),
  mode: Joi.string().valid('STRICT', 'FLEXIBLE', 'MANUAL').default('STRICT'),
  description: Joi.string().max(500).allow(null, ''),
  isActive: Joi.boolean().default(true),
  items: Joi.array().items(recipeItemSchema).min(1).required(),
});

const transferItemSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  itemNameAr: Joi.string().max(200).required(),
  sentQty: Joi.number().positive().required(),
  unitCode: Joi.string().max(20).allow(null, ''),
  unitCost: Joi.number().min(0).default(0),
});

const createTransferSchema = Joi.object({
  fromWarehouseId: Joi.number().integer().required(),
  notes: Joi.string().max(500).allow(null, ''),
  items: Joi.array().items(transferItemSchema).min(1).required(),
});

const receivingItemSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  actualQty: Joi.number().min(0).required(),
  rejectReason: Joi.string().valid('Damaged', 'Wrong Quantity', 'Wet', 'Wrong Item').allow(null, ''),
  rejectNotes: Joi.string().max(500).allow(null, ''),
});

const createReceivingSchema = Joi.object({
  transferId: Joi.number().integer().required(),
  notes: Joi.string().max(500).allow(null, ''),
  items: Joi.array().items(receivingItemSchema).min(1).required(),
});

const batchItemInputSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  quantity: Joi.number().positive().required(),
  role: Joi.string().valid('INPUT', 'OUTPUT', 'SCRAP').required(),
});

const batchChemicalInputSchema = Joi.object({
  chemicalItemCode: Joi.string().max(50).required(),
  chemicalName: Joi.string().max(200).required(),
  actualQty: Joi.number().min(0).required(),
  mode: Joi.string().valid('AUTO', 'MANUAL', 'FLEXIBLE').default('MANUAL'),
});

const createBatchSchema = Joi.object({
  batchNumber: Joi.string().max(50).required(),
  runType: Joi.string().valid('PROGRAM', 'MANUAL', 'HYBRID').default('PROGRAM'),
  machineId: Joi.number().integer().allow(null),
  programId: Joi.number().integer().allow(null),
  recipeId: Joi.number().integer().allow(null),
  weight: Joi.number().min(0).default(0),
  pieces: Joi.number().integer().min(0).default(0),
  guestWeight: Joi.number().min(0).default(0),
  staffWeight: Joi.number().min(0).default(0),
  specialWeight: Joi.number().min(0).default(0),
  spotWeight: Joi.number().min(0).default(0),
  items: Joi.array().items(batchItemInputSchema).min(1).required(),
  consumptions: Joi.array().items(batchChemicalInputSchema).default([]),
});

const updateBatchStatusSchema = Joi.object({
  status: Joi.string().valid('Pending', 'Running', 'Paused', 'Completed', 'Cancelled').required(),
});

const returnItemSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  itemNameAr: Joi.string().max(200).required(),
  expectedQty: Joi.number().positive().required(),
});

const createReturnSchema = Joi.object({
  transferId: Joi.number().integer().required(),
  notes: Joi.string().max(500).allow(null, ''),
  items: Joi.array().items(returnItemSchema).min(1).required(),
});

const verifyReturnItemSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  actualQty: Joi.number().min(0).required(),
  rejectReason: Joi.string().valid('Damaged', 'Wet', 'Count Mismatch').allow(null, ''),
  rejectNotes: Joi.string().max(500).allow(null, ''),
});

const verifyReturnSchema = Joi.object({
  status: Joi.string().valid('partial_received', 'completed', 'rejected', 'disputed').required(),
  notes: Joi.string().max(500).allow(null, ''),
  items: Joi.array().items(verifyReturnItemSchema).min(1).required(),
});

const createLossSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  itemNameAr: Joi.string().max(200).required(),
  quantity: Joi.number().positive().required(),
  reason: Joi.string().valid('Torn', 'Burned', 'Shrinkage', 'Missing', 'Stained', 'Disposed').required(),
  cost: Joi.number().min(0).required(),
  batchId: Joi.number().integer().allow(null),
});

const ticketItemSchema = Joi.object({
  serviceItemCode: Joi.string().max(50).required(),
  quantity: Joi.number().positive().required(),
  unitPrice: Joi.number().min(0).required(),
});

const createTicketSchema = Joi.object({
  ticketType: Joi.string().valid('GUEST', 'STAFF').required(),
  guestName: Joi.string().max(100).required(),
  roomNumber: Joi.string().max(20).allow(null, ''),
  employeeId: Joi.number().integer().allow(null),
  specialNotes: Joi.string().max(500).allow(null, ''),
  deliveryTime: Joi.date().iso().allow(null),
  items: Joi.array().items(ticketItemSchema).min(1).required(),
});

const updateTicketStatusSchema = Joi.object({
  status: Joi.string().valid('Received', 'Processing', 'Ready', 'Delivered').required(),
});

const classifyChemicalSchema = Joi.object({
  itemCode: Joi.string().max(50).required(),
  classification: Joi.string().valid('production', 'maintenance').required(),
});

const createHandoverTxnSchema = Joi.object({
  userCode: Joi.string().max(50).required(),
  itemCode: Joi.string().max(50).required(),
  action: Joi.string().valid('Handover', 'Receive').required(),
  quantity: Joi.number().integer().positive().required(),
  notes: Joi.string().max(500).allow(null, ''),
});

module.exports = {
  createMachineSchema,
  createProgramSchema,
  createRecipeSchema,
  createTransferSchema,
  createReceivingSchema,
  createBatchSchema,
  updateBatchStatusSchema,
  createReturnSchema,
  verifyReturnSchema,
  createLossSchema,
  createTicketSchema,
  updateTicketStatusSchema,
  classifyChemicalSchema,
  createHandoverTxnSchema,
};
