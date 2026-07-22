/**
 * tests/integration/ads.controller.test.ts
 *
 * Integration tests for Ads Controller endpoints
 */

import 'reflect-metadata';
import { AdsController } from '../../server/controllers/ads.controller.ts';
import express from 'express';
import request from 'supertest';


describe('AdsController Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/ads', AdsController());
  });

  it('GET /api/v1/ads should return 200 and an object with ads array', async () => {
    const res = await request(app).get('/api/v1/ads?limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ads');
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it('GET /api/v1/ads/search should return 200 array of ads', async () => {
    const res = await request(app).get('/api/v1/ads/search?q=test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
