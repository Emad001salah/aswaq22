import { Router } from 'express';

export const ChatsController = (db: any, databaseService: any) => {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(db.chats || []);
  });

  router.get('/rooms', (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const userMessages = db.chats.filter((m: any) => m.senderId === userId || m.receiverId === userId);
    const roomsMap = new Map();

    userMessages.forEach((m: any) => {
      const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
      const key = `${partnerId}_${m.adId}`;
      if (!roomsMap.has(key)) {
        const partner = db.users.find((u: any) => u.id === partnerId);
        const ad = db.ads.find((a: any) => a.id === m.adId);
        roomsMap.set(key, {
          id: key,
          partnerId,
          partnerName: partner?.name || 'مستخدم',
          partnerAvatar: partner?.avatar,
          adId: m.adId,
          adTitle: ad?.title || 'إعلان محذوف',
          lastMessage: m.text,
          lastTimestamp: m.timestamp,
          unreadCount: (m.receiverId === userId && !m.read) ? 1 : 0
        });
      } else {
        const room = roomsMap.get(key);
        if (new Date(m.timestamp) > new Date(room.lastTimestamp)) {
          room.lastMessage = m.text;
          room.lastTimestamp = m.timestamp;
        }
        if (m.receiverId === userId && !m.read) {
          room.unreadCount++;
        }
      }
    });

    res.json(Array.from(roomsMap.values()));
  });

  router.post('/', (req: any, res) => {
    const { adId, senderId, receiverId, text } = req.body;
    const newMessage = {
      id: `msg_${Date.now()}`,
      adId, senderId, receiverId, text,
      timestamp: new Date().toISOString(),
      read: false
    };
    db.chats.push(newMessage);
    databaseService.save();

    // Real-time broadcast
    if (req.io) {
      req.io.to(receiverId).emit('new-message', newMessage);
    }

    res.status(201).json(newMessage);
  });

  return router;
};
