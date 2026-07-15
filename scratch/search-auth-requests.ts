import * as fs from 'fs';

const logPath = 'C:/Users/emado/.gemini/antigravity/brain/e944814f-7b2e-4a1e-8bca-0859b33c84e2/.system_generated/tasks/task-24091.log';
const log = fs.readFileSync(logPath, 'utf8');

const lines = log.split('\n');
let count = 0;
lines.forEach((line) => {
  if (line.includes('/firebase/login') || line.includes('firebase') || line.includes('auth')) {
    console.log(line);
    count++;
  }
});
console.log('Total matching lines:', count);
