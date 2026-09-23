'use strict';
const http = require('http');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON: ' + data.substring(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    console.log('Fetching groups list...');
    const groups = await getJSON('http://localhost:7500/api/v1/hierarchy/groups');
    console.log('Groups:', JSON.stringify(groups, null, 2));

    if (groups.success && groups.data && groups.data.length > 0) {
      const groupId = groups.data[0].id;
      console.log(`\nFetching tree for groupId=${groupId}...`);
      const tree = await getJSON(`http://localhost:7500/api/v1/hierarchy/tree?groupId=${groupId}&ignoreScope=true`);
      console.log('Tree:', JSON.stringify(tree, null, 2));
    } else {
      console.log('No groups found in the response.');
    }
  } catch (err) {
    console.error('Error fetching data:', err.message);
  }
}

run();
