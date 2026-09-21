import express, { Application } from 'express';
import { requestLogger } from './middlewares/request-logger';
import { notFoundHandler } from './middlewares/not-found';
import { errorHandler } from './middlewares/error-handler';
import { demoRouter } from './routes/demo.routes';

export function createApp(): Application {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(demoRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
