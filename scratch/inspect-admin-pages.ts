import * as fs from 'fs';
import * as path from 'path';

const pagesDir = 'd:/Aswaq/admin/src/pages';
const files = fs.readdirSync(pagesDir);

console.log('--- Checking Admin Dashboard Pages for backend fetch logic ---');
for (const file of files) {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const hasFetch = content.includes('fetch(') || content.includes('axios');
    const hasPlaceholder = content.includes('Placeholder') || content.includes('[]') || content.includes('const users = []');
    console.log(`${file}: hasFetch=${hasFetch}, hasPlaceholder=${hasPlaceholder}`);
  }
}
