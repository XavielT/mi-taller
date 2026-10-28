import { Component, inject, signal } from '@angular/core';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { Header } from '../../../shared/components/header/header';
import { RouterOutlet } from '@angular/router';
import { TallerStore } from '../../../shared/stores/taller.store';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [Navbar, Header, Footer, RouterOutlet],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home {
  protected store = inject(TallerStore);
  menuAbierto = signal(false);
}
