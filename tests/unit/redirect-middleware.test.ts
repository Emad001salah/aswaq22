import { describe, it, expect, beforeEach } from '@jest/globals';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Helper function to create express app with canonical redirect middleware
function createRedirectApp() {
  const app = express();
  app.set('trust proxy', true);

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/sitemaps') || req.path.startsWith('/sitemap.xml')) {
      return next();
    }

    const host = req.headers.host || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

    if (isLocal) {
      return next();
    }

    const disableForceHttps = process.env.DISABLE_FORCE_HTTPS === 'true' || process.env.ENFORCE_HTTPS === 'false';
    const disableCanonicalRedirect = process.env.DISABLE_CANONICAL_REDIRECT === 'true';
    const enforceWww = process.env.ENFORCE_WWW !== 'false';

    const forwardedProto = req.headers['x-forwarded-proto'];
    const firstProto = typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim().toLowerCase()
      : (req.protocol || 'http').toLowerCase();

    let cfIsHttps = false;
    if (req.headers['cf-visitor']) {
      try {
        const cfVisitor = JSON.parse(req.headers['cf-visitor'] as string);
        if (cfVisitor.scheme === 'https') cfIsHttps = true;
      } catch (e) {}
    }

    const isHttps = firstProto === 'https' || req.secure || cfIsHttps;
    const isHttp = !isHttps && !disableForceHttps;

    const needsWww = enforceWww && !disableCanonicalRedirect && host.toLowerCase() === 'aswaq22.com';
    const hasUppercasePath = /[A-Z]/.test(req.path);
    const pathEndsWithSlash = req.path.length > 1 && req.path.endsWith('/');
    const cleanPath = pathEndsWithSlash ? req.path.slice(0, -1) : req.path;

    if (isHttp || needsWww || hasUppercasePath || pathEndsWithSlash) {
      const targetProto = disableForceHttps ? (isHttps ? 'https' : 'http') : 'https';
      const canonicalHost = needsWww ? 'www.aswaq22.com' : host;
      const canonicalPath = cleanPath.toLowerCase();
      const queryString = req.url.slice(req.path.length);

      const redirectTarget = `${targetProto}://${canonicalHost}${canonicalPath}${queryString}`;
      const currentUrl = `${isHttps ? 'https' : 'http'}://${host}${req.path}${queryString}`;

      if (redirectTarget !== currentUrl) {
        return res.redirect(301, redirectTarget);
      }
    }
    next();
  });

  app.get('*', (req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  return app;
}

describe('Canonical & HTTPS Redirect Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('should redirect http://aswaq22.com to https://www.aswaq22.com', async () => {
    const app = createRedirectApp();
    const res = await request(app)
      .get('/')
      .set('Host', 'aswaq22.com')
      .set('X-Forwarded-Proto', 'http');

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://www.aswaq22.com/');
  });

  it('should NOT redirect when already on https://www.aswaq22.com/', async () => {
    const app = createRedirectApp();
    const res = await request(app)
      .get('/')
      .set('Host', 'www.aswaq22.com')
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  it('should NOT produce redirect loop when Cloudflare cf-visitor header is https', async () => {
    const app = createRedirectApp();
    const res = await request(app)
      .get('/')
      .set('Host', 'www.aswaq22.com')
      .set('X-Forwarded-Proto', 'http') // Cloudflare to origin connection is HTTP
      .set('cf-visitor', '{"scheme":"https"}'); // Client to Cloudflare connection is HTTPS

    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
  });

  it('should NOT redirect sitemap files', async () => {
    const app = createRedirectApp();
    const res = await request(app)
      .get('/sitemap.xml')
      .set('Host', 'aswaq22.com')
      .set('X-Forwarded-Proto', 'http');

    expect(res.status).toBe(200);
  });

  it('should honor ENFORCE_HTTPS=false environment override', async () => {
    process.env.ENFORCE_HTTPS = 'false';
    const app = createRedirectApp();
    const res = await request(app)
      .get('/')
      .set('Host', 'www.aswaq22.com')
      .set('X-Forwarded-Proto', 'http');

    expect(res.status).toBe(200);
  });
});
