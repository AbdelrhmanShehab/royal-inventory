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
    if (line.toLowerCase().includes('index.html')) {
      try {
        const obj = JSON.parse(line);
        console.log(`Match at Step: ${obj.step_index} | Type: ${obj.type}`);
        if (obj.tool_calls) {
          obj.tool_calls.forEach((tc, idx) => {
            console.log(`  Tool: ${tc.name} | Target: ${tc.arguments?.TargetFile || tc.arguments?.AbsolutePath}`);
            fs.writeFileSync(`scratch/index_match_${obj.step_index}_${idx}.json`, JSON.stringify(tc, null, 2), 'utf8');
          });
        }
      } catch (err) {
        // ignore
      }
    }
  }
}

run();
