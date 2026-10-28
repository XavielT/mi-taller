import { Component, input } from '@angular/core';

@Component({
  standalone: true,
  selector: 'mt-page-header',
  template: `
    <header class="ph">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="ph__actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .ph { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; }
    h1 { margin: 0; font-family: var(--font-titles); color: var(--primary); font-size: 1.6rem; }
    p { margin: .25rem 0 0; color: var(--text-muted); font-family: var(--font-body); }
    .ph__actions { display: flex; gap: .5rem; }
  `,
})
export class MtPageHeader {
  title = input.required<string>();
  subtitle = input('');
}
