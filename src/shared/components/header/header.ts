import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
})
export class Header {
  constructor(private auth: AuthService) {}

  // expose current user via getter to avoid using `auth` before initialization
  get user() {
    return this.auth.currentUser;
  }
}
