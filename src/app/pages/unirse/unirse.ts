import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ETIQUETA_ROL, VistaInvitacion } from '../../../shared/models/invitacion.model';
import { AuthService } from '../../../shared/services/auth.service';
import { EquipoService } from '../../../shared/services/equipo.service';
import { CLAVE_INVITACION_PENDIENTE } from '../../../shared/storage-keys';
import { TallerStore } from '../../../shared/stores/taller.store';
import { MtButton } from '../../../shared/ui';

/** Landing of an invitation link. Public: shows the taller and role; joining needs a session. */
@Component({
  standalone: true,
  selector: 'app-unirse',
  imports: [RouterLink, MtButton],
  template: `
    <div class="unirse">
      <div class="unirse__card">
        <img class="unirse__logo" src="assets/imgs/auth/mi-taller-logo.png" alt="Mi Taller" />
        @if (cargando()) {
          <p class="mt-muted">Comprobando la invitación...</p>
        } @else if (vista(); as v) {
          @if (v.valida) {
            <h1>Te invitaron a {{ v.taller }}</h1>
            <p class="mt-muted">Entrarás como {{ rol() }}.</p>
            @if (auth.isAuthenticated()) {
              @if (error(); as msg) {
                <div class="mt-error" role="alert">{{ msg }}</div>
              }
              <mt-button size="lg" [loading]="uniendo()" (click)="unirse()">Unirme al taller</mt-button>
            } @else {
              <p>Inicia sesión o crea tu cuenta para unirte. Al entrar, la invitación se aplica sola.</p>
              <div class="unirse__acciones">
                <a class="unirse__btn" routerLink="/login" (click)="guardarToken()">Iniciar sesión</a>
                <a class="unirse__btn unirse__btn--sec" routerLink="/register" (click)="guardarToken()">Crear cuenta</a>
              </div>
            }
          } @else {
            <h1>Invitación no disponible</h1>
            <p class="mt-muted">{{ v.motivo }}</p>
            <a class="unirse__btn" routerLink="/login">Ir al inicio</a>
          }
        } @else if (error(); as msg) {
          <div class="mt-error" role="alert">{{ msg }}</div>
        }
      </div>
    </div>
  `,
  styles: `
    .unirse { min-height: 100vh; display: grid; place-items: center; padding: 1rem; background: var(--bg); }
    .unirse__card { width: 100%; max-width: 26rem; display: flex; flex-direction: column; gap: 1rem; align-items: center; text-align: center; padding: 2rem 1.5rem; background: var(--surface); border-radius: var(--radius); box-shadow: 0 6px 24px rgba(0, 37, 71, .12); }
    .unirse__logo { width: 5rem; height: auto; }
    h1 { margin: 0; font-family: var(--font-titles); color: var(--primary); font-size: 1.4rem; }
    p { margin: 0; }
    .unirse__acciones { display: flex; gap: .75rem; flex-wrap: wrap; justify-content: center; }
    .unirse__btn { display: inline-block; padding: .7rem 1.2rem; border-radius: var(--radius); background: var(--primary); color: var(--titles); text-decoration: none; font-family: var(--font-btns); }
    .unirse__btn--sec { background: transparent; color: var(--primary); border: 1px solid var(--borders); }
  `,
})
export class Unirse {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(EquipoService);
  private store = inject(TallerStore);
  readonly auth = inject(AuthService);

  private token = this.route.snapshot.paramMap.get('token') ?? '';

  cargando = signal(true);
  uniendo = signal(false);
  vista = signal<VistaInvitacion | null>(null);
  error = signal<string | null>(null);

  constructor() {
    void this.iniciar();
  }

  rol(): string {
    const r = this.vista()?.rol;
    return r ? ETIQUETA_ROL[r].toLowerCase() : '';
  }

  private async iniciar(): Promise<void> {
    try {
      await this.auth.whenReady();
      this.vista.set(await this.svc.verInvitacion(this.token));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo comprobar la invitación');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Keeps the token so the taller store accepts it on the first load after login or sign-up. */
  guardarToken(): void {
    try {
      localStorage.setItem(CLAVE_INVITACION_PENDIENTE, this.token);
    } catch {
      // without storage the user can open the link again after logging in
    }
  }

  async unirse(): Promise<void> {
    this.uniendo.set(true);
    this.error.set(null);
    try {
      await this.svc.aceptarInvitacion(this.token);
      await this.store.cargar();
      await this.router.navigate(['/home']);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo aceptar la invitación');
    } finally {
      this.uniendo.set(false);
    }
  }
}
