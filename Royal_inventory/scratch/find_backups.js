'use strict';
const fs = require('fs');
const path = require('path');

function findHistoryFiles() {
  const appData = process.env.APPDATA;
  if (!appData) {
    console.log('APPDATA environment variable not found.');
    return;
  }

  // VS Code history path
  const vscodeHistory = path.join(appData, 'Code', 'User', 'History');
  console.log('Searching VS Code history at:', vscodeHistory);

  if (!fs.existsSync(vscodeHistory)) {
    console.log('VS Code history path does not exist.');
    return;
  }

  // Walk VS Code history directories
  const subdirs = fs.readdirSync(vscodeHistory);
  const found = [];

  for (const subdir of subdirs) {
    const subdirPath = path.join(vscodeHistory, subdir);
    if (!fs.statSync(subdirPath).isDirectory()) continue;

    const files = fs.readdirSync(subdirPath);
    for (const file of files) {
      if (file === 'entries.json') {
        const entriesPath = path.join(subdirPath, file);
        try {
          const content = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
          if (content.resource && content.resource.includes('index.html')) {
            console.log(`Found entries in ${subdir}:`, content.resource);
            // List all files in this directory sorted by modified time
            content.entries.forEach(e => {
              const filePath = path.join(subdirPath, e.id);
              if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                found.push({
                  path: filePath,
                  time: stat.mtime,
                  size: stat.size,
                  resource: content.resource
                });
              }
            });
          }
        } catch (err) {
          // ignore
        }
      }
    }
  }

  // Sort found files by time descending
  found.sort((a, b) => b.time - a.time);

  console.log('\nRecent backups of index.html:');
  found.slice(0, 10).forEach(f => {
    console.log(`- Path: ${f.path} | Time: ${f.time.toISOString()} | Size: ${f.size} bytes | Resource: ${f.resource}`);
  });
}

findHistoryFiles();
