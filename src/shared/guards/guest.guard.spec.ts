import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';

describe('guestGuard', () => {
  function run(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(authenticated), whenReady: () => Promise.resolve() } },
      ],
    });
    return TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
  }

  it('lets anonymous users reach login/register', async () => {
    expect(await run(false)).toBe(true);
  });

  it('redirects users with a session to /home', async () => {
    const result = await run(true);
    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });
});
