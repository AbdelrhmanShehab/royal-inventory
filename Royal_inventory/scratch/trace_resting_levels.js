'use strict';
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/config/swagger.js'), 'utf8');
const lines = content.split('\n');

let level = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') level++;
    if (char === '}') level--;
  }
  
  // If a line ends a path block (ends with }, or })
  const trimmed = line.trim();
  if (trimmed === '}' || trimmed === '},' || trimmed === '};') {
    console.log(`Line ${lineNum}: ${trimmed} | Resting level: ${level}`);
  }
}
