import { TestBed } from '@angular/core/testing';
import { TallerStore } from '../stores/taller.store';
import { ERROR_PLACA_DUPLICADA, VehiculosService } from './vehiculos.service';
import { SupabaseService } from './supabase.service';

describe('VehiculosService.crear', () => {
  function servicio(error: { code: string; message: string } | null) {
    const q: Record<string, unknown> = {};
    q['insert'] = vi.fn(() => q);
    q['select'] = () => q;
    q['single'] = () => Promise.resolve({ data: error ? null : { id: 'v1', placa: 'A1' }, error });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { from: () => q } } },
        { provide: TallerStore, useValue: { requerirTallerId: () => 't1' } },
      ],
    });
    return { svc: TestBed.inject(VehiculosService), insert: q['insert'] as ReturnType<typeof vi.fn> };
  }

  const datos = { placa: ' a123 ', marca: '', modelo: null, anio: null, color: null, vin: null, kilometraje: null };

  it('uppercases the plate and scopes the row to the taller', async () => {
    const { svc, insert } = servicio(null);
    await svc.crear('c1', datos);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ placa: 'A123', marca: null, taller_id: 't1', cliente_id: 'c1' }));
  });

  it('maps the unique violation to the friendly message', async () => {
    const { svc } = servicio({ code: '23505', message: 'duplicate key' });
    await expect(svc.crear('c1', datos)).rejects.toThrow(ERROR_PLACA_DUPLICADA);
  });
});
