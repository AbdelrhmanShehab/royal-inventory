'use strict';
const { connectSystemDB, getSystemDB } = require('../src/config/database');
const hierarchyService = require('../src/api/v1/hierarchy/hierarchy.service');

function getChildNodesList(nodesList, result = []) {
  nodesList.forEach(n => {
    if (n.nodeType === 'child') result.push(n);
    if (n.children && n.children.length > 0) getChildNodesList(n.children, result);
  });
  return result;
}

async function main() {
  await connectSystemDB();
  
  // Test case 1: allowedNodeIds is null (admin/manager)
  console.log('--- Test 1: Unrestricted Tree (admin/manager) ---');
  const tree1 = await hierarchyService.getTree(1, null);
  console.log('Tree root node:', tree1.nodes[0]?.nodeNameAr);
  const list1 = getChildNodesList(tree1.nodes || []);
  console.log('Parsed child nodes count:', list1.length);
  list1.forEach(c => console.log(` - ID: ${c.id} | Name: ${c.nodeNameAr} | Type: ${c.nodeType}`));

  // Test case 2: allowedNodeIds is scoped to Node 1 (Msamir)
  console.log('\n--- Test 2: Scoped Tree (Msamir - Node 1) ---');
  const allowedIds = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13];
  const tree2 = await hierarchyService.getTree(1, allowedIds);
  console.log('Tree root node:', tree2.nodes[0]?.nodeNameAr);
  const list2 = getChildNodesList(tree2.nodes || []);
  console.log('Parsed child nodes count:', list2.length);
  list2.forEach(c => console.log(` - ID: ${c.id} | Name: ${c.nodeNameAr} | Type: ${c.nodeType}`));

  process.exit(0);
}

main().catch(console.error);
