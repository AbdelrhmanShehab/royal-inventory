'use strict';
const http = require('http');

http.get('http://localhost:7500/', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body Length:', data.length);
    console.log('First 200 chars of body:\n', data.substring(0, 200));
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('Fetch Error:', err.message);
  process.exit(1);
});
