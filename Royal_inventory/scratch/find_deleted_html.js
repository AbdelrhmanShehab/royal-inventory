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
    console.error('Log file does not exist at:', logFile);
    return;
  }
  
  console.log('Reading log file:', logFile);
  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('explorer-operational-tab-content')) {
      console.log('Found line matching query!');
      try {
        const obj = JSON.parse(line);
        console.log('Step Index:', obj.step_index, 'Type:', obj.type);
        if (obj.tool_calls) {
          obj.tool_calls.forEach((tc, idx) => {
            console.log(`Tool call ${idx}:`, tc.name);
            fs.writeFileSync(`scratch/found_${obj.step_index}_${idx}.json`, JSON.stringify(tc, null, 2), 'utf8');
            console.log(`Saved to scratch/found_${obj.step_index}_${idx}.json`);
          });
        }
      } catch (err) {
        // write raw line
        fs.writeFileSync('scratch/raw_match.json', line, 'utf8');
        console.log('Saved raw match to scratch/raw_match.json due to parse error:', err.message);
      }
    }
  }
}

run();
