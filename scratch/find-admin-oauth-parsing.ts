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

console.log('Searching for query param parsing in admin dashboard...');
walkDir('d:/Aswaq/admin/src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('access_token') || content.includes('URLSearchParams') || content.includes('auth=success')) {
      console.log('Found in:', filePath);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('access_token') || line.includes('URLSearchParams') || line.includes('auth=success')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
