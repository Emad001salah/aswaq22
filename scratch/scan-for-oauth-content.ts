import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/logs/transcript_full.jsonl';
const file = fs.readFileSync(logPath, 'utf8');
const lines = file.split('\n');

let found = false;
for (let idx = 0; idx < lines.length; idx++) {
  const line = lines[idx];
  if (!line.trim()) continue;
  try {
    const parsed = JSON.parse(line);
    // Search in parsed.content or parsed.output or any nested fields
    const checkStr = (val: any): boolean => {
      if (typeof val === 'string' && val.includes('upsertUserFromGoogle') && val.includes('OAuth2Client')) {
        return true;
      }
      return false;
    };

    if (checkStr(parsed.content) || checkStr(parsed.output)) {
      const content = parsed.output || parsed.content;
      // Extract the original file contents by removing the line number prefixes if present
      // The format was: "1: import ... \n2: ..."
      const cleanContent = content.split('\n').map((l: string) => {
        const match = l.match(/^\d+:\s?(.*)$/);
        return match ? match[1] : l;
      }).join('\n');

      fs.writeFileSync('d:/Aswaq/scratch/oauth.controller.ts.bak', cleanContent);
      console.log(`Found and extracted from line ${idx + 1}, step_index: ${parsed.step_index}`);
      found = true;
      break;
    }
  } catch (e: any) {
    // Ignore parse error
  }
}

if (!found) {
  console.log('Could not find upsertUserFromGoogle in the full transcript.');
}
