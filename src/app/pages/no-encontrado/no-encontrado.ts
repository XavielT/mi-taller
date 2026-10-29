import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MtEmptyState } from '../../../shared/ui';

@Component({
  standalone: true,
  selector: 'app-no-encontrado',
  imports: [RouterLink, MtEmptyState],
  template: `
    <div class="pagina">
      <mt-empty-state title="Página no encontrada" text="La dirección que abriste no existe o ya no está disponible.">
        <a class="volver" routerLink="/home">Volver al inicio</a>
      </mt-empty-state>
    </div>
  `,
  styles: `
    .pagina { min-height: 100vh; display: grid; place-items: center; padding: 1rem; background: var(--bg); }
    .volver { display: inline-block; padding: .7rem 1.2rem; border-radius: var(--radius); background: var(--primary); color: var(--titles); text-decoration: none; font-family: var(--font-btns); }
  `,
})
export class NoEncontrado {}
