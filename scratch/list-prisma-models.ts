import * as fs from 'fs';

const content = fs.readFileSync('d:/Aswaq/prisma/schema.prisma', 'utf8');
const lines = content.split('\n');

console.log('Listing all models in schema.prisma:');
lines.forEach((line) => {
  if (line.trim().startsWith('model ')) {
    console.log(line.trim());
  }
});
