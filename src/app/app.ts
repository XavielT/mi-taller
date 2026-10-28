import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MtToastContainer } from '../shared/ui';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, MtToastContainer],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {}
