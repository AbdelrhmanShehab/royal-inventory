export interface LaundryMachine {
  id: number;
  name: string;
  capacity: number;
  isActive: boolean;
}

export interface LaundryProgram {
  id: number;
  machineId: number;
  name: string;
  description: string | null;
  recommendedCapacity: number | null;
  maximumCapacity: number | null;
  recipeId: number | null;
  durationMins: number | null;
  temperatureC: number | null;
  waterLevelLiters: number | null;
  spinSpeedRpm: number | null;
  isActive: boolean;
}

export interface LaundryRecipeItem {
  itemId?: number;
  chemicalItemCode: string;
  chemicalName: string;
  expectedQty: number;
  minQty: number;
  maxQty: number;
  isRequired: boolean;
  calculationMode: 'chemical_per_kg' | 'fixed_consumption' | 'manual_override';
}

export interface LaundryRecipe {
  id: number;
  name: string;
  mode: 'STRICT' | 'FLEXIBLE' | 'MANUAL';
  description: string | null;
  isActive: boolean;
  items?: LaundryRecipeItem[];
}

export interface LaundryBatchItem {
  itemId?: number;
  itemCode: string;
  quantity: number;
  role: 'INPUT' | 'OUTPUT' | 'SCRAP';
  itemNameAr?: string; // Mapped for convenience
}

export interface LaundryConsumption {
  id?: number;
  chemicalItemCode: string;
  chemicalName: string;
  expectedQty: number;
  actualQty: number;
  variance?: number;
  mode: 'AUTO' | 'MANUAL' | 'FLEXIBLE';
}

export interface LaundryBatch {
  id: number;
  batchNumber: string;
  runType: 'PROGRAM' | 'MANUAL' | 'HYBRID';
  machineId: number | null;
  machineName?: string | null;
  programId: number | null;
  programName?: string | null;
  recipeId: number | null;
  recipeName?: string | null;
  weight: number;
  pieces: number;
  guestWeight: number;
  staffWeight: number;
  specialWeight: number;
  spotWeight: number;
  status: 'Pending' | 'Running' | 'Paused' | 'Completed' | 'Cancelled';
  operatorId: number;
  operatorUsername?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  items?: LaundryBatchItem[];
  consumptions?: LaundryConsumption[];
}

export interface LaundryTransferItem {
  itemId: number;
  itemCode: string;
  itemNameAr: string;
  sentQty: number;
  receivedQty: number;
  remainingQty: number;
  unitCode: string | null;
  unitCost: number;
}

export interface LaundryTransfer {
  id: number;
  fromWarehouseId: number;
  fromWarehouseName: string;
  status: 'draft' | 'pending' | 'dispatched' | 'sent' | 'received' | 'partially_received' | 'rejected' | 'cancelled';
  notes: string | null;
  createdBy: number;
  creatorUsername: string;
  createdAt: string;
  updatedAt: string;
  returnId?: number | null;
  returnStatus?: string | null;
  items?: LaundryTransferItem[];
}

export interface LaundryReturnItem {
  itemId: number;
  itemCode: string;
  itemNameAr: string;
  expectedQty: number;
  actualQty: number;
  rejectedQty: number;
  rejectReason: 'Damaged' | 'Wet' | 'Count Mismatch' | null;
  rejectNotes: string | null;
}

export interface LaundryReturn {
  id: number;
  transferId: number;
  status: 'draft' | 'pending' | 'partial_received' | 'completed' | 'rejected' | 'disputed';
  notes: string | null;
  createdBy: number;
  creatorUsername: string;
  createdAt: string;
  items?: LaundryReturnItem[];
}

export interface LaundryTicketItem {
  itemId: number;
  serviceItemCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface LaundryTicket {
  id: number;
  ticketType: 'GUEST' | 'STAFF' | 'SPECIAL';
  guestName: string | null;
  roomNumber: string | null;
  employeeId: number | null;
  specialNotes: string | null;
  deliveryTime: string | null;
  status: 'Received' | 'In_Progress' | 'Ready' | 'Delivered' | 'Cancelled';
  posSaleId: number | null;
  createdBy: number;
  creatorUsername: string;
  createdAt: string;
  updatedAt: string;
  items?: LaundryTicketItem[];
}

export interface LaundryLoss {
  id: number;
  itemCode: string;
  itemNameAr: string;
  quantity: number;
  reason: 'Torn' | 'Burned' | 'Shrinkage' | 'Missing' | 'Stained' | 'Disposed';
  cost: number;
  approvedBy: number;
  approverUsername: string;
  batchId: number | null;
  createdAt: string;
}

export interface LaundryReconciliation {
  id: number;
  itemCode: string;
  itemNameAr: string;
  sentQty: number;
  returnedQty: number;
  scrapQty: number;
  inProgressQty: number;
  variance: number;
  alertTriggered: boolean;
  reconciledAt: string;
}

export interface ProfitabilityRecord {
  id: number;
  date: string;
  revenue: number;
  chemicalCost: number;
  utilitiesCost: number;
  laborCost: number;
  lossCost: number;
  netProfit: number;
}

export interface ChemicalItem {
  itemCode: string;
  itemNameAr: string;
  itemNameEn: string;
  chemicalClassification: 'production' | 'maintenance' | null;
}

export interface ZkCheckin {
  checkinId: number;
  employeeId: number;
  employeeName: string;
  checkTime: string;
  verifyMode: number;
  sensorId: number;
}
