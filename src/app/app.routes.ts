import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Finances } from './pages/finances/finances';
import { Repairs } from './pages/repairs/repairs';
import { Dashboard } from './pages/dashboard/dashboard';
import { Reception } from './pages/reception/reception';
import { Inventory } from './pages/inventory/inventory';
import { Branches } from './pages/branches/branches';
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
    {path: 'home', component: Home, canActivate: [authGuard], children: [
        { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
        { path: 'dashboard', component: Dashboard },
        { path: 'reception', component: Reception },
        { path: 'repairs', component: Repairs },
        { path: 'finances', component: Finances },
        { path: 'inventory', component: Inventory },
        { path: 'branches', component: Branches }
    ] }
];
