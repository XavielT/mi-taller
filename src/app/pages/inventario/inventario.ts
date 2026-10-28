import { Component } from '@angular/core';
import { MtEmptyState, MtPageHeader } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-inventario',
  imports: [MtEmptyState, MtPageHeader],
  template: `
    <div class="mt-page">
      <mt-page-header title="Inventario" />
      <div class="mt-card">
        <mt-empty-state
          title="Disponible próximamente"
          text="Aquí controlarás tus piezas, el stock mínimo y el descuento automático al usarlas en una orden."
        />
      </div>
    </div>
  `,
})
export class Inventario {}
