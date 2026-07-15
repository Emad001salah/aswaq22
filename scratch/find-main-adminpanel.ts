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

console.log('Searching for AdminPanel imports or rendering...');
walkDir('d:/Aswaq/src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('AdminPanel') || content.includes('adminPanel') || content.includes('role ===') || content.includes('role === \'admin\'')) {
      console.log('Found in:', filePath);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('AdminPanel') || line.includes('role ===')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
