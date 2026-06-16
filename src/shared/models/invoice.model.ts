export interface Invoice {
  id: string;
  vehicle: string;
  owner: string;
  total: string;
  paid: string;
  balance: string;
  paymentMethod?: string;
  status: 'Pagado' | 'Pendiente' | 'Vencido';
  date?: string;
}
