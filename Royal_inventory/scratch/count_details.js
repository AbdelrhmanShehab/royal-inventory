'use strict';
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/config/swagger.js'), 'utf8');
const lines = content.split('\n');
const line = lines[1041]; // line 1042 (0-indexed 1041)

console.log('Line 1106:', line);
let level = 0;
for (let j = 0; j < line.length; j++) {
  const char = line[j];
  if (char === '{') {
    level++;
    console.log(`char ${j} '{' -> level: ${level}`);
  }
  if (char === '}') {
    level--;
    console.log(`char ${j} '}' -> level: ${level}`);
  }
}
console.log('Net change:', level);
