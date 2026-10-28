import { Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'mt-button',
  template: `
    <button [class]="'btn btn--' + variant() + ' btn--' + size()" [type]="type()" [disabled]="disabled() || loading()">
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%;
      border: 1px solid transparent; border-radius: var(--radius); cursor: pointer;
      font-family: var(--font-btns); transition: background-color .2s ease, border-color .2s ease;
    }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .btn--sm { padding: .4rem .75rem; font-size: .85rem; }
    .btn--md { padding: .65rem 1.1rem; font-size: 1rem; }
    .btn--lg { padding: .8rem 1.4rem; font-size: 1.15rem; }
    .btn--primary { background: var(--primary); color: var(--titles); }
    .btn--primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn--secondary { background: var(--secondary); color: var(--titles); }
    .btn--secondary:hover:not(:disabled) { background: var(--secondary-hover); }
    .btn--ghost { background: transparent; color: var(--primary); border-color: var(--borders); }
    .btn--ghost:hover:not(:disabled) { background: var(--input-bg); }
    .btn--danger { background: var(--alert); color: var(--titles); }
    .btn--danger:hover:not(:disabled) { filter: brightness(.92); }
    .spinner {
      width: 1em; height: 1em; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent; animation: mt-spin .7s linear infinite;
    }
    @keyframes mt-spin { to { transform: rotate(360deg); } }
  `,
})
export class MtButton {
  variant = input<'primary' | 'secondary' | 'ghost' | 'danger'>('primary');
  size = input<'sm' | 'md' | 'lg'>('md');
  loading = input(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
}
