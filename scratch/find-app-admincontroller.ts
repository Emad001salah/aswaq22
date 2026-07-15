import * as fs from 'fs';

const content = fs.readFileSync('d:/Aswaq/server/app.ts', 'utf8');
const lines = content.split('\n');

console.log('Searching for AdminController in app.ts...');
lines.forEach((line, index) => {
  if (line.includes('AdminController') || line.includes('/api/admin')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
