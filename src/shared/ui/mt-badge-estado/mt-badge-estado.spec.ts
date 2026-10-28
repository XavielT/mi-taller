import { TestBed } from '@angular/core/testing';
import { ESTADOS, MtBadgeEstado, estadoInfo } from './mt-badge-estado';

describe('mt-badge-estado', () => {
  it('maps every state to its Spanish label and tone', () => {
    expect(estadoInfo('recepcion')).toEqual({ label: 'Recepción', tono: 'info' });
    expect(estadoInfo('diagnostico')).toEqual({ label: 'Diagnóstico', tono: 'info' });
    expect(estadoInfo('en_progreso')).toEqual({ label: 'En progreso', tono: 'warning' });
    expect(estadoInfo('esperando_repuestos')).toEqual({ label: 'Esperando repuestos', tono: 'warning' });
    expect(estadoInfo('listo')).toEqual({ label: 'Listo', tono: 'ok' });
    expect(estadoInfo('entregado')).toEqual({ label: 'Entregado', tono: 'muted' });
    expect(estadoInfo('cancelado')).toEqual({ label: 'Cancelado', tono: 'alert' });
    expect(estadoInfo('pendiente')).toEqual({ label: 'Pendiente', tono: 'warning' });
    expect(estadoInfo('pagada')).toEqual({ label: 'Pagada', tono: 'ok' });
    expect(estadoInfo('vencida')).toEqual({ label: 'Vencida', tono: 'alert' });
    expect(estadoInfo('anulada')).toEqual({ label: 'Anulada', tono: 'muted' });
    expect(Object.keys(ESTADOS).length).toBe(11);
  });

  it('falls back to the raw value as a muted badge', () => {
    expect(estadoInfo('otro')).toEqual({ label: 'otro', tono: 'muted' });
  });

  it('renders the label', async () => {
    const fixture = TestBed.createComponent(MtBadgeEstado);
    fixture.componentRef.setInput('estado', 'listo');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Listo');
  });
});
