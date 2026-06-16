import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RepairsService {
  private readonly boards = [
    { title: 'Recepción', count: 3, items: [
      { id: 'r1', vehicle: 'Toyota Camry 2022', plate: 'ABC-1234', type: 'Sedán', owner: 'Carlos R.', short: 'Inspección y mantenimiento general', progress: 15, assignee: null },
      { id: 'r2', vehicle: 'Ford Explorer 2021', plate: 'XYZ-7890', type: 'SUV', owner: 'Sin asignar', short: 'Diagnóstico de suspensión', progress: 0, assignee: null }
    ]},
    { title: 'En Progreso', count: 2, items: [
      { id: 'r3', vehicle: 'BMW M4 2023', plate: 'LXP-5521', type: 'Luxury', owner: 'Elena M.', short: 'Frenos y puesta a punto', progress: 65, assignee: 'Elena M.' },
      { id: 'r4', vehicle: 'Rivian R1T 2023', plate: 'RNR-8822', type: 'Truck', owner: 'Marco P.', short: 'Actualización de software y rotación de neumáticos', progress: 40, assignee: 'Marco P.' }
    ]},
    { title: 'Esperando Repuestos', count: 1, items: [
      { id: 'r5', vehicle: 'Audi A6 2020', plate: 'FST-9901', type: 'Sedán', owner: 'Luis G.', short: 'Reemplazo de solenoide de transmisión. Pendiente envío.', progress: 20, assignee: 'Luis G.' }
    ]}
  ];

  // Optional Http client usage when `window.__API_BASE__` is set
  private http = inject(HttpClient);
  private apiBase: string | null = (window as any).__API_BASE__ ?? null;

  constructor() {}

  async getBoards(): Promise<any[]> {
    if (this.apiBase) {
      return lastValueFrom(this.http.get<any[]>(`${this.apiBase}/repairs/boards`) as any);
    }

    // ready to be replaced with HTTP request in production
    return new Promise((res) => setTimeout(() => res(this.boards), 200));
  }
}
