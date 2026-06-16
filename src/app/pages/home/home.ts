import { Component } from '@angular/core';
import { Navbar } from '../../../shared/components/navbar/navbar';
import { Footer } from '../../../shared/components/footer/footer';
import { Header } from '../../../shared/components/header/header';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [Navbar, Header, Footer, RouterOutlet],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home {}
