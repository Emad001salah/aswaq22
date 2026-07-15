import { Router } from 'express';
import { MARKETS } from '../../src/markets.js';

export const AdminController = (db: any, saveDb: Function) => {
  const router = Router();

  function getMarketForCity(cityId: string) {
    for (const market of Object.values(MARKETS)) {
      if (market.cities.find((c: any) => c.id === cityId)) {
        return market.id;
      }
    }
    return null;
  }

  router.get('/stats', (req, res) => {
    const market = req.query.market as string;
    
    // Define filtering
    const filterFn = (item: any) => {
        if (!market || market === 'all') return true;
        if (item.city) return getMarketForCity(item.city) === market;
        const userAds = db.ads.filter((a: any) => a.userId === item.id);
        return userAds.some((a: any) => getMarketForCity(a.city) === market);
    };

    const adsFiltered = db.ads.filter((a: any) => {
        if (!market || market === 'all') return true;
        return getMarketForCity(a.city) === market;
    });

    const totalAds = adsFiltered.length;
    const activeAds = adsFiltered.filter((a: any) => a.status === 'active').length;
    const usersFiltered = db.users ? db.users.filter(filterFn) : [];
    
    const totalUsers = usersFiltered.length;
    const verifiedUsers = usersFiltered.filter((u: any) => u.verified).length;
    const totalChats = db.chats ? db.chats.filter((c: any) => {
       const ad = db.ads.find((a: any) => a.id === c.adId);
       if (!ad) return false;
       if (!market || market === 'all') return true;
       return getMarketForCity(ad.city) === market;
    }).length : 0;
    
    const categoryStats = adsFiltered.reduce((acc: any, ad: any) => {
      acc[ad.category] = (acc[ad.category] || 0) + 1;
      return acc;
    }, {});
    
    res.json({
      totalAds,
      activeAds,
      totalUsers,
      verifiedUsers,
      totalChats,
      categoryStats
    });
  });

  router.patch('/settings', (req, res) => {
    if (!db.settings) db.settings = {};
    db.settings = { ...db.settings, ...req.body };
    saveDb(db);
    res.json({ success: true, ...db.settings });
  });

  // Employees Endpoints
  router.get('/employees', (req, res) => {
    res.json(db.employees || []);
  });

  router.post('/employees', (req, res) => {
    const newEmp = req.body;
    if (!newEmp.name || !newEmp.email) return res.status(400).json({ error: 'Missing fields' });
    
    if (!db.employees) db.employees = [];
    newEmp.id = 'emp_' + Date.now();
    db.employees.push(newEmp);
    saveDb(db);
    res.status(201).json(newEmp);
  });

  router.put('/employees/:id', (req, res) => {
    const { id } = req.params;
    if (!db.employees) db.employees = [];
    const empIdx = db.employees.findIndex((e: any) => e.id === id);
    if (empIdx === -1) return res.status(404).json({ error: 'Not found' });
    
    db.employees[empIdx] = { ...db.employees[empIdx], ...req.body };
    saveDb(db);
    res.json(db.employees[empIdx]);
  });

  router.delete('/employees/:id', (req, res) => {
    const { id } = req.params;
    db.employees = (db.employees || []).filter((e: any) => e.id !== id);
    saveDb(db);
    res.json({ success: true });
  });

  return router;
};
