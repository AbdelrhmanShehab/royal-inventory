'use strict';
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  const logFile = path.join(
    'C:', 'Users', 'SELIM', '.gemini', 'antigravity-ide', 'brain',
    '74356405-dfc1-44b9-8372-f0d338d8c9f3', '.system_generated', 'logs', 'transcript_full.jsonl'
  );
  
  if (!fs.existsSync(logFile)) {
    console.error('Log file does not exist at:', logFile);
    return;
  }
  
  console.log('Reading previous session log file:', logFile);
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if ([235, 255, 305, 331, 406, 407].includes(obj.step_index)) {
        console.log(`Saving step ${obj.step_index} (${obj.type})`);
        fs.writeFileSync(`scratch/prev_step_${obj.step_index}.json`, JSON.stringify(obj, null, 2), 'utf8');
      }
    } catch (err) {
      // ignore
    }
  }
}

run();
