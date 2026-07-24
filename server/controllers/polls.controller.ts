import { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { redis } from '../../src/lib/redis.ts';

export const PollsController = () => {
  const router = Router();

  // GET /api/polls - Fetch community polls
  router.get('/', async (req, res) => {
    const { countryCode } = req.query;
    try {
      const polls = await prisma.poll.findMany({
        where: {
          OR: [
            { countryCode: countryCode ? String(countryCode).toUpperCase() : 'ALL' },
            { countryCode: 'ALL' }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      res.json(polls);
    } catch (e: any) {
      res.json([]);
    }
  });

  // POST /api/polls/:id/vote - Cast a vote in a poll
  router.post('/:id/vote', async (req, res) => {
    const { id } = req.params;
    const { optionIndex } = req.body;
    if (optionIndex === undefined || typeof optionIndex !== 'number') {
      return res.status(400).json({ error: 'Option index is required' });
    }

    // Extract real client IP behind proxies (Cloudflare, Render, etc.)
    const forwardHeader = req.headers['x-forwarded-for'];
    const voterIp = req.headers['cf-connecting-ip'] || 
                    (Array.isArray(forwardHeader) ? forwardHeader[0] : forwardHeader?.split(',')[0]) || 
                    req.ip || 
                    req.socket.remoteAddress || 
                    'unknown';
                    
    const voteKey = `poll_vote:${id}:${voterIp}`;
    try {
      const alreadyVoted = await redis.get(voteKey);
      if (alreadyVoted) {
        return res.status(429).json({ error: 'لقد صوّتت بالفعل على هذا الاستطلاع.' });
      }

      const poll = await prisma.poll.findUnique({ where: { id } });
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }

      const newVotes = [...poll.votes];
      if (optionIndex >= 0 && optionIndex < newVotes.length) {
        newVotes[optionIndex] += 1;
      }

      const updated = await prisma.poll.update({
        where: { id },
        data: { votes: newVotes }
      });

      // Record vote — expires after 24 hours (fail open if Redis is down)
      await redis.set(voteKey, '1', 86400);

      res.json({ success: true, votes: updated.votes });
    } catch (err: any) {
      res.status(500).json({ error: 'Vote registration failed', message: err.message });
    }
  });

  return router;
};
