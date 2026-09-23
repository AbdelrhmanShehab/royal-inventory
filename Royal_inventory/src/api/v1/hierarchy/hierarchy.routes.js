'use strict';

const router = require('express').Router();
const controller = require('./hierarchy.controller');
const { authenticate } = require('../../../middleware/auth.middleware');
const { authorizePermission } = require('../../../middleware/rbac.middleware');

const validate = require('../../../middleware/validate.middleware');
const { createGroupSchema, createNodeSchema, updateNodeSchema, treeQuerySchema, nodePathParamsSchema } = require('./hierarchy.validation');

/**
 * Hierarchy Routes
 * Base: /api/v1/hierarchy
 * Write-operations (create/update/delete nodes & groups) gated by manage_nodes permission.
 */

// ─── Tree & Stock Read Routes ─────────────────────────────────────────────────
router.get('/tree',  authenticate, validate(treeQuerySchema, 'query'), controller.getTree);
router.get('/stock', authenticate, validate(treeQuerySchema, 'query'), controller.getAllStock);

// ─── Group Routes ─────────────────────────────────────────────────────────────
router.route('/groups')
  .post(authenticate, authorizePermission('manage_nodes'), validate(createGroupSchema), controller.createGroup)
  .get(authenticate, controller.listGroups);

router.route('/groups/:id')
  .get(authenticate, controller.getGroup)
  .put(authenticate,  authorizePermission('manage_nodes'), validate(createGroupSchema), controller.updateGroup)
  .delete(authenticate, authorizePermission('manage_nodes'), controller.deleteGroup);

// ─── Node Routes ──────────────────────────────────────────────────────────────
router.route('/nodes')
  .post(authenticate, authorizePermission('manage_nodes'), validate(createNodeSchema), controller.createNode);

router.get('/nodes/:id/stock', authenticate, validate(nodePathParamsSchema, 'params'), controller.getNodeStock);

router.route('/nodes/:id')
  .get(authenticate, validate(nodePathParamsSchema, 'params'), controller.getNode)
  .put(authenticate,    authorizePermission('manage_nodes'), validate(nodePathParamsSchema, 'params'), validate(updateNodeSchema), controller.updateNode)
  .delete(authenticate, authorizePermission('manage_nodes'), validate(nodePathParamsSchema, 'params'), controller.deleteNode);

module.exports = router;
