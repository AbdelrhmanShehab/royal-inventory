'use strict';
require('dotenv').config();
const http = require('http');
const { signAccessToken } = require('../src/utils/token');

// Mock user object for admin
const adminUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  allowedNodeIds: null
};

// Generate token
const token = signAccessToken(adminUser);
console.log('Generated mock JWT admin token:', token);

// Request options
const options = {
  hostname: 'localhost',
  port: 7500,
  path: '/api/v1/hierarchy/tree?groupId=2',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('API Response:\n', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Non-JSON Response:\n', data);
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err.message);
  process.exit(1);
});

req.end();
