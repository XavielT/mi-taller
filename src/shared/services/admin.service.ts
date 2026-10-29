import { Injectable, inject } from '@angular/core';
import { AdminResumen, AdminTaller, AdminUsuario } from '../models/admin.model';
import { Plan } from '../models/plan.model';
import { aError } from './supabase-error';
import { SupabaseService } from './supabase.service';

/** Acciones del administrador de la plataforma; cada RPC vuelve a validar el permiso en la base de datos. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly client = inject(SupabaseService).client;

  async resumen(): Promise<AdminResumen> {
    const { data, error } = await this.client.rpc('admin_resumen');
    if (error) throw aError(error, 'No se pudo cargar el resumen');
    return data as AdminResumen;
  }

  async talleres(): Promise<AdminTaller[]> {
    const { data, error } = await this.client.rpc('admin_listar_talleres');
    if (error) throw aError(error, 'No se pudieron cargar los talleres');
    return (data ?? []) as AdminTaller[];
  }

  async usuarios(): Promise<AdminUsuario[]> {
    const { data, error } = await this.client.rpc('admin_listar_usuarios');
    if (error) throw aError(error, 'No se pudieron cargar los usuarios');
    return (data ?? []) as AdminUsuario[];
  }

  async planes(): Promise<Plan[]> {
    const { data, error } = await this.client.from('planes').select('*').eq('activo', true).order('precio_mensual');
    if (error) throw aError(error, 'No se pudieron cargar los planes');
    return (data ?? []) as Plan[];
  }

  async cambiarPlan(tallerId: string, planId: string): Promise<void> {
    const { error } = await this.client.rpc('admin_cambiar_plan', { p_taller: tallerId, p_plan: planId });
    if (error) throw aError(error, 'No se pudo cambiar el plan');
  }

  async activarTaller(tallerId: string, activo: boolean): Promise<void> {
    const { error } = await this.client.rpc('admin_activar_taller', { p_taller: tallerId, p_activo: activo });
    if (error) throw aError(error, 'No se pudo actualizar el taller');
  }
}
