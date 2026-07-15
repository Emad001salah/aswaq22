import * as fs from 'fs';

const content = fs.readFileSync('d:/Aswaq/src/components/AdminPanel.tsx', 'utf8');
const lines = content.split('\n');

console.log('Searching for simulated metrics in AdminPanel.tsx...');
lines.forEach((line, index) => {
  if (line.includes('req/sec') || line.includes('2,410') || line.includes('activeUsers') || line.includes('Math.random()')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
