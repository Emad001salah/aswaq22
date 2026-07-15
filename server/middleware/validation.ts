import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Request, Response, NextFunction } from 'express';

export function validationMiddleware<T>(type: any): any {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = plainToInstance(type, req.body);
      const errors = await validate(input);
      if (errors.length > 0) {
        const messages = errors.map(error => Object.values(error.constraints || {})).flat();
        return res.status(400).json({ 
          error: 'Validation Failed', 
          message: 'فشل التحقق من صحة المدخلات. يرجى مراجعة الحقول المرسلة.',
          details: messages 
        });
      }
      req.body = input; // Keep the typed instance
      next();
    } catch (e: any) {
      res.status(500).json({ error: 'Validation Error', message: e.message });
    }
  };
}
