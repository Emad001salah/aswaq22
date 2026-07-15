import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

console.log('Searching for references to "users/me"...');
walkDir('d:/Aswaq', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.json')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('users/me')) {
      console.log('Found in:', filePath);
      // print matching lines
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('users/me')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
