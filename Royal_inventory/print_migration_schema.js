const fs = require('fs');
const content = fs.readFileSync('migrations/001_create_ops_schema.sql', 'utf8');
const lines = content.split('\n');

let printing = false;
let parenthesesCount = 0;

lines.forEach((line) => {
  if (line.includes('CREATE TABLE ops.transaction_headers') || 
      line.includes('CREATE TABLE ops.transaction_lines') || 
      line.includes('CREATE TABLE ops.transaction_details') || 
      line.includes('CREATE TABLE ops.operational_stock')) {
    printing = true;
    console.log('\n--- SCHEMA DEFINITION ---');
  }
  
  if (printing) {
    console.log(line);
    if (line.includes(');')) {
      printing = false;
    }
  }
});
