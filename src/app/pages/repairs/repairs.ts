import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepairsService } from '../../../shared/services/repairs.service';
import { Header } from '../../../shared/components/header/header';

@Component({
  standalone: true,
  selector: 'app-repairs',
  imports: [CommonModule, Header],
  templateUrl: './repairs.html',
  styleUrls: ['./repairs.scss'],
})
export class Repairs {
  columns = signal<any[]>([]);

  constructor(private svc: RepairsService) {
    this.load();
  }

  async load() {
    const cols = await this.svc.getBoards();
    this.columns.set(cols);
  }
}
