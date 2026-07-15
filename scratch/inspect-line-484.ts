import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript_full.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

const parsed = JSON.parse(lines[483]);
console.log('type:', parsed.type);
console.log('keys:', Object.keys(parsed));
if (parsed.tool_calls) console.log('tool_calls:', parsed.tool_calls);
if (parsed.output) console.log('output length:', parsed.output.length);
// print the whole object keys
console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
