import { createApp } from './app';
import { logger } from './logger';

const PORT = process.env.PORT ?? 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info('servidor iniciado', { port: PORT, pid: process.pid });
});

process.on('uncaughtException', (err) => {
  logger.error('excecao nao capturada - encerrando processo', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('promise rejeitada sem tratamento - encerrando processo', { reason });
  process.exit(1);
});

function shutdown(signal: string): void {
  logger.info('sinal recebido, encerrando servidor', { signal });
  server.close(() => {
    logger.info('servidor encerrado');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
