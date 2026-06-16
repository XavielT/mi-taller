import { Injectable, inject } from '@angular/core';
import { Invoice } from '../models/invoice.model';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FinancesService {
  // Mock summary — replace with API response in production
  private readonly mockSummary = {
    dailyRevenue: '$12,450.00',
    pending: '$3,205.50',
    overdue: '$940.00',
    avgTicket: '$415'
  };

  private readonly mockInvoices: Invoice[] = [
    { id: '1', vehicle: 'Toyota Camry (ABC-1234)', owner: 'John Doe', total: '$1,250.00', paid: '$1,250.00', balance: '$0.00', paymentMethod: 'Visa •••• 4242', status: 'Pagado', date: '2026-06-11' },
    { id: '2', vehicle: 'Tesla Model 3 (ELK-0987)', owner: 'Sarah Smith', total: '$3,450.00', paid: '$2,000.00', balance: '$1,450.00', paymentMethod: 'Transferencia bancaria', status: 'Pendiente', date: '2026-06-12' },
    { id: '3', vehicle: 'Ford F-150 (TRK-5566)', owner: 'Robert Miller', total: '$940.00', paid: '$0.00', balance: '$940.00', paymentMethod: 'No especificado', status: 'Vencido', date: '2026-05-27' },
    { id: '4', vehicle: 'MB Sprinter (VAN-9900)', owner: 'Logistic Solutions', total: '$5,680.00', paid: '$5,680.00', balance: '$0.00', paymentMethod: 'Efectivo', status: 'Pagado', date: '2026-06-05' }
  ];

  // If you want to use a real API, set `window.__API_BASE__ = 'https://api.example.com'` before bootstrap.
  private http = inject(HttpClient);
  private apiBase: string | null = (window as any).__API_BASE__ ?? null;

  constructor() {}

  async getSummary(): Promise<any> {
    if (this.apiBase) {
      const $obs = this.http.get(`${this.apiBase}/finances/summary`);
      return lastValueFrom($obs as any);
    }
    return new Promise((res) => setTimeout(() => res(this.mockSummary), 250));
  }

  async getInvoices(status?: string): Promise<Invoice[]> {
    // status: 'Pagado' | 'Pendiente' | 'Vencido' — if provided, filter
    if (this.apiBase) {
      const url = `${this.apiBase}/invoices${status ? `?status=${encodeURIComponent(status)}` : ''}`;
      return lastValueFrom(this.http.get<Invoice[]>(url) as any);
    }
    return new Promise((res) => setTimeout(() => {
      if (status) {
        res(this.mockInvoices.filter(i => i.status === status));
      } else {
        res(this.mockInvoices);
      }
    }, 300));
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    if (this.apiBase) {
      try {
        return lastValueFrom(this.http.get<Invoice>(`${this.apiBase}/invoices/${id}`) as any);
      } catch {
        return null;
      }
    }
    return new Promise((res) => setTimeout(() => res(this.mockInvoices.find(i => i.id === id) ?? null), 200));
  }

  async createInvoice(payload: Partial<Invoice>): Promise<Invoice> {
    if (this.apiBase) {
      return lastValueFrom(this.http.post<Invoice>(`${this.apiBase}/invoices`, payload) as any);
    }

    const newInv: Invoice = {
      id: String(Date.now()),
      vehicle: payload.vehicle || 'Vehículo',
      owner: payload.owner || 'Cliente',
      total: payload.total || '$0.00',
      paid: payload.paid || '$0.00',
      balance: payload.balance || '$0.00',
      paymentMethod: payload.paymentMethod,
      status: (payload.status as any) || 'Pendiente',
      date: payload.date || new Date().toISOString().slice(0,10)
    };
    this.mockInvoices.unshift(newInv);
    return new Promise((res) => setTimeout(() => res(newInv), 200));
  }
}
