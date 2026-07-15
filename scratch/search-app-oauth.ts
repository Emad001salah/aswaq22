import * as fs from 'fs';

const content = fs.readFileSync('d:/Aswaq/src/App.tsx', 'utf8');
const lines = content.split('\n');

console.log('Searching for OAuth query parameters parsing in App.tsx...');
lines.forEach((line, index) => {
  if (line.includes('access_token') || line.includes('auth=success') || line.includes('aswaq_current_user')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
