import { Component, HostListener, input, output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'mt-modal',
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()">
        <div [class]="'modal modal--' + size()" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
          <header class="modal__head">
            <h3>{{ title() }}</h3>
            <button type="button" class="modal__close" aria-label="Cerrar" (click)="closed.emit()">×</button>
          </header>
          <div class="modal__body"><ng-content /></div>
          <footer class="modal__foot"><ng-content select="[footer]" /></footer>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      padding: 1rem; background: rgba(0, 37, 71, .5);
    }
    .modal {
      width: 100%; max-height: 90vh; display: flex; flex-direction: column;
      background: var(--surface); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
    }
    .modal--sm { max-width: 24rem; }
    .modal--md { max-width: 36rem; }
    .modal--lg { max-width: 52rem; }
    .modal__head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--borders); }
    .modal__head h3 { margin: 0; font-family: var(--font-titles); color: var(--primary); }
    .modal__close { background: none; border: none; font-size: 1.6rem; line-height: 1; cursor: pointer; color: var(--text-muted); }
    .modal__body { padding: 1.25rem; overflow-y: auto; }
    .modal__foot { display: flex; justify-content: flex-end; gap: .75rem; padding: 0 1.25rem 1.25rem; }
    .modal__foot:empty { display: none; }
  `,
})
export class MtModal {
  open = input(false);
  title = input('');
  size = input<'sm' | 'md' | 'lg'>('md');
  closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
