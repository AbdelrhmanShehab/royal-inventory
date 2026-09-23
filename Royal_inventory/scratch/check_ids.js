const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');

const regex = /document\.getElementById\(['"]([^'"]+)['"]\)\.addEventListener/g;
let match;
while ((match = regex.exec(appJs)) !== null) {
  const id = match[1];
  if (!indexHtml.includes('id="' + id + '"') && !indexHtml.includes("id='" + id + "'")) {
    console.log('MISSING ID IN HTML:', id);
  }
}