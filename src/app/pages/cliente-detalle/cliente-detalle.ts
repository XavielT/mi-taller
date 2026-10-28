import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Cliente } from '../../../shared/models/cliente.model';
import { OrdenResumen } from '../../../shared/models/orden.model';
import { Vehiculo } from '../../../shared/models/vehiculo.model';
import { ClientesService } from '../../../shared/services/clientes.service';
import { OrdenesService } from '../../../shared/services/ordenes.service';
import { VehiculosService } from '../../../shared/services/vehiculos.service';
import {
  MtBadgeEstado,
  MtButton,
  MtCell,
  MtEmptyState,
  MtModal,
  MtPageHeader,
  MtTable,
  ToastService,
} from '../../../shared/ui';
import type { MtColumn } from '../../../shared/ui';
import { ClienteForm } from '../../components/cliente-form/cliente-form';
import { VehiculoForm } from '../../components/vehiculo-form/vehiculo-form';

@Component({
  standalone: true,
  selector: 'app-cliente-detalle',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MtBadgeEstado,
    MtButton,
    MtCell,
    MtEmptyState,
    MtModal,
    MtPageHeader,
    MtTable,
    ClienteForm,
    VehiculoForm,
  ],
  templateUrl: './cliente-detalle.html',
  styleUrls: ['./cliente-detalle.scss'],
})
export class ClienteDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private clientes = inject(ClientesService);
  private vehiculosSvc = inject(VehiculosService);
  private ordenesSvc = inject(OrdenesService);
  private toast = inject(ToastService);

  readonly columnasOrdenes: MtColumn[] = [
    { key: 'numero', label: 'Orden' },
    { key: 'estado', label: 'Estado' },
    { key: 'vehiculo', label: 'Vehículo' },
    { key: 'fecha_entrada', label: 'Entrada' },
    { key: 'total', label: 'Total', align: 'right' },
  ];

  cliente = signal<Cliente | null>(null);
  vehiculos = signal<Vehiculo[]>([]);
  ordenes = signal<OrdenResumen[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  editandoCliente = signal(false);
  modalVehiculo = signal(false);
  vehiculoEditando = signal<Vehiculo | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const [cliente, vehiculos, ordenes] = await Promise.all([
        this.clientes.obtener(id),
        this.vehiculosSvc.porCliente(id),
        this.ordenesSvc.ultimasDeCliente(id, 10),
      ]);
      this.cliente.set(cliente);
      this.vehiculos.set(vehiculos);
      this.ordenes.set(ordenes);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el cliente');
    } finally {
      this.cargando.set(false);
    }
  }

  clienteGuardado(c: Cliente): void {
    this.cliente.set(c);
    this.editandoCliente.set(false);
    this.toast.success('Cliente actualizado');
  }

  nuevoVehiculo(): void {
    this.vehiculoEditando.set(null);
    this.modalVehiculo.set(true);
  }

  editarVehiculo(v: Vehiculo): void {
    this.vehiculoEditando.set(v);
    this.modalVehiculo.set(true);
  }

  vehiculoGuardado(v: Vehiculo): void {
    const editado = this.vehiculoEditando() !== null;
    this.vehiculos.update((lista) => (editado ? lista.map((x) => (x.id === v.id ? v : x)) : [...lista, v]));
    this.modalVehiculo.set(false);
    this.toast.success(editado ? 'Vehículo actualizado' : `Vehículo ${v.placa} agregado`);
  }
}
