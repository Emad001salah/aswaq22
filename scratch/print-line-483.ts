import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

const parsed = JSON.parse(lines[482]); // Line 483 is index 482
console.log(parsed.content);
