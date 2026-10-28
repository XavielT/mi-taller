import { Component, computed, input } from '@angular/core';

export type Tono = 'info' | 'warning' | 'ok' | 'muted' | 'alert';

export const ESTADOS: Record<string, { label: string; tono: Tono }> = {
  recepcion: { label: 'Recepción', tono: 'info' },
  diagnostico: { label: 'Diagnóstico', tono: 'info' },
  en_progreso: { label: 'En progreso', tono: 'warning' },
  esperando_repuestos: { label: 'Esperando repuestos', tono: 'warning' },
  listo: { label: 'Listo', tono: 'ok' },
  entregado: { label: 'Entregado', tono: 'muted' },
  cancelado: { label: 'Cancelado', tono: 'alert' },
  pendiente: { label: 'Pendiente', tono: 'warning' },
  pagada: { label: 'Pagada', tono: 'ok' },
  vencida: { label: 'Vencida', tono: 'alert' },
  anulada: { label: 'Anulada', tono: 'muted' },
};

export function estadoInfo(estado: string): { label: string; tono: Tono } {
  return ESTADOS[estado] ?? { label: estado, tono: 'muted' };
}

@Component({
  standalone: true,
  selector: 'mt-badge-estado',
  template: `<span [class]="'badge badge--' + info().tono">{{ info().label }}</span>`,
  styles: `
    .badge { display: inline-block; padding: .2rem .7rem; border-radius: 999px; font-family: var(--font-span); font-size: .8rem; font-weight: 600; white-space: nowrap; }
    .badge--info { background: var(--info-container); color: var(--primary2); }
    .badge--warning { background: var(--warning-container); color: var(--warning); }
    .badge--ok { background: var(--success-container); color: var(--ok); }
    .badge--muted { background: var(--input-bg); color: var(--text-muted); }
    .badge--alert { background: var(--error-container); color: var(--alert); }
  `,
})
export class MtBadgeEstado {
  estado = input.required<string>();
  protected info = computed(() => estadoInfo(this.estado()));
}
