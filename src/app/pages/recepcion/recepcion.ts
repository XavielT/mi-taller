import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { Cliente } from '../../../shared/models/cliente.model';
import { CHECKLIST_ENTRADA } from '../../../shared/models/orden.model';
import { Vehiculo } from '../../../shared/models/vehiculo.model';
import { ClientesService } from '../../../shared/services/clientes.service';
import { MAX_FOTOS, OrdenesService, errorFoto } from '../../../shared/services/ordenes.service';
import { VehiculosService } from '../../../shared/services/vehiculos.service';
import { MtButton, MtEmptyState, MtInput, MtPageHeader, MtSelect, ToastService } from '../../../shared/ui';
import type { MtOption } from '../../../shared/ui';
import { ClienteForm } from '../../components/cliente-form/cliente-form';
import { VehiculoForm } from '../../components/vehiculo-form/vehiculo-form';

interface FotoPendiente {
  archivo: File;
  url: string;
}

@Component({
  standalone: true,
  selector: 'app-recepcion',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MtButton,
    MtEmptyState,
    MtInput,
    MtPageHeader,
    MtSelect,
    ClienteForm,
    VehiculoForm,
  ],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.scss'],
})
export class Recepcion implements OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private clientesSvc = inject(ClientesService);
  private vehiculosSvc = inject(VehiculosService);
  private ordenesSvc = inject(OrdenesService);
  private toast = inject(ToastService);

  readonly pasos = ['Cliente', 'Vehículo', 'Orden'];
  readonly checklist = CHECKLIST_ENTRADA;
  readonly maxFotos = MAX_FOTOS;

  paso = signal(1);

  // Búsqueda rápida por placa (arriba)
  placaBusqueda = signal('');
  buscandoPlaca = signal(false);

  // Paso 1: cliente
  busqueda = signal('');
  resultados = signal<Cliente[]>([]);
  placasCoincidentes = signal<Record<string, string>>({});
  buscando = signal(false);
  creandoCliente = signal(false);
  cliente = signal<Cliente | null>(null);

  // Paso 2: vehículo
  vehiculos = signal<Vehiculo[]>([]);
  cargandoVehiculos = signal(false);
  creandoVehiculo = signal(false);
  vehiculo = signal<Vehiculo | null>(null);

  // Paso 3: orden
  mecanicos = signal<MtOption[]>([]);
  fotos = signal<FotoPendiente[]>([]);
  errorFotos = signal<string | null>(null);
  enviando = signal(false);
  errorOrden = signal<string | null>(null);
  limiteAlcanzado = signal(false);

  form = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(3)]],
    kilometraje: ['', [Validators.min(0)]],
    combustible: [50],
    inventario: this.fb.nonNullable.group(
      Object.fromEntries(CHECKLIST_ENTRADA.map((i) => [i.key, false])) as Record<string, boolean>,
    ),
    fechaPromesa: [''],
    mecanicoId: [null as string | null],
  });

  puedeAvanzarPaso1 = computed(() => this.cliente() !== null);
  puedeAvanzarPaso2 = computed(() => this.vehiculo() !== null);

  private ultimaBusqueda = 0;

  constructor() {
    toObservable(this.busqueda)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => void this.buscarClientes(q));
  }

  ngOnDestroy(): void {
    this.fotos().forEach((f) => URL.revokeObjectURL(f.url));
  }

  // ---- búsqueda por placa ----
  async irAPlaca(): Promise<void> {
    const placa = this.placaBusqueda().trim();
    if (!placa) return;
    this.buscandoPlaca.set(true);
    try {
      const v = await this.vehiculosSvc.buscarPorPlaca(placa);
      if (!v) {
        this.toast.error(`No hay un vehículo con la placa ${placa.toUpperCase()}`);
        return;
      }
      await this.router.navigate(['/home/recepcion/clientes', v.cliente_id]);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo buscar la placa');
    } finally {
      this.buscandoPlaca.set(false);
    }
  }

  // ---- paso 1 ----
  private async buscarClientes(q: string): Promise<void> {
    const texto = q.trim();
    const id = ++this.ultimaBusqueda;
    if (texto.length < 2) {
      this.resultados.set([]);
      this.placasCoincidentes.set({});
      return;
    }
    this.buscando.set(true);
    try {
      const [porDatos, porPlaca] = await Promise.all([
        this.clientesSvc.buscar(texto),
        this.vehiculosSvc.buscarParcial(texto),
      ]);
      const coincidencias: Record<string, string> = {};
      porPlaca.forEach((v) => (coincidencias[v.cliente_id] = v.placa));
      const conocidos = new Set(porDatos.map((c) => c.id));
      const faltan = [...new Set(porPlaca.map((v) => v.cliente_id))].filter((cid) => !conocidos.has(cid));
      const extra = await this.clientesSvc.obtenerVarios(faltan);
      if (id !== this.ultimaBusqueda) return;
      this.resultados.set([...porDatos, ...extra]);
      this.placasCoincidentes.set(coincidencias);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo buscar');
    } finally {
      if (id === this.ultimaBusqueda) this.buscando.set(false);
    }
  }

  elegirCliente(c: Cliente): void {
    this.cliente.set(c);
    this.creandoCliente.set(false);
    this.vehiculo.set(null);
    void this.cargarVehiculos(c.id);
    this.paso.set(2);
  }

  clienteCreado(c: Cliente): void {
    this.toast.success(`Cliente "${c.nombre}" creado`);
    this.elegirCliente(c);
  }

  // ---- paso 2 ----
  private async cargarVehiculos(clienteId: string): Promise<void> {
    this.cargandoVehiculos.set(true);
    try {
      const lista = await this.vehiculosSvc.porCliente(clienteId);
      this.vehiculos.set(lista);
      this.creandoVehiculo.set(lista.length === 0);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los vehículos');
    } finally {
      this.cargandoVehiculos.set(false);
    }
  }

  elegirVehiculo(v: Vehiculo): void {
    this.vehiculo.set(v);
  }

  vehiculoCreado(v: Vehiculo): void {
    this.vehiculos.update((l) => [...l, v]);
    this.creandoVehiculo.set(false);
    this.vehiculo.set(v);
    this.toast.success(`Vehículo ${v.placa} agregado`);
  }

  // ---- paso 3 ----
  irAPaso3(): void {
    const v = this.vehiculo();
    if (!v) return;
    if (v.kilometraje != null && !this.form.controls.kilometraje.value) {
      this.form.controls.kilometraje.setValue(String(v.kilometraje));
    }
    void this.cargarMecanicos();
    this.paso.set(3);
  }

  private async cargarMecanicos(): Promise<void> {
    if (this.mecanicos().length) return;
    try {
      const m = await this.ordenesSvc.mecanicos();
      this.mecanicos.set(m.map((x) => ({ value: x.user_id, label: x.nombre || x.email || 'Mecánico' })));
    } catch {
      // the select simply stays empty: assigning a mecánico is optional
    }
  }

  volver(): void {
    this.paso.update((p) => Math.max(1, p - 1));
  }

  agregarFotos(e: Event): void {
    const input = e.target as HTMLInputElement;
    const nuevas = Array.from(input.files ?? []);
    input.value = '';
    this.errorFotos.set(null);
    const actuales = this.fotos();
    const aceptadas: FotoPendiente[] = [];
    for (const f of nuevas) {
      if (actuales.length + aceptadas.length >= MAX_FOTOS) {
        this.errorFotos.set(`Máximo ${MAX_FOTOS} fotos por orden`);
        break;
      }
      const problema = errorFoto(f);
      if (problema) {
        this.errorFotos.set(problema);
        continue;
      }
      aceptadas.push({ archivo: f, url: URL.createObjectURL(f) });
    }
    this.fotos.set([...actuales, ...aceptadas]);
  }

  quitarFoto(i: number): void {
    const lista = [...this.fotos()];
    const [quitada] = lista.splice(i, 1);
    if (quitada) URL.revokeObjectURL(quitada.url);
    this.fotos.set(lista);
  }

  async crearOrden(): Promise<void> {
    const cliente = this.cliente();
    const vehiculo = this.vehiculo();
    if (!cliente || !vehiculo) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorOrden.set(null);
    this.limiteAlcanzado.set(false);
    const f = this.form.getRawValue();
    try {
      const orden = await this.ordenesSvc.crear({
        clienteId: cliente.id,
        vehiculoId: vehiculo.id,
        motivo: f.motivo,
        kilometraje: f.kilometraje.trim() === '' ? null : Number(f.kilometraje),
        combustible: f.combustible,
        inventario: f.inventario,
        fechaPromesa: f.fechaPromesa ? new Date(f.fechaPromesa).toISOString() : null,
        mecanicoId: f.mecanicoId,
      });

      const fotos = this.fotos();
      if (fotos.length) {
        try {
          await this.ordenesSvc.subirFotos(orden.id, fotos.map((x) => x.archivo));
        } catch (e) {
          this.toast.error(e instanceof Error ? e.message : 'No se pudieron subir las fotos');
        }
      }

      this.toast.success(`Orden ${orden.numero} creada`);
      await this.router.navigate(['/home/ordenes', orden.id]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear la orden';
      this.errorOrden.set(msg);
      this.limiteAlcanzado.set(/límite/i.test(msg));
      this.toast.error(msg);
    } finally {
      this.enviando.set(false);
    }
  }
}
