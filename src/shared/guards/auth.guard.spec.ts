import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  async function run(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(authenticated), whenReady: () => Promise.resolve() } },
      ],
    });
    return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
  }

  it('redirects to /login when not authenticated', async () => {
    const result = await run(false);
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows navigation when authenticated', async () => {
    expect(await run(true)).toBe(true);
  });

  it('waits for the initial session check before deciding', async () => {
    let listo = false;
    const isAuthenticated = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated,
            whenReady: () =>
              new Promise<void>((res) =>
                setTimeout(() => {
                  isAuthenticated.set(true);
                  listo = true;
                  res();
                }, 0),
              ),
          },
        },
      ],
    });
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(listo).toBe(true);
    expect(result).toBe(true);
  });
});
