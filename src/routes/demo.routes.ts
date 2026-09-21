import { Router } from 'express';
import { logger } from '../logger';
import { processOrder } from '../services/process-order';

export const demoRouter = Router();

demoRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

demoRouter.get('/usuarios/:id', (req, res) => {
  res.json({ id: req.params.id, nome: `Usuario ${req.params.id}` });
});

demoRouter.get('/lento', (_req, res) => {
  setTimeout(() => {
    res.json({ status: 'ok', atrasoMs: 800 });
  }, 800);
});

demoRouter.get('/erro', (_req, _res, next) => {
  next(new Error('falha proposital para teste do exercicio 5'));
});

demoRouter.get('/pedidos/:id', async (req, res, next) => {
  try {
    const total = await processOrder(req.params.id);
    res.json({ orderId: req.params.id, total });
  } catch (err) {
    next(err);
  }
});

demoRouter.get('/crash', (_req, res) => {
  res.json({ ok: true, aviso: 'processamento em segundo plano iniciado' });

  setTimeout(() => {
    try {
      throw new Error('falha ao processar a fila');
    } catch (err) {
      logger.error('falha ao processar item da fila', { err });
    }
  }, 100);
});
