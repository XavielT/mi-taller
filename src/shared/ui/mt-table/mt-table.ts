import { NgTemplateOutlet } from '@angular/common';
import { Component, Directive, TemplateRef, contentChildren, inject, input } from '@angular/core';

export interface MtColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

/** Marks an `<ng-template mtCell="key" let-row>` used to render the cells of one column. */
@Directive({ standalone: true, selector: 'ng-template[mtCell]' })
export class MtCell {
  key = input.required<string>({ alias: 'mtCell' });
  template = inject(TemplateRef);
}

@Component({
  standalone: true,
  selector: 'mt-table',
  imports: [NgTemplateOutlet],
  template: `
    <div class="wrap">
      <table>
        <thead>
          <tr>
            @for (c of columns(); track c.key) {
              <th [style.text-align]="c.align ?? 'left'">{{ c.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr><td [attr.colspan]="columns().length" class="msg">Cargando...</td></tr>
          } @else {
            @for (row of rows(); track $index) {
              <tr>
                @for (c of columns(); track c.key) {
                  <td [style.text-align]="c.align ?? 'left'">
                    @if (cellFor(c.key); as tpl) {
                      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
                    } @else {
                      {{ row[c.key] }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
      @if (!loading() && rows().length === 0) {
        <div><ng-content select="[empty]" /></div>
      }
    </div>
  `,
  styles: `
    .wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--borders); border-radius: var(--radius); }
    table { width: 100%; border-collapse: collapse; font-family: var(--font-body); }
    th { padding: .75rem 1rem; font-family: var(--font-subtitles); font-size: .8rem; text-transform: uppercase; color: var(--text-muted); background: var(--bg); border-bottom: 1px solid var(--borders); }
    td { padding: .75rem 1rem; border-bottom: 1px solid var(--borders); color: var(--text); }
    tr:last-child td { border-bottom: none; }
    .msg { text-align: center; color: var(--text-muted); }
  `,
})
export class MtTable {
  columns = input<MtColumn[]>([]);
  rows = input<any[]>([]);
  loading = input(false);
  private cells = contentChildren(MtCell);

  protected cellFor(key: string): TemplateRef<unknown> | null {
    return this.cells().find((c) => c.key() === key)?.template ?? null;
  }
}
