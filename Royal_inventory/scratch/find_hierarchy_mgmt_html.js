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
    console.error('Log file does not exist.');
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
      if ([433, 434, 448, 449, 472, 473].includes(obj.step_index)) {
        console.log(`Saving step ${obj.step_index} (${obj.type})`);
        fs.writeFileSync(`scratch/prev_step_${obj.step_index}.json`, JSON.stringify(obj, null, 2), 'utf8');
      }
      if (line.includes('hm-folder-name')) {
        console.log(`\nMatch at Step: ${obj.step_index} | Type: ${obj.type}`);
        if (obj.tool_calls) {
          obj.tool_calls.forEach((tc, idx) => {
            if (tc.arguments) {
              if (tc.arguments.ReplacementContent && tc.arguments.ReplacementContent.includes('hm-folder-name')) {
                fs.writeFileSync(`scratch/prev_hierarchy_html_${obj.step_index}_${idx}.txt`, tc.arguments.ReplacementContent, 'utf8');
                console.log(`Saved ReplacementContent to scratch/prev_hierarchy_html_${obj.step_index}_${idx}.txt`);
              }
              if (tc.arguments.CodeContent && tc.arguments.CodeContent.includes('hm-folder-name')) {
                fs.writeFileSync(`scratch/prev_hierarchy_html_${obj.step_index}_${idx}.txt`, tc.arguments.CodeContent, 'utf8');
                console.log(`Saved CodeContent to scratch/prev_hierarchy_html_${obj.step_index}_${idx}.txt`);
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Error parsing line:', err.message);
    }
  }
}

run();
