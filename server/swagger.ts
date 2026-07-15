/**
 * Swagger / OpenAPI 3.0 Setup
 * Docs served at: GET /api/docs
 *
 * Uses swagger-jsdoc to collect @openapi JSDoc comments
 * and swagger-ui-express to render interactive UI.
 *
 * Install (if not present):
 *   npm install swagger-jsdoc swagger-ui-express
 *   npm install -D @types/swagger-jsdoc @types/swagger-ui-express
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Aswaq Enterprise API',
      version: '1.0.0',
      description: `
## 🏪 منصة أسواق – توثيق الـ API الكامل
منصة إعلانات مبوبة مبنية على Express + PostgreSQL + Redis + Meilisearch.

### المصادقة
جميع المسارات المحمية تتطلب **Bearer Token** في الـ Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

### معدل الطلبات
- مسارات عامة: 2000 طلب / 15 دقيقة
- مسارات المصادقة: 20 طلب / دقيقة
      `,
      contact: { name: 'Aswaq Team', email: 'dev@aswaq.com' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: '/api/v1', description: 'Production Server' },
      { url: 'https://aswaq22.com/api/v1', description: 'Production (remote)' },
      { url: 'http://localhost:3000/api/v1', description: 'Local Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success:       { type: 'boolean', example: false },
            status:        { type: 'integer', example: 400 },
            error:         { type: 'string',  example: 'Bad Request' },
            message:       { type: 'string',  example: 'Validation failed' },
            correlationId: { type: 'string',  example: 'uuid-here' },
          },
        },
        Ad: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            description: { type: 'string' },
            price:       { type: 'number' },
            currency:    { type: 'string', example: 'YER' },
            city:        { type: 'string' },
            category:    { type: 'string' },
            status:      { type: 'string', enum: ['PENDING', 'ACTIVE', 'SOLD', 'EXPIRED', 'REJECTED'] },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:     { type: 'string', format: 'uuid' },
            email:  { type: 'string', format: 'email' },
            name:   { type: 'string' },
            role:   { type: 'string', enum: ['USER', 'ADMIN', 'AGENT', 'MERCHANT', 'MODERATOR'] },
            avatar: { type: 'string', nullable: true },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'غير مصادق – يرجى تسجيل الدخول',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        Forbidden: {
          description: 'غير مصرح لك بهذا الإجراء',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        NotFound: {
          description: 'العنصر غير موجود',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    tags: [
      { name: 'Auth',          description: 'تسجيل الدخول والمصادقة' },
      { name: 'Ads',           description: 'إدارة الإعلانات' },
      { name: 'Users',         description: 'ملفات المستخدمين' },
      { name: 'Chat',          description: 'المحادثات الفورية' },
      { name: 'Notifications', description: 'إشعارات المستخدمين' },
      { name: 'Health',        description: 'فحص صحة الخدمات' },
    ],
  },
  apis: [
    './server/controllers/*.ts',
    './server/dto/*.ts',
    './server/app.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  // Interactive Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Aswaq API Docs',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        defaultModelsExpandDepth: 2,
      },
    })
  );

  // Raw JSON spec – useful for Postman / Insomnia import
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Canonical OpenAPI endpoint – MUST return JSON, not HTML
  app.get('/api/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Backward-compat alias (some tools still expect /swagger.json)
  app.get('/api/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger docs available at: /api/docs');
}
