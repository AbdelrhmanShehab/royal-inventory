'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const outputFile = path.resolve(__dirname, '../public/inventory_tracking_system.postman_collection.generated.json');
const collectionName = 'Inventory Tracking System (Auto-generated)';
const baseUrlVariableName = 'base_url';
const defaultBaseUrl = 'http://localhost:3000';
let apiPrefix = '/api/v1';

try {
  const config = require('../src/config/index');
  apiPrefix = config.app.apiPrefix || apiPrefix;
} catch (error) {
  console.warn('Warning: could not load config/index.js, defaulting apiPrefix to /api/v1');
}

const originalRouterFactory = express.Router;

express.Router = function (...args) {
  const router = originalRouterFactory(...args);
  const originalUse = router.use;

  router.use = function (first, ...rest) {
    let mountPath = null;
    let childRouter = null;

    if (typeof first === 'string') {
      mountPath = first;
      for (const handler of rest) {
        if (handler && typeof handler.stack !== 'undefined') {
          childRouter = handler;
          break;
        }
      }
    } else {
      for (const handler of [first, ...rest]) {
        if (handler && typeof handler.stack !== 'undefined') {
          childRouter = handler;
          break;
        }
      }
    }

    if (mountPath && childRouter) {
      childRouter.__mountPaths = childRouter.__mountPaths || [];
      childRouter.__mountPaths.push(mountPath);
    }

    return originalUse.call(this, first, ...rest);
  };

  return router;
};

const apiRouter = require('../src/api/v1/index');

function normalizeSegment(segment) {
  if (!segment) return '';
  return segment.startsWith('/') ? segment : `/${segment}`;
}

function joinSegments(...segments) {
  const joined = segments
    .filter(Boolean)
    .map((segment) => segment.replace(/\\/g, '/'))
    .join('/');

  return joined.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/\//g, '/');
}

function normalizePath(prefix, routePath) {
  const full = `${normalizeSegment(prefix)}${normalizeSegment(routePath)}`;
  return full.replace(/\/+/g, '/').replace(/\/\//g, '/');
}

function getMountPathForLayer(layer) {
  if (layer.handle && layer.handle.__mountPaths && layer.handle.__mountPaths.length > 0) {
    return layer.handle.__mountPaths[0];
  }
  if (typeof layer.path === 'string' && layer.path) {
    return layer.path;
  }
  return '';
}

function traverseRouter(router, prefix = '') {
  const routes = [];

  const stack = Array.isArray(router.stack) ? router.stack : [];

  stack.forEach((layer) => {
    if (layer.route) {
      const routePath = Array.isArray(layer.route.path) ? layer.route.path[0] : layer.route.path;
      const methods = Object.keys(layer.route.methods || {})
        .filter((method) => layer.route.methods[method])
        .map((method) => method.toUpperCase());

      routes.push({
        path: normalizePath(prefix, routePath),
        methods,
      });
    } else if (layer.handle && typeof layer.handle.stack !== 'undefined') {
      const mountPath = getMountPathForLayer(layer);
      const nextPrefix = normalizePath(prefix, mountPath || '');
      routes.push(...traverseRouter(layer.handle, nextPrefix));
    }
  });

  return routes;
}

function buildPostmanCollection(routes) {
  const itemsByGroup = new Map();

  routes.forEach((route) => {
    const pathSegments = route.path.split('/').filter(Boolean);
    const groupKey = pathSegments[0] || 'root';
    const groupName = groupKey === 'root' ? 'Root' : `/${groupKey}`;
    const group = itemsByGroup.get(groupName) || [];

    route.methods.forEach((method) => {
      group.push({
        name: `${method} ${route.path}`,
        request: {
          method,
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
          ],
          url: {
            raw: `{{${baseUrlVariableName}}}${route.path}`,
            host: [`{{${baseUrlVariableName}}}`],
            path: route.path.split('/').filter(Boolean),
          },
        },
      });
    });

    itemsByGroup.set(groupName, group);
  });

  const items = Array.from(itemsByGroup.entries()).map(([name, group]) => ({
    name,
    item: group,
  }));

  return {
    info: {
      _postman_id: 'auto-generated-collection',
      name: collectionName,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: [
      {
        key: baseUrlVariableName,
        value: defaultBaseUrl,
        type: 'string',
      },
    ],
  };
}

const discoveredRoutes = traverseRouter(apiRouter, apiPrefix);

discoveredRoutes.push({ path: '/health', methods: ['GET'] });

const collection = buildPostmanCollection(discoveredRoutes);

fs.writeFileSync(outputFile, JSON.stringify(collection, null, 2), 'utf8');
console.log(`Postman collection generated to: ${outputFile}`);
console.log(`Discovered ${discoveredRoutes.length} route entries.`);
