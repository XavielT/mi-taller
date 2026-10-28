import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  standalone: true,
  selector: 'mt-toast-container',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div [class]="'toast toast--' + t.kind" role="status" (click)="toasts.dismiss(t.id)">{{ t.message }}</div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 1rem; bottom: 1rem; z-index: 2000; display: flex; flex-direction: column; gap: .5rem; max-width: calc(100vw - 2rem); }
    .toast { padding: .75rem 1rem; border-radius: var(--radius); box-shadow: var(--shadow-sm); border: 1px solid var(--borders); font-family: var(--font-body); cursor: pointer; background: var(--surface); }
    .toast--success { background: var(--success-container); color: var(--ok); }
    .toast--error { background: var(--error-container); color: var(--alert); }
    .toast--info { background: var(--info-container); color: var(--primary2); }
  `,
})
export class MtToastContainer {
  protected toasts = inject(ToastService);
}
