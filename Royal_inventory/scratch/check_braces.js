'use strict';
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/config/swagger.js'), 'utf8');
const lines = content.split('\n');

let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  const oldBraces = openBraces;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
  }
  
  // If this line changed the brace count at path definitions, print it
  if (line.includes(':/') || line.includes("'/") || line.trim().startsWith("'/") || line.trim().startsWith("'/laundry")) {
    console.log(`Line ${lineNum} (Path start): ${line.trim()} | Open Braces: ${openBraces}`);
  }
}

console.log(`Unclosed braces at end: ${openBraces}`);
