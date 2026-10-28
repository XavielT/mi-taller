import { TestBed } from '@angular/core/testing';
import { PagosService } from '../../../shared/services/pagos.service';
import { PagoForm } from './pago-form';

describe('PagoForm', () => {
  const registrar = vi.fn();

  async function crear(balance: number) {
    registrar.mockReset().mockResolvedValue({ id: 'p1' });
    TestBed.configureTestingModule({ providers: [{ provide: PagosService, useValue: { registrar } }] });
    const fixture = TestBed.createComponent(PagoForm);
    fixture.componentRef.setInput('facturaId', 'f1');
    fixture.componentRef.setInput('balance', balance);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('prefills the amount with the balance', async () => {
    const c = await crear(1500);
    expect(c.form.controls.monto.value).toBe(1500);
    expect(c.form.valid).toBe(true);
  });

  it('rejects an amount above the balance, live', async () => {
    const c = await crear(1500);
    c.form.controls.monto.setValue(1500.01);
    expect(c.form.controls.monto.errors).toHaveProperty('max');
    c.form.controls.monto.setValue(0);
    expect(c.form.controls.monto.errors).toHaveProperty('min');
    c.form.controls.monto.setValue(500);
    expect(c.form.controls.monto.valid).toBe(true);
  });

  it('does not call the service while invalid', async () => {
    const c = await crear(100);
    c.form.controls.monto.setValue(999);
    await c.guardar();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('sends a partial payment and emits the stored row', async () => {
    const c = await crear(1000);
    const emitido = vi.fn();
    c.registrado.subscribe(emitido);
    c.form.controls.monto.setValue(400);
    c.form.controls.metodo.setValue('transferencia');
    await c.guardar();
    expect(registrar).toHaveBeenCalledWith({ facturaId: 'f1', monto: 400, metodo: 'transferencia', referencia: '', notas: '' });
    expect(emitido).toHaveBeenCalledWith({ id: 'p1' });
  });

  it('shows the RPC error message', async () => {
    const c = await crear(100);
    registrar.mockRejectedValue(new Error('La factura ya está pagada'));
    await c.guardar();
    expect(c.error()).toBe('La factura ya está pagada');
  });
});
