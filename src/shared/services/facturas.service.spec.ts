import { TestBed } from '@angular/core/testing';
import { TallerStore } from '../stores/taller.store';
import { FacturasService } from './facturas.service';
import { PagosService } from './pagos.service';
import { SupabaseService } from './supabase.service';

function configurar(rpc: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: { client: { rpc } } },
      { provide: TallerStore, useValue: { requerirTallerId: () => 't1' } },
    ],
  });
}

describe('FacturasService', () => {
  it('emitir sends nulls for the optional NCF fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'f1', numero: 'FAC-000001' }, error: null });
    configurar(rpc);
    const f = await TestBed.inject(FacturasService).emitir({ ordenId: 'o1' });
    expect(f.numero).toBe('FAC-000001');
    expect(rpc).toHaveBeenCalledWith('emitir_factura', {
      p_orden: 'o1',
      p_tipo_ncf: null,
      p_ncf: null,
      p_fecha_vencimiento: null,
      p_notas: null,
    });
  });

  it('emitir trims the NCF and forwards the type', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    configurar(rpc);
    await TestBed.inject(FacturasService).emitir({ ordenId: 'o1', tipoNcf: 'B01', ncf: ' B0100000001 ', fechaVencimiento: '2026-11-27' });
    expect(rpc).toHaveBeenCalledWith('emitir_factura', expect.objectContaining({ p_tipo_ncf: 'B01', p_ncf: 'B0100000001', p_fecha_vencimiento: '2026-11-27' }));
  });

  it('surfaces the Spanish RPC error (order already invoiced)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'La orden ya tiene una factura activa' } });
    configurar(rpc);
    await expect(TestBed.inject(FacturasService).emitir({ ordenId: 'o1' })).rejects.toThrow('La orden ya tiene una factura activa');
  });

  it('anular passes the reason', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'f1' }, error: null });
    configurar(rpc);
    await TestBed.inject(FacturasService).anular('f1', 'Error de digitación');
    expect(rpc).toHaveBeenCalledWith('anular_factura', { p_factura: 'f1', p_motivo: 'Error de digitación' });
  });
});

describe('PagosService.registrar', () => {
  it('maps the payment to the RPC arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null });
    configurar(rpc);
    await TestBed.inject(PagosService).registrar({ facturaId: 'f1', monto: 250.5, metodo: 'efectivo', referencia: ' ' });
    expect(rpc).toHaveBeenCalledWith('registrar_pago', {
      p_factura: 'f1',
      p_monto: 250.5,
      p_metodo: 'efectivo',
      p_referencia: null,
      p_notas: null,
    });
  });
});
