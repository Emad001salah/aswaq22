import * as fs from 'fs';
import * as path from 'path';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('oauth.controller.ts') && (line.includes('CodeContent') || line.includes('TargetContent') || line.includes('ReplacementContent'))) {
    console.log(`Line ${idx + 1} matches.`);
    // print a snippet of the line
    console.log(line.substring(0, 300));
  }
});
