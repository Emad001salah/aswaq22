import * as crypto from 'crypto';

export function getDeterministicUuid(str: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('sha256').update(str).digest('hex');
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = '4' + hash.substring(13, 16);
  const part4 = 'a' + hash.substring(17, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

const STATIC_CATEGORIES = ['cars', 'realestate', 'electronics', 'phones', 'laptops', 'jobs', 'general'];
const STATIC_SUBCATEGORIES = [
  'sedan', 'suv', 'truck', 'motorcycle', 
  'apartment', 'villa', 'land', 'commercial', 
  'computers', 'cameras', 'audio', 
  'iphone', 'samsung', 'xiaomi', 'other-phones', 
  'macbook', 'thinkpad', 'dell', 'hp', 
  'engineering', 'sales', 'marketing', 'healthcare', 'education', 'hospitality', 'customer-service', 'other-jobs'
];

const REVERSE_MAP: Record<string, string> = {};

STATIC_CATEGORIES.forEach(cat => {
  REVERSE_MAP[getDeterministicUuid(cat)] = cat;
});

STATIC_SUBCATEGORIES.forEach(sub => {
  REVERSE_MAP[getDeterministicUuid(sub)] = sub;
});

export function getLegacyName(uuid: string | null | undefined): string | null {
  if (!uuid) return null;
  return REVERSE_MAP[uuid.toLowerCase()] || uuid;
}
