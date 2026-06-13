import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Auth } from './pages/auth/auth';
import { authGuard } from '../shared/guards/auth.guard';
import { Login } from './components/login/login';
import { Register } from './components/register/register';

export const routes: Routes = [
    {path: '', component: Auth, children: [
        { path: '', redirectTo: 'login', pathMatch: 'full' },
        { path: 'login', component: Login },
        { path: 'register', component: Register },
    ]},
    {path: 'home', component: Home, canActivate: [authGuard] }
];
