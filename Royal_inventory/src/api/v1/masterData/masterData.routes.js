'use strict';

const router = require('express').Router();
const controller = require('./masterData.controller');
const { authenticate } = require('../../../middleware/auth.middleware');

const validate = require('../../../middleware/validate.middleware');
const { categoriesQuerySchema, itemsQuerySchema } = require('./masterData.validation');

/**
 * Master Data Routes
 * Base: /api/v1/master-data
 */
router.get('/categories', authenticate, validate(categoriesQuerySchema, 'query'), controller.getCategories);
router.get('/items', authenticate, validate(itemsQuerySchema, 'query'), controller.getItems);

module.exports = router;
