import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('oauth.controller.ts')) {
    console.log(`Line ${idx + 1}:`);
    try {
      const parsed = JSON.parse(line);
      console.log('type:', parsed.type, 'status:', parsed.status);
      if (parsed.tool_calls) {
        parsed.tool_calls.forEach((tc: any) => {
          console.log('  tool:', tc.name);
          if (tc.args.TargetFile) console.log('    target:', tc.args.TargetFile);
        });
      }
    } catch (e) {
      console.log('  (not valid json line)');
    }
  }
});
