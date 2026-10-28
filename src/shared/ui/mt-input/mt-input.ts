import { Component, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { errorTexto } from '../form-errors';

let nextId = 0;

@Component({
  standalone: true,
  selector: 'mt-input',
  template: `
    <div class="field">
      @if (label()) {
        <label [for]="id">{{ label() }}</label>
      }
      <div class="field__box">
        @if (icon()) {
          <img class="field__icon" [src]="icon()" alt="" />
        }
        @if (rows() > 0) {
          <textarea
            [id]="id"
            [rows]="rows()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [class.invalid]="!!error()"
            [value]="value()"
            (input)="onInput($event)"
            (blur)="onBlur()"
          ></textarea>
        } @else {
          <input
            [id]="id"
            [type]="type()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [attr.min]="min()"
            [attr.max]="max()"
            [attr.step]="step()"
            [class.has-icon]="!!icon()"
            [class.invalid]="!!error()"
            [value]="value()"
            (input)="onInput($event)"
            (blur)="onBlur()"
          />
        }
      </div>
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
    .field__box { position: relative; display: flex; align-items: center; }
    .field__icon { position: absolute; left: .75rem; width: 1.4rem; pointer-events: none; }
    input {
      width: 100%; height: 2.75rem; box-sizing: border-box; padding: 0 .9rem;
      background: var(--input-bg); border: 1px solid transparent; border-radius: 12px;
      font-family: var(--font-body); font-size: 1rem; color: var(--text);
      transition: border-color .2s ease, box-shadow .2s ease;
    }
    input.has-icon { padding-left: 2.75rem; }
    textarea { width: 100%; box-sizing: border-box; padding: .6rem .9rem; background: var(--input-bg); border: 1px solid transparent; border-radius: 12px; font-family: var(--font-body); font-size: 1rem; color: var(--text); resize: vertical; }
    textarea:focus { outline: none; border-color: var(--primary); }
    textarea.invalid { border-color: var(--alert); }
    input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 10px rgba(0, 0, 0, .15); }
    input.invalid { border-color: var(--alert); }
    input:disabled { opacity: .6; }
    .field__error { color: var(--alert); font-size: .85rem; font-family: var(--font-span); }
    .field__hint { color: var(--text-muted); font-size: .85rem; font-family: var(--font-span); }
  `,
})
export class MtInput implements ControlValueAccessor {
  label = input('');
  type = input<string>('text');
  placeholder = input('');
  icon = input<string | null>(null);
  hint = input('');
  /** > 0 renders a textarea with that many rows */
  rows = input(0);
  min = input<number | string | null>(null);
  max = input<number | string | null>(null);
  step = input<number | string | null>(null);

  readonly id = `mt-input-${nextId++}`;
  protected value = signal('');
  protected disabled = signal(false);

  private ngControl = inject(NgControl, { self: true, optional: true });
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  protected error(): string | null {
    return errorTexto(this.ngControl?.control);
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value.set(v);
    this.onChange(v);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  writeValue(v: unknown): void {
    this.value.set(v == null ? '' : String(v));
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }
}
