import * as fs from 'fs';

const filePath = 'd:/Aswaq/src/components/WelcomeFlow.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('googleSignIn') || line.includes('handleGoogleRedirectResult') || line.includes('googleAuth')) {
    console.log(`${index + 1}: ${line}`);
  }
});
