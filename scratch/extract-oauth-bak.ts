import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript_full.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('oauth.controller.ts') && line.includes('TOOL_RESPONSE')) {
    console.log(`Line ${idx + 1} has tool response for oauth.controller.ts.`);
    try {
      const parsed = JSON.parse(line);
      console.log('Keys of parsed:', Object.keys(parsed));
      console.log('Step index:', parsed.step_index);
      console.log('Type:', parsed.type);
      console.log('Output preview:', parsed.content?.substring(0, 500) || parsed.output?.substring(0, 500));
      // Save it to a temp file so we can view it cleanly
      fs.writeFileSync('d:/Aswaq/scratch/oauth.controller.ts.bak', parsed.output || parsed.content || '');
      console.log('Saved to scratch/oauth.controller.ts.bak');
    } catch (e: any) {
      console.log('Error parsing:', e.message);
    }
  }
});
