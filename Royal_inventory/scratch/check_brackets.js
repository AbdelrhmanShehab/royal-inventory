'use strict';
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../src/config/swagger.js'), 'utf8');
const lines = content.split('\n');

let openBrackets = 0;
let openParens = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
    if (char === '(') openParens++;
    if (char === ')') openParens--;
  }
  
  if (openBrackets < 0) {
    console.log(`Bracket mismatch at line ${lineNum}: ${line.trim()}`);
    process.exit(1);
  }
  if (openParens < 0) {
    console.log(`Parenthesis mismatch at line ${lineNum}: ${line.trim()}`);
    process.exit(1);
  }
}

console.log(`Finished. Unclosed brackets at end: ${openBrackets}, unclosed parentheses: ${openParens}`);
