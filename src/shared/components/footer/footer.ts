import { Component } from '@angular/core';
import pkg from '../../../../package.json';

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss'],
})
export class Footer {
  readonly version = pkg.version;
}
