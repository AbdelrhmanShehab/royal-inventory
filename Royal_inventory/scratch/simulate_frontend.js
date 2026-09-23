const http = require('http');

async function apiFetch(endpoint) {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:7500/api/v1' + endpoint, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + require('./src/utils/token').signAccessToken({ id: 1, role: 'admin', fullNameAr: 'admin' }),
        'Content-Type': 'application/json'
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          if (res.statusCode === 401) return reject(new Error('Unauthorized'));
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('JSON Parse error: ' + e.message + ' | Body: ' + body.substring(0, 100)));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const selectedNodeId = 11;
    const nodeStockRes = await apiFetch(/hierarchy/nodes/ + selectedNodeId + /stock);
    console.log('Success:', nodeStockRes.success);
    console.log('Data items length:', nodeStockRes.data && nodeStockRes.data.items ? nodeStockRes.data.items.length : 'No items');
  } catch (err) {
    console.error('Simulated fetch error:', err.message);
  }
})();