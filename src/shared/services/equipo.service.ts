import { Injectable, inject } from '@angular/core';
import { Invitacion, InvitacionCreada, VistaInvitacion } from '../models/invitacion.model';
import { MiembroDetalle, Rol } from '../models/taller.model';
import { TallerStore } from '../stores/taller.store';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class EquipoService {
  private readonly client = inject(SupabaseService).client;
  private readonly store = inject(TallerStore);

  /** Miembros activos del taller con su nombre y correo (vista `miembros_detalle`). */
  async miembros(): Promise<MiembroDetalle[]> {
    const { data, error } = await this.client
      .from('miembros_detalle')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('activo', true)
      .order('created_at');
    if (error) throw aError(error, 'No se pudo cargar el equipo');
    return (data ?? []) as MiembroDetalle[];
  }

  /** Invitaciones pendientes y vigentes. */
  async invitaciones(): Promise<Invitacion[]> {
    const { data, error } = await this.client
      .from('invitaciones')
      .select('*')
      .eq('taller_id', this.store.requerirTallerId())
      .eq('estado', 'pendiente')
      .gt('expira_en', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw aError(error, 'No se pudieron cargar las invitaciones');
    return (data ?? []) as Invitacion[];
  }

  async invitar(rol: Rol, etiqueta: string, sucursalId: string | null): Promise<InvitacionCreada> {
    const { data, error } = await this.client.rpc('invitar_miembro', {
      p_taller: this.store.requerirTallerId(),
      p_rol: rol,
      p_etiqueta: etiqueta || null,
      p_sucursal: sucursalId,
    });
    if (error) throw aError(error, 'No se pudo crear la invitación');
    return data as InvitacionCreada;
  }

  async cancelarInvitacion(id: string): Promise<void> {
    const { error } = await this.client.rpc('cancelar_invitacion', { p_invitacion: id });
    if (error) throw aError(error, 'No se pudo cancelar la invitación');
  }

  async cambiarMiembro(id: string, rol: Rol, sucursalId: string | null): Promise<void> {
    const { error } = await this.client.rpc('cambiar_miembro', { p_miembro: id, p_rol: rol, p_sucursal: sucursalId });
    if (error) throw aError(error, 'No se pudo actualizar al miembro');
  }

  async quitarMiembro(id: string): Promise<void> {
    const { error } = await this.client.rpc('quitar_miembro', { p_miembro: id });
    if (error) throw aError(error, 'No se pudo quitar al miembro');
  }

  /** Funciona sin sesión: muestra a qué taller y con qué rol te invitan. */
  async verInvitacion(token: string): Promise<VistaInvitacion> {
    const { data, error } = await this.client.rpc('ver_invitacion', { p_token: token });
    if (error) throw aError(error, 'No se pudo comprobar la invitación');
    return data as VistaInvitacion;
  }

  async aceptarInvitacion(token: string): Promise<void> {
    const { error } = await this.client.rpc('aceptar_invitacion', { p_token: token });
    if (error) throw aError(error, 'No se pudo aceptar la invitación');
  }
}
