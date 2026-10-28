import { Component, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { errorTexto } from '../form-errors';

let nextId = 0;

export interface MtOption {
  value: string | number | null;
  label: string;
}

@Component({
  standalone: true,
  selector: 'mt-select',
  template: `
    <div class="field">
      @if (label()) {
        <label [for]="id">{{ label() }}</label>
      }
      <select [id]="id" [disabled]="disabled()" [class.invalid]="!!error()" (change)="onSelect($event)" (blur)="onTouched()">
        @if (placeholder()) {
          <option value="" [selected]="selectedIndex() === -1">{{ placeholder() }}</option>
        }
        @for (o of options(); track $index) {
          <option [value]="$index" [selected]="$index === selectedIndex()">{{ o.label }}</option>
        }
      </select>
      @if (error(); as msg) {
        <span class="field__error" role="alert">{{ msg }}</span>
      } @else if (hint()) {
        <span class="field__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .field { display: flex; flex-direction: column; gap: .4rem; }
    label { font-family: var(--font-label); font-size: .95rem; color: var(--text); }
    select {
      width: 100%; height: 2.75rem; padding: 0 .9rem; box-sizing: border-box;
      background: var(--input-bg); border: 1px solid transparent; border-radius: 12px;
      font-family: var(--font-body); font-size: 1rem; color: var(--text);
    }
    select:focus { outline: none; border-color: var(--primary); }
    select.invalid { border-color: var(--alert); }
    .field__error { color: var(--alert); font-size: .85rem; font-family: var(--font-span); }
    .field__hint { color: var(--text-muted); font-size: .85rem; font-family: var(--font-span); }
  `,
})
export class MtSelect implements ControlValueAccessor {
  label = input('');
  options = input<MtOption[]>([]);
  placeholder = input('');
  hint = input('');

  readonly id = `mt-select-${nextId++}`;
  protected disabled = signal(false);
  private current = signal<unknown>(null);

  private ngControl = inject(NgControl, { self: true, optional: true });
  private onChange: (v: unknown) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  protected selectedIndex(): number {
    return this.options().findIndex((o) => o.value === this.current());
  }

  protected error(): string | null {
    return errorTexto(this.ngControl?.control);
  }

  protected onSelect(e: Event): void {
    const raw = (e.target as HTMLSelectElement).value;
    const v = raw === '' ? null : this.options()[Number(raw)].value;
    this.current.set(v);
    this.onChange(v);
  }

  writeValue(v: unknown): void {
    this.current.set(v ?? null);
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }
}
