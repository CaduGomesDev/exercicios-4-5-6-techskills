import { Order } from '../models/order.model';

const orders: Record<string, Order> = {
  '1': {
    id: '1',
    items: [{ price: 39.9 }, { price: 15.5 }],
    customer: { name: 'Ana Souza', cardNumber: '4111111111111111' },
  },
  '2': {
    id: '2',
    items: [{ price: 120 }],
    customer: { name: 'Bruno Lima', cardNumber: '5500000000000004' },
  },
};

export async function findOrder(orderId: string): Promise<Order> {
  const order = orders[orderId];
  if (!order) {
    throw new Error(`pedido ${orderId} nao encontrado`);
  }
  return order;
}
