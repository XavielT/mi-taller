import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TallerStore } from '../stores/taller.store';
import { MAX_FOTO_BYTES, OrdenesService, errorFoto } from './ordenes.service';
import { SupabaseService } from './supabase.service';

describe('errorFoto', () => {
  it('accepts jpg, png and webp up to 5 MB', () => {
    expect(errorFoto({ type: 'image/jpeg', size: 1000, name: 'a.jpg' })).toBeNull();
    expect(errorFoto({ type: 'image/png', size: MAX_FOTO_BYTES, name: 'a.png' })).toBeNull();
    expect(errorFoto({ type: 'image/webp', size: 1, name: 'a.webp' })).toBeNull();
  });

  it('rejects other types and oversized files', () => {
    expect(errorFoto({ type: 'application/pdf', size: 10, name: 'a.pdf' })).toContain('solo se permiten');
    expect(errorFoto({ type: 'image/jpeg', size: MAX_FOTO_BYTES + 1, name: 'big.jpg' })).toContain('5 MB');
  });
});

describe('OrdenesService.crear', () => {
  it('sends the taller, the active sucursal and null for empty optionals', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'o1', numero: 'OT-000001' }, error: null });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: TallerStore, useValue: { requerirTallerId: () => 't1', sucursalActiva: signal({ id: 's1' }) } },
      ],
    });
    const orden = await TestBed.inject(OrdenesService).crear({ clienteId: 'c1', vehiculoId: 'v1', motivo: 'Ruido' });
    expect(orden.numero).toBe('OT-000001'); // the number is the DB value, never formatted client-side
    expect(rpc).toHaveBeenCalledWith('crear_orden', {
      p_taller: 't1',
      p_cliente: 'c1',
      p_vehiculo: 'v1',
      p_motivo: 'Ruido',
      p_kilometraje: null,
      p_combustible: null,
      p_inventario: {},
      p_fecha_promesa: null,
      p_mecanico: null,
      p_sucursal: 's1',
    });
  });

  it('surfaces the Spanish message raised by the RPC (plan limit)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Alcanzaste el límite de 30 órdenes por mes' } });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { rpc } } },
        { provide: TallerStore, useValue: { requerirTallerId: () => 't1', sucursalActiva: signal(null) } },
      ],
    });
    await expect(
      TestBed.inject(OrdenesService).crear({ clienteId: 'c1', vehiculoId: 'v1', motivo: 'x' }),
    ).rejects.toThrow('límite');
  });
});
