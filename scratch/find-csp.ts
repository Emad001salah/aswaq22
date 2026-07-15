import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

walkDir('d:/Aswaq/server', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('helmet') || content.includes('contentSecurityPolicy')) {
      console.log('Match found in:', filePath);
    }
  }
});
