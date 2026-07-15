import * as fs from 'fs';

const file = fs.readFileSync('d:/Aswaq/server/app.ts', 'utf8');
const lines = file.split('\n');

lines.forEach((line, index) => {
  if (line.includes('AuthController()')) {
    console.log(`${index + 1}: ${line}`);
  }
});
