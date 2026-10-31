import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MtToastContainer } from '../shared/ui';
import { marcarArranqueCorrecto } from './chunk-error';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, MtToastContainer],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  constructor() {
    // A page loaded fine: re-arm the one-time reload used when a deploy leaves an open tab with stale files.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => marcarArranqueCorrecto());
  }
}
