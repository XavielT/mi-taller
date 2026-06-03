import { Injectable, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { User } from "../models/user.model";
import { LoginRequest, RegisterRequest, AuthResponse } from "../models/auth.model";

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    // the component never access directly to User, only trough computed
    private readonly _currentUser = signal<User | null>(null);

    // This below will be exposed in the entire app
    readonly currentUser = computed(() => this._currentUser());
    readonly isAuthenticated = computed(() => this._currentUser() !== null);

    constructor(private router: Router) {
        this.restoreSession();
    }

    login(request: LoginRequest): Promise<void> {
        // MOCK - here will be storage the http call from backend
        return new Promise(( resolve, reject) => {
            setTimeout(() => {
                if (request.email === 'test@test.com' && request.password === '123456') {
                    const mockUser: User = {
                        id: '1',
                        name: 'Xaviel',
                        email: request.email
                    };

                    // Here I simulate the backend work, write in "cookie" (but for now I will use sessionStorage)
                    this.writeSession(mockUser);
                    resolve();
                } else {
                    reject(new Error('Credenciales incorrectas'));
                }
            }, 800); // It simulate latency of wifi
        });
    }

    register(request: RegisterRequest): Promise<void> {
        // MOCK here will be the http call from backend
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (request.email && request.password && request.name) {
                    const mockUser: User = {
                        id: crypto.randomUUID(),
                        name: request.name,
                        company: request.company,
                        email: request.email
                    };

                    this.writeSession(mockUser);
                    resolve();
                } else {
                    reject(new Error('Datos Incompletos'));
                }
            }, 800); // It simulate latency of wifi
        });
    }

    logout(): void {
        this.clearSession();
        this.router.navigate(['/']);
    }

    // -------------------------------------------------------------------------
    // Private methods

    private writeSession(user: User): void {
        // Production: backend will write the HttpOnly Cookie
        // Mock: I simulate that persistency here
        sessionStorage.setItem('__session', JSON.stringify(user));
        this._currentUser.set(user);
    }

    private restoreSession(): void {
        // On production: backend will always validate the cookie on every request
        // On Mock: I will restore form sessionStorage in each refresh.
        const raw = sessionStorage.getItem('__session');
        if (raw) {
            this._currentUser.set(JSON.parse(raw));
        }
    }

    private clearSession(): void {
        sessionStorage.removeItem('__session');
        this._currentUser.set(null);
    }
}