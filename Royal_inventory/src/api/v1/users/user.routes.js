'use strict';

const router = require('express').Router();
const controller = require('./user.controller');
const { authenticate } = require('../../../middleware/auth.middleware');
const { authorizePermission } = require('../../../middleware/rbac.middleware');

/**
 * User Management Routes
 * Base: /api/v1/users
 * All write operations gated by manage_users permission (DB-driven).
 */

const validate = require('../../../middleware/validate.middleware');
const { createUserSchema, updateUserSchema, resetPasswordSchema } = require('./user.validation');

// List / Create
router.route('/')
  .post(authenticate, authorizePermission('manage_users'), validate(createUserSchema), controller.createUser)
  .get(authenticate,  authorizePermission('manage_users'), controller.listUsers);

// Get / Update / Delete single user
router.route('/:id')
  .get(authenticate,    authorizePermission('manage_users'), controller.getUser)
  .put(authenticate,    authorizePermission('manage_users'), validate(updateUserSchema), controller.updateUser)
  .delete(authenticate, authorizePermission('manage_users'), controller.deleteUser);

// Admin reset any user's password (no old password needed)
router.patch('/:id/reset-password',
  authenticate,
  authorizePermission('manage_users'),
  validate(resetPasswordSchema),
  controller.resetPassword
);

module.exports = router;
