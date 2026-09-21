import { logger } from '../logger';
import { findOrder } from './order.service';

export async function processOrder(orderId: string): Promise<number> {
  logger.info('inicio do processamento', { orderId });

  try {
    const order = await findOrder(orderId);
    const total = order.items.reduce((sum, item) => sum + item.price, 0);
    logger.info('fim do processamento', { orderId, itemCount: order.items.length, total });
    return total;
  } catch (err) {
    logger.error('falha ao processar pedido', { orderId, err });
    throw err;
  }
}
