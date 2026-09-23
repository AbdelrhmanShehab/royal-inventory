'use strict';
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
const terms = ['getAverageCost', 'getIntakeSince', 'getMovementsSince'];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  terms.forEach(term => {
    if (content.includes(term)) {
      console.log(`Found reference to ${term} in:`, f);
    }
  });
});
