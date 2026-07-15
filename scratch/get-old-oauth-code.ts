import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('oauth.controller.ts') && line.includes('write_to_file')) {
    console.log(`Line ${idx + 1} has write_to_file.`);
    try {
      const parsed = JSON.parse(line);
      const toolCalls = parsed.tool_calls || [];
      toolCalls.forEach((tc: any) => {
        if (tc.name === 'write_to_file' && tc.args.CodeContent) {
          console.log('Found CodeContent:');
          console.log(tc.args.CodeContent.substring(0, 1000));
        }
      });
    } catch (e) {
      console.log('Error parsing JSON on line', idx + 1);
    }
  }
});
