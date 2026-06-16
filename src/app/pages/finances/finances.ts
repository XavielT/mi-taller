import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FinancesService } from '../../../shared/services/finances.service';
import { Header } from '../../../shared/components/header/header';

@Component({
  standalone: true,
  selector: 'app-finances',
  imports: [CommonModule, Header],
  templateUrl: './finances.html',
  styleUrls: ['./finances.scss'],
})
export class Finances {
  summary = signal<any>(null);
  invoices = signal<any[]>([]);
  filterStatus = signal<string | null>(null);
  isLoading = signal(false);

  constructor(private svc: FinancesService) {
    this.load();
  }

  async load() {
    this.isLoading.set(true);
    const s = await this.svc.getSummary();
    const inv = await this.svc.getInvoices(this.filterStatus() ?? undefined);
    this.summary.set(s);
    this.invoices.set(inv);
    this.isLoading.set(false);
  }

  async setFilter(status: string | null) {
    this.filterStatus.set(status);
    await this.load();
  }
}
