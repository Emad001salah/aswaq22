import { Router } from 'express';

export const NotificationsController = (db: any, databaseService: any) => {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(db.notifications || []);
  });

  router.post('/read', (req, res) => {
    if (db.notifications) {
      db.notifications.forEach((n: any) => n.read = true);
      databaseService.save();
    }
    res.json({ success: true });
  });

  return router;
};
