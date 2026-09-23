'use strict';
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/config/swagger.js'), 'utf8');
const lines = content.split('\n');

let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
  }
  
  if (lineNum >= 1110 && lineNum <= 1144) {
    console.log(`Line ${lineNum}: ${line.trim()} | Braces: ${openBraces}`);
  }
}
