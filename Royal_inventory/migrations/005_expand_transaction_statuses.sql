-- ==============================================================================
-- Migration 005: Expand Transaction Statuses
-- Adds pending_approval, approved, shipped statuses to chk_status constraint
-- ==============================================================================

USE InventoryOps;
GO

-- ── Drop existing status CHECK constraint ─────────────────────────────
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'chk_status' AND parent_object_id = OBJECT_ID('ops.transaction_headers')
)
BEGIN
    ALTER TABLE ops.transaction_headers DROP CONSTRAINT chk_status;
    PRINT '✅ Dropped old chk_status constraint';
END
GO

-- ── Add new expanded status CHECK constraint ──────────────────────────
ALTER TABLE ops.transaction_headers
    ADD CONSTRAINT chk_status CHECK (
        status IN (
            'draft',             -- Initial state
            'pending_approval',  -- Submitted by initiator, awaiting General Manager approval
            'approved',          -- Approved by General Manager, awaiting shipment dispatch
            'shipped',           -- Dispatched from source, stock deducted from source, in transit
            'confirmed',         -- Received at destination, stock added to destination, completed
            'cancelled'          -- Cancelled or rejected request
        )
    );
PRINT '✅ New expanded chk_status constraint added successfully';
GO
