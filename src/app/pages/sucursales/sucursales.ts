import { Component } from '@angular/core';
import { MtEmptyState, MtPageHeader } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-sucursales',
  imports: [MtEmptyState, MtPageHeader],
  template: `
    <div class="mt-page">
      <mt-page-header title="Sucursales" />
      <div class="mt-card">
        <mt-empty-state
          title="Disponible próximamente"
          text="Podrás administrar varias sucursales, sus equipos y sus órdenes desde un solo lugar."
        />
      </div>
    </div>
  `,
})
export class Sucursales {}
