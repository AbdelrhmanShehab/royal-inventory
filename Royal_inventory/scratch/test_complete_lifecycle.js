const { connectSystemDB } = require('../src/config/database');
const hierarchyService = require('../src/api/v1/hierarchy/hierarchy.service');
const laundryService = require('../src/api/v1/laundry/laundry.service');

async function testCompleteLifecycle() {
  await connectSystemDB();

  console.log("=== STEP 1: VERIFY INITIAL STATE FOR 33005 ===");
  let stockData = await hierarchyService.getNodeStock(11);
  let item33005 = stockData.items.find(i => i.itemCode === '33005');
  console.log("Initial 33005:", {
    received: item33005.qtyReceived,
    operational: item33005.qtyOperational,
    transfers: item33005.qtyTransferredOut,
    laundry: item33005.qtyLaundry,
    consumed: item33005.qtyConsumed,
    returned: item33005.qtyReturnedOut,
    damaged: item33005.qtyDamaged
  });

  const sumInitial = item33005.qtyOperational + item33005.qtyTransferredOut + item33005.qtyLaundry + item33005.qtyConsumed + item33005.qtyReturnedOut + item33005.qtyDamaged;
  console.log(`Conservation check: ${item33005.qtyOperational} + ${item33005.qtyTransferredOut} + ${item33005.qtyLaundry} = ${sumInitial} (Expected: ${item33005.qtyReceived})`);
  if (sumInitial !== item33005.qtyReceived) {
    throw new Error(`Conservation mismatch: sum=${sumInitial}, received=${item33005.qtyReceived}`);
  }
  console.log("✅ Step 1 passed: 100% in balance!");

  console.log("\n=== STEP 2: DISPATCH 2 PIECES OF 33005 TO LAUNDRY ===");
  const transferRes = await laundryService.createTransferDraft(11, {
    fromWarehouseId: 11,
    notes: 'Automated Lifecycle Test Transfer',
    items: [
      {
        itemCode: '33005',
        itemNameAr: 'فوطه صفراء',
        sentQty: 2,
        unitCode: 'عدد'
      }
    ]
  });
  console.log("Transfer created with ID:", transferRes.transferId);

  stockData = await hierarchyService.getNodeStock(11);
  item33005 = stockData.items.find(i => i.itemCode === '33005');
  console.log("After laundry dispatch 33005:", {
    received: item33005.qtyReceived,
    operational: item33005.qtyOperational,
    transfers: item33005.qtyTransferredOut,
    laundry: item33005.qtyLaundry
  });

  const sumAfterDispatch = item33005.qtyOperational + item33005.qtyTransferredOut + item33005.qtyLaundry + item33005.qtyConsumed + item33005.qtyReturnedOut + item33005.qtyDamaged;
  console.log(`Conservation check: ${item33005.qtyOperational} (operational) + ${item33005.qtyTransferredOut} (transfers) + ${item33005.qtyLaundry} (laundry) = ${sumAfterDispatch} (Expected: ${item33005.qtyReceived})`);
  if (sumAfterDispatch !== item33005.qtyReceived) {
    throw new Error(`Conservation mismatch after dispatch: sum=${sumAfterDispatch}, received=${item33005.qtyReceived}`);
  }
  if (item33005.qtyOperational !== 2 || item33005.qtyLaundry !== 2) {
    throw new Error(`Expected operational=2 and laundry=2, got operational=${item33005.qtyOperational}, laundry=${item33005.qtyLaundry}`);
  }
  console.log("✅ Step 2 passed: Stock deducted to 2, laundry increased to 2, total sum still 24!");

  console.log("\n=== STEP 3: RETURN CLEAN LINENS (2 PIECES) FROM LAUNDRY ===");
  const returnRes = await laundryService.createReturnDraft(11, {
    transferId: transferRes.transferId,
    notes: 'Automated Clean Return',
    items: [
      {
        itemCode: '33005',
        expectedQty: 2
      }
    ]
  });
  console.log("Return completed with ID:", returnRes.returnId);

  stockData = await hierarchyService.getNodeStock(11);
  item33005 = stockData.items.find(i => i.itemCode === '33005');
  console.log("After clean return 33005:", {
    received: item33005.qtyReceived,
    operational: item33005.qtyOperational,
    transfers: item33005.qtyTransferredOut,
    laundry: item33005.qtyLaundry
  });

  const sumAfterReturn = item33005.qtyOperational + item33005.qtyTransferredOut + item33005.qtyLaundry + item33005.qtyConsumed + item33005.qtyReturnedOut + item33005.qtyDamaged;
  console.log(`Conservation check: ${item33005.qtyOperational} (operational) + ${item33005.qtyTransferredOut} (transfers) + ${item33005.qtyLaundry} (laundry) = ${sumAfterReturn} (Expected: ${item33005.qtyReceived})`);
  if (sumAfterReturn !== item33005.qtyReceived) {
    throw new Error(`Conservation mismatch after return: sum=${sumAfterReturn}, received=${item33005.qtyReceived}`);
  }
  if (item33005.qtyOperational !== 4 || item33005.qtyLaundry !== 0) {
    throw new Error(`Expected operational=4 and laundry=0, got operational=${item33005.qtyOperational}, laundry=${item33005.qtyLaundry}`);
  }
  console.log("✅ Step 3 passed: Stock restored to 4, laundry reduced to 0, total sum still 24!");

  console.log("\n=== STEP 4: VERIFY ITEM 33007 (ROW 2) ===");
  const item33007 = stockData.items.find(i => i.itemCode === '33007');
  console.log("33007:", {
    received: item33007.qtyReceived,
    operational: item33007.qtyOperational,
    laundry: item33007.qtyLaundry,
    consumed: item33007.qtyConsumed,
    damaged: item33007.qtyDamaged
  });
  const sum33007 = item33007.qtyOperational + item33007.qtyTransferredOut + item33007.qtyLaundry + item33007.qtyConsumed + item33007.qtyReturnedOut + item33007.qtyDamaged;
  console.log(`Conservation check: 8 (operational) + 2 (laundry) + 1 (consumed) + 1 (damaged) = ${sum33007} (Expected: ${item33007.qtyReceived})`);
  if (sum33007 !== item33007.qtyReceived) {
    throw new Error(`Conservation mismatch for 33007: sum=${sum33007}, received=${item33007.qtyReceived}`);
  }
  console.log("✅ Step 4 passed: 33007 is 100% in balance!");

  console.log("\n🎉 ALL LIFECYCLE CONSERVATION CHECKS PASSED WITH 100% MATHEMATICAL PRECISION!");
  process.exit(0);
}

testCompleteLifecycle().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
