import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('erro nao tratado na rota', { route: req.path, err });
  res.status(500).json({ error: 'erro interno' });
}
