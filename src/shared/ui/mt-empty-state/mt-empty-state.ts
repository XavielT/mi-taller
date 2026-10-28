import { Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'mt-empty-state',
  template: `
    <div class="empty">
      @if (icon()) {
        <img class="empty__icon" [src]="icon()" alt="" />
      }
      <h3>{{ title() }}</h3>
      @if (text()) {
        <p>{{ text() }}</p>
      }
      <div class="empty__action"><ng-content /></div>
    </div>
  `,
  styles: `
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 2.5rem 1rem; gap: .5rem; }
    .empty__icon { width: 3rem; opacity: .6; }
    h3 { margin: 0; font-family: var(--font-titles); color: var(--primary); }
    p { margin: 0; color: var(--text-muted); font-family: var(--font-body); max-width: 28rem; }
    .empty__action { margin-top: .75rem; }
    .empty__action:empty { display: none; }
  `,
})
export class MtEmptyState {
  icon = input<string | null>(null);
  title = input.required<string>();
  text = input('');
}
