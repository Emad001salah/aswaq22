import * as admin from 'firebase-admin';
import adminDefault from 'firebase-admin';

console.log('--- * as admin ---');
console.log('type:', typeof admin);
console.log('keys:', Object.keys(admin));
console.log('apps property:', (admin as any).apps);
console.log('default property:', (admin as any).default);

console.log('--- adminDefault ---');
console.log('type:', typeof adminDefault);
console.log('keys:', Object.keys(adminDefault || {}));
console.log('apps property:', (adminDefault as any)?.apps);
