'use strict';
require('dotenv').config();
const http = require('http');
const { signAccessToken } = require('../src/utils/token');

const adminUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  allowedNodeIds: null
};
const token = signAccessToken(adminUser);
console.log('Mock JWT token generated.');

const options = {
  hostname: 'localhost',
  port: 7500,
  path: '/api/v1/laundry/zk/checkins?limit=5',
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
      console.log('Raw Response:\n', data);
    }
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err.message);
  process.exit(1);
});

req.end();
