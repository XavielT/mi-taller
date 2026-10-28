import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { Cliente } from '../../../shared/models/cliente.model';
import { ClientesService } from '../../../shared/services/clientes.service';
import { MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ToastService } from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';
import { ClienteForm } from '../../components/cliente-form/cliente-form';

@Component({
  standalone: true,
  selector: 'app-clientes',
  imports: [RouterLink, MtButton, MtCell, MtEmptyState, MtModal, MtPageHeader, MtTable, ClienteForm],
  templateUrl: './clientes.html',
  styleUrls: ['./clientes.scss'],
})
export class Clientes {
  private svc = inject(ClientesService);
  private toast = inject(ToastService);

  readonly tamano = 25;
  readonly columnas: MtColumn[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'documento', label: 'Documento' },
    { key: 'acciones', label: '', align: 'right' },
  ];

  busqueda = signal('');
  pagina = signal(1);
  filas = signal<Cliente[]>([]);
  total = signal(0);
  cargando = signal(false);

  modalAbierto = signal(false);
  editando = signal<Cliente | null>(null);

  paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano)));

  private ultimaCarga = 0;

  constructor() {
    void this.cargar();
    toObservable(this.busqueda)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.pagina.set(1);
        void this.cargar();
      });
  }

  async cargar(): Promise<void> {
    const id = ++this.ultimaCarga;
    this.cargando.set(true);
    try {
      const r = await this.svc.listar(this.busqueda(), this.pagina(), this.tamano);
      if (id !== this.ultimaCarga) return; // a newer search superseded this one
      this.filas.set(r.filas);
      this.total.set(r.total);
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los clientes');
    } finally {
      if (id === this.ultimaCarga) this.cargando.set(false);
    }
  }

  irAPagina(p: number): void {
    this.pagina.set(Math.min(Math.max(1, p), this.paginas()));
    void this.cargar();
  }

  nuevo(): void {
    this.editando.set(null);
    this.modalAbierto.set(true);
  }

  editar(c: Cliente): void {
    this.editando.set(c);
    this.modalAbierto.set(true);
  }

  guardado(c: Cliente): void {
    this.modalAbierto.set(false);
    this.toast.success(this.editando() ? 'Cliente actualizado' : `Cliente "${c.nombre}" creado`);
    void this.cargar();
  }
}
