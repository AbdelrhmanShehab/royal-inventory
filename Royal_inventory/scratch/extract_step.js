'use strict';
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const logFile = path.join(
    'C:', 'Users', 'SELIM', '.gemini', 'antigravity-ide', 'brain',
    '6c00a7a2-63e4-4080-9615-b66a8f1c02d1', '.system_generated', 'logs', 'transcript_full.jsonl'
  );
  
  if (!fs.existsSync(logFile)) {
    console.error('Log file does not exist.');
    return;
  }
  
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if ([293, 304, 326].includes(obj.step_index)) {
        console.log(`\n--- STEP ${obj.step_index} (${obj.type}) ---`);
        fs.writeFileSync(`scratch/step_${obj.step_index}.json`, JSON.stringify(obj, null, 2), 'utf8');
        console.log(`Saved step to scratch/step_${obj.step_index}.json`);
      }
    } catch (err) {
      // ignore
    }
  }
}

run();
