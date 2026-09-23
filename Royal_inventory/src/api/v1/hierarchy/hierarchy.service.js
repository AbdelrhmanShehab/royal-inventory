'use strict';

const repo = require('../../../repositories/system/hierarchy.repo');
const stockRepo = require('../../../repositories/system/stock.repo');
const { NotFoundError, BadRequestError } = require('../../../utils/errors');
const nodeCache = require('../../../services/node.cache');

/**
 * Hierarchy Service — manages business rules for groups and nodes tree.
 */

const createGroup = async (groupData) => {
  return repo.createGroup(groupData);
};

const getGroup = async (groupId) => {
  const group = await repo.getGroupById(groupId);
  if (!group) throw new NotFoundError('المجموعة غير موجودة');
  return group;
};

const listGroups = async () => {
  return repo.getAllGroups();
};

const updateGroup = async (groupId, groupData) => {
  await getGroup(groupId);
  await repo.updateGroup(groupId, groupData);
  return { message: 'تم تحديث المجموعة بنجاح' };
};

const deleteGroup = async (groupId) => {
  await getGroup(groupId);
  await repo.deleteGroup(groupId);
  return { message: 'تم حذف المجموعة بنجاح' };
};

const createNode = async (nodeData) => {
  // Validate parent node exists if provided
  if (nodeData.parentNodeId) {
    const parent = await repo.getNodeById(nodeData.parentNodeId);
    if (!parent) throw new NotFoundError('العقدة الأب المحددة غير موجودة');
  }
  // Validate group exists
  await getGroup(nodeData.groupId);

  const nodeId = await repo.createNode(nodeData);
  nodeCache.invalidateCache();
  return nodeId;
};

const getNode = async (nodeId) => {
  const node = await repo.getNodeById(nodeId);
  if (!node) throw new NotFoundError('عقدة المخزن غير موجودة');
  return node;
};

const updateNode = async (nodeId, nodeData) => {
  await getNode(nodeId);
  if (nodeData.parentNodeId) {
    const parent = await repo.getNodeById(nodeData.parentNodeId);
    if (!parent) throw new NotFoundError('العقدة الأب المحددة غير موجودة');
  }
  await repo.updateNode(nodeId, nodeData);
  nodeCache.invalidateCache();
  return { message: 'تم تحديث عقدة المخزن بنجاح' };
};

const deleteNode = async (nodeId) => {
  await getNode(nodeId);

  // Guard: Deleting an inventory node with active operational locations is forbidden
  const { getLocationCountByNode } = require('../../../repositories/system/operationalLocation.repo');
  const locationCount = await getLocationCountByNode(nodeId);
  if (locationCount > 0) {
    throw new BadRequestError('لا يمكن حذف هذا المستودع لأنه يحتوي على مواقع تشغيلية نشطة');
  }

  await repo.deleteNode(nodeId);
  nodeCache.invalidateCache();
  return { message: 'تم حذف عقدة المخزن بنجاح' };
};

/**
 * Build a hierarchical tree of nodes under groups.
 */
const getDescendantChildNodeIds = (parentNodeId, allNodes) => {
  const childIds = [];
  const traverse = (id) => {
    const children = allNodes.filter(n => n.parentNodeId === id);
    for (const child of children) {
      if (child.nodeType === 'child') {
        childIds.push(child.id);
      } else {
        traverse(child.id);
      }
    }
  };
  traverse(parentNodeId);
  return childIds;
};

const getTree = async (groupId = null, allowedNodeIds = null) => {
  const groups = groupId ? [await getGroup(groupId)] : await repo.getAllGroups();
  let allNodes = await repo.getAllNodes();
  if (allowedNodeIds) {
    allNodes = allNodes.filter(n => allowedNodeIds.includes(n.id));
  }
  const allNodeStocks = await stockRepo.getAllNodesTotalStock();
  const stockMap = {};
  allNodeStocks.forEach(s => {
    stockMap[s.nodeId] = s.totalStock;
  });

  const tree = [];
  
  for (const group of groups) {
    // Filter nodes belonging to this group
    const groupNodes = allNodes.filter(n => n.groupId === group.id);

    // Map by ID for quick access and attach stock in memory
    const nodeMap = {};
    for (const node of groupNodes) {
      let nodeTotalStock = 0;
      if (node.nodeType === 'child') {
        nodeTotalStock = stockMap[node.id] || 0;
      } else {
        const descendantChildIds = getDescendantChildNodeIds(node.id, allNodes);
        nodeTotalStock = descendantChildIds.reduce((sum, cid) => sum + (stockMap[cid] || 0), 0);
      }

      nodeMap[node.id] = { 
        ...node, 
        totalStock: nodeTotalStock,
        children: [] 
      };
    }

    const rootNodes = [];
    groupNodes.forEach(node => {
      const mappedNode = nodeMap[node.id];
      // A node is root for the user if parent node is not in their allowed scope
      if (node.parentNodeId === null || !nodeMap[node.parentNodeId]) {
        rootNodes.push(mappedNode);
      } else {
        const parentMapped = nodeMap[node.parentNodeId];
        if (parentMapped) {
          parentMapped.children.push(mappedNode);
        } else {
          rootNodes.push(mappedNode);
        }
      }
    });

    tree.push({
      ...group,
      nodes: rootNodes,
    });
  }

  const resultTree = tree.filter(g => g.nodes && g.nodes.length > 0);
  return groupId ? resultTree[0] : resultTree;
};

const getNodeStock = async (nodeId) => {
  const allNodes = await repo.getAllNodes();
  const targetNode = allNodes.find(n => n.id === nodeId);
  if (!targetNode) {
    throw new NotFoundError('عقدة المخزن غير موجودة');
  }

  let childNodeIds = [];
  if (targetNode.nodeType === 'child') {
    childNodeIds = [nodeId];
  } else {
    // It's a parent node, get all child nodes under it recursively
    childNodeIds = getDescendantChildNodeIds(nodeId, allNodes);
  }

  // Fetch stocks for all these child nodes
  const stockItemsMap = {};
  const subunitStock = [];
  const distributions = [];

  for (const childId of childNodeIds) {
    const childNode = allNodes.find(n => n.id === childId);
    const childStockList = await stockRepo.getStockByNode(childId);
    
    // Sum total stock for this subunit
    const childTotal = childStockList.reduce((sum, s) => sum + s.qtyOperational, 0);
    subunitStock.push({
      id: childId,
      nodeNameAr: childNode.nodeNameAr,
      totalStock: childTotal,
    });

    // Merge item stock & populate distributions
    for (const s of childStockList) {
      distributions.push({
        nodeId: childId,
        nodeNameAr: childNode.nodeNameAr,
        itemCode: s.itemCode,
        itemNameAr: s.itemNameAr || 'صنف غير معروف',
        unitNameAr: s.unitNameAr || 'حبة',
        itemType: s.itemType || 'consumable',
        qtyReceived: s.qtyReceived + s.qtyInternalIn,
        qtyConsumed: s.qtyConsumed,
        qtyDamaged: s.qtyDamaged + s.qtyWasted + s.qtyDisposed,
        qtyOperational: s.qtyOperational,
      });

      if (!stockItemsMap[s.itemCode]) {
        stockItemsMap[s.itemCode] = {
          itemCode: s.itemCode,
          itemNameAr: s.itemNameAr,
          unitNameAr: s.unitNameAr,
          qtyReceived: 0,
          qtyInternalIn: 0,
          qtyReturnedIn: 0,
          qtyConsumed: 0,
          qtyDamaged: 0,
          qtyWasted: 0,
          qtyDisposed: 0,
          qtyTransferredOut: 0,
          qtyLaundry: 0,
          qtyReturnedOut: 0,
          qtyOperational: 0,
        };
      }
      const item = stockItemsMap[s.itemCode];
      item.qtyReceived += s.qtyReceived;
      item.qtyInternalIn += s.qtyInternalIn;
      item.qtyReturnedIn += s.qtyReturnedIn;
      item.qtyConsumed += s.qtyConsumed;
      item.qtyDamaged += s.qtyDamaged;
      item.qtyWasted += s.qtyWasted;
      item.qtyDisposed += s.qtyDisposed;
      item.qtyTransferredOut += s.qtyTransferredOut;
      item.qtyLaundry += (s.qtyLaundry || 0);
      item.qtyReturnedOut += (s.qtyReturnedOut || 0);
      item.qtyOperational += s.qtyOperational;
    }
  }

  const items = Object.values(stockItemsMap).filter(item => item.qtyOperational >= 0);
  const totalStock = items.reduce((sum, item) => sum + item.qtyOperational, 0);

  return {
    nodeId,
    nodeNameAr: targetNode.nodeNameAr,
    nodeType: targetNode.nodeType,
    totalStock,
    itemTypesCount: items.length,
    subunitsCount: targetNode.nodeType === 'parent' ? childNodeIds.length : 0,
    subunitStock: targetNode.nodeType === 'parent' ? subunitStock : [],
    distributions: targetNode.nodeType === 'parent' ? distributions : [],
    items,
  };
};

const getAllStock = async (groupId = null, allowedNodeIds = null) => {
  let stocks = await stockRepo.getAllStock(groupId);
  if (allowedNodeIds) {
    stocks = stocks.filter(s => allowedNodeIds.includes(s.nodeId));
  }
  return stocks.map(s => ({
    id: s.id,
    nodeId: s.nodeId,
    nodeNameAr: s.nodeNameAr,
    itemCode: s.itemCode,
    itemNameAr: s.itemNameAr || 'صنف غير معروف',
    unitNameAr: s.unitNameAr || 'حبة',
    itemType: s.itemType || 'consumable',
    categoryCode: s.categoryCode || 'أخرى',
    qtyReceived: s.qtyReceived,
    qtyInternalIn: s.qtyInternalIn,
    qtyReturnedIn: s.qtyReturnedIn,
    qtyConsumed: s.qtyConsumed,
    qtyDamaged: s.qtyDamaged,
    qtyWasted: s.qtyWasted,
    qtyDisposed: s.qtyDisposed,
    qtyTransferredOut: s.qtyTransferredOut,
    qtyOperational: s.qtyOperational,
    lastUpdated: s.lastUpdated,
  }));
};

module.exports = {
  createGroup,
  getGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  createNode,
  getNode,
  updateNode,
  deleteNode,
  getTree,
  getNodeStock,
  getAllStock,
};
