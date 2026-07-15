import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/oauth2/callback';

console.log('GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID);
console.log('GOOGLE_REDIRECT_URI:', GOOGLE_REDIRECT_URI);

const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
const url = client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['openid', 'email', 'profile'],
  state: 'web',
});

console.log('Generated OAuth URL:');
console.log(url);
