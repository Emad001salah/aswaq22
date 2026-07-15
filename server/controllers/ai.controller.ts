import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';

export const AiController = (db: any) => {
  const router = Router();

  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    return new GoogleGenAI({
      apiKey: key || 'MOCK_KEY',
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  };

  router.post('/search-assistant', async (req, res) => {
    const { query } = req.body;
    try {
      const ai = getGeminiClient();
      const adsBrief = db.ads.map((ad: any) => ({ id: ad.id, title: ad.title, price: ad.price }));
      const prompt = `أنت مستشار مبيعات خبير للمنصة العالمية الموحدة للتجارة (The Global Market). العميل يبحث عن: "${query}". قاعدة البيانات: ${JSON.stringify(adsBrief)}`;
      const response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
      res.json({ reply: response.text });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Additional AI features (enhance-ad, negotiate) would be moved here...

  return router;
};
