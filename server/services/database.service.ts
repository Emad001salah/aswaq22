import fs from 'fs';
import path from 'path';
import { INITIAL_ADS, INITIAL_USERS, INITIAL_CHATS, INITIAL_NOTIFICATIONS } from '../data/initial-data.js';

const DB_FILE = path.join(process.cwd(), 'db.json');

export class DatabaseService {
  private db: any;

  constructor() {
    this.db = this.initDb();
  }

  private initDb() {
    if (fs.existsSync(DB_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      } catch (e) {
        console.error('DB Resetting due to error', e);
      }
    }
    const defaultDb = {
      ads: INITIAL_ADS,
      users: INITIAL_USERS,
      chats: INITIAL_CHATS,
      notifications: INITIAL_NOTIFICATIONS
    };
    this.save(defaultDb);
    return defaultDb;
  }

  public getDb() {
    return this.db;
  }

  public save(data?: any) {
    if (data) this.db = data;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (e) {
      console.error('Save failed', e);
    }
  }
}
