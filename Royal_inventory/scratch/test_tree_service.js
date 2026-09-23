'use strict';
require('dotenv').config();
const { connectSystemDB } = require('../src/config/database');
const service = require('../src/api/v1/hierarchy/hierarchy.service');

async function run() {
  try {
    await connectSystemDB();
    console.log('Calling hierarchyService.getTree(2)...');
    const tree = await service.getTree(2, null);
    console.log('Result:\n', JSON.stringify(tree, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
