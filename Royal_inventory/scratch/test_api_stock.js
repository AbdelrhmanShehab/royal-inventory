const { connectSystemDB } = require('../src/config/database');
const hierarchyService = require('../src/api/v1/hierarchy/hierarchy.service');

async function testHierarchyService() {
  await connectSystemDB();
  const stockData = await hierarchyService.getNodeStock(11);
  console.log("Total items:", stockData.items.length);
  const sample = stockData.items.filter(i => ['33005', '33007', '33008', '33100'].includes(i.itemCode));
  console.log("SAMPLE ITEMS FROM getNodeStock(11):", JSON.stringify(sample, null, 2));
  process.exit(0);
}

testHierarchyService().catch(err => {
  console.error(err);
  process.exit(1);
});
