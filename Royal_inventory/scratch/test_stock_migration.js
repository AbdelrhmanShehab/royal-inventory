const { getSystemDB, connectSystemDB } = require('../src/config/database');

async function testMigration() {
  await connectSystemDB();
  const pool = getSystemDB();
  const tx = pool.transaction();
  await tx.begin();

  try {
    console.log("1. Dropping constraint chk_positive_qty and index...");
    await tx.request().query(`
      IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_positive_qty' AND parent_object_id = OBJECT_ID('ops.operational_stock'))
        ALTER TABLE ops.operational_stock DROP CONSTRAINT chk_positive_qty;

      IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_stock_node_item' AND object_id = OBJECT_ID('ops.operational_stock'))
        DROP INDEX ix_stock_node_item ON ops.operational_stock;
    `);

    console.log("2. Dropping computed column qty_operational...");
    await tx.request().query(`
      ALTER TABLE ops.operational_stock DROP COLUMN qty_operational;
    `);

    console.log("3. Adding qty_laundry and qty_returned_out columns...");
    await tx.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'qty_laundry')
        ALTER TABLE ops.operational_stock ADD qty_laundry DECIMAL(18,4) NOT NULL DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ops.operational_stock') AND name = 'qty_returned_out')
        ALTER TABLE ops.operational_stock ADD qty_returned_out DECIMAL(18,4) NOT NULL DEFAULT 0;
    `);

    console.log("4. Recreating computed column qty_operational...");
    await tx.request().query(`
      ALTER TABLE ops.operational_stock ADD qty_operational AS (
        (qty_received + qty_internal_in + qty_returned_in)
        - (qty_consumed + qty_damaged + qty_wasted + qty_disposed + qty_transferred_out + qty_laundry + qty_returned_out)
      ) PERSISTED;
    `);

    console.log("5. Recreating index and constraint...");
    await tx.request().query(`
      CREATE INDEX ix_stock_node_item ON ops.operational_stock (node_id, item_code, qty_operational);
      ALTER TABLE ops.operational_stock ADD CONSTRAINT chk_positive_qty CHECK (qty_operational >= 0);
    `);

    console.log("6. Verifying row 33005 at node 11...");
    const testRow = await tx.request().query(`
      SELECT stock_id, node_id, item_code, qty_received, qty_laundry, qty_transferred_out, qty_returned_out, qty_consumed, qty_damaged, qty_operational 
      FROM ops.operational_stock WHERE node_id = 11 AND item_code = '33005'
    `);
    console.log("Row 33005:", testRow.recordset[0]);

    await tx.commit();
    console.log("✅ FULL MIGRATION SUCCEEDED AND COMMITTED CLEANLY!");
    process.exit(0);
  } catch (err) {
    await tx.rollback();
    console.error("❌ MIGRATION FAILED:", err);
    process.exit(1);
  }
}

testMigration();
