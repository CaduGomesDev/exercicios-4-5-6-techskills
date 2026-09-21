export interface OrderItem {
  price: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  customer: {
    name: string;
    cardNumber: string;
  };
}
